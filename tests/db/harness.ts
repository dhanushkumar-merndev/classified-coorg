// In-process Postgres (PGlite) that mimics the parts of Supabase the
// migrations and RLS policies depend on: the anon/authenticated/service_role
// roles, auth.users, auth.uid() from JWT claims, and Supabase's permissive
// default grants on the public schema (so a missing revoke is caught here).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../supabase/migrations", import.meta.url));

const SUPABASE_BOOTSTRAP = /* sql */ `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    phone text unique,
    phone_confirmed_at timestamptz,
    email text,
    email_confirmed_at timestamptz,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(
      current_setting('request.jwt.claim.sub', true),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export type Actor =
  | { kind: "anon" }
  | { kind: "user"; id: string }
  | { kind: "service" };

export const anon: Actor = { kind: "anon" };
export const service: Actor = { kind: "service" };
export const user = (id: string): Actor => ({ kind: "user", id });

type Role = "buyer" | "seller" | "agent" | "admin" | "super_admin";

export class TestDb {
  private constructor(readonly pg: PGlite) {}

  static async create(): Promise<TestDb> {
    const pg = await PGlite.create({ extensions: { pg_trgm } });
    await pg.exec(SUPABASE_BOOTSTRAP);
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      try {
        await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }
    return new TestDb(pg);
  }

  /** Runs fn as the given actor inside a transaction that is always rolled back
   *  on error. Returns rows of the last query run through `q`. */
  async as<T>(actor: Actor, fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.pg.transaction(async (tx) => {
      if (actor.kind === "anon") {
        await tx.exec("set local role anon");
      } else if (actor.kind === "service") {
        await tx.exec("set local role service_role");
      } else {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: actor.id, role: "authenticated" }),
        ]);
        await tx.exec("set local role authenticated");
      }
      return fn(tx);
    });
  }

  async rows<T = Record<string, unknown>>(actor: Actor, sql: string, params: unknown[] = []): Promise<T[]> {
    return this.as(actor, async (tx) => (await tx.query<T>(sql, params)).rows);
  }

  async one<T = Record<string, unknown>>(actor: Actor, sql: string, params: unknown[] = []): Promise<T> {
    const rows = await this.rows<T>(actor, sql, params);
    if (rows.length !== 1) throw new Error(`expected 1 row, got ${rows.length}`);
    return rows[0];
  }

  /** Resolves to the database error message (application error code), or
   *  throws if the statement unexpectedly succeeded. */
  async error(actor: Actor, sql: string, params: unknown[] = []): Promise<string> {
    try {
      await this.rows(actor, sql, params);
    } catch (error) {
      return (error as Error).message;
    }
    throw new Error(`expected failure: ${sql}`);
  }

  /** Superuser query for fixtures and assertions. */
  async sql<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.pg.query<T>(sql, params)).rows;
  }

  async createUser(opts: { roles?: Role[]; name?: string; phoneConfirmed?: boolean } = {}): Promise<string> {
    const id = randomUUID();
    const phone = "91" + String(Math.floor(6_000_000_000 + Math.random() * 3_999_999_999));
    await this.sql(
      "insert into auth.users (id, phone, phone_confirmed_at) values ($1, $2, $3)",
      [id, phone, opts.phoneConfirmed === false ? null : new Date().toISOString()],
    );
    await this.sql("update public.profiles set full_name = $2 where id = $1", [id, opts.name ?? "Test User"]);
    for (const role of opts.roles ?? []) {
      await this.sql(
        "insert into public.user_roles (user_id, role_id) select $1, id from public.roles where name = $2 on conflict do nothing",
        [id, role],
      );
    }
    return id;
  }

  async locationId(slug = "madikeri"): Promise<string> {
    const [row] = await this.sql<{ id: string }>("select id from public.locations where slug = $1", [slug]);
    return row.id;
  }

  /** A complete draft owned by `ownerId`, with one photo and one document
   *  finalized through the real upload-session functions. */
  async createCompleteDraft(ownerId: string): Promise<string> {
    const locationId = await this.locationId();
    const [{ id }] = await this.rows<{ id: string }>(
      user(ownerId),
      `insert into public.properties (title, description, property_type, seller_type, price, area_value, area_unit, location_id)
       values ('Coffee estate near Madikeri', $1, 'coffee_estate', 'owner', 25000000, 5, 'acre', $2)
       returning id`,
      ["A well maintained arabica coffee estate with water and road access close to town.", locationId],
    );
    await this.finalizeUpload(ownerId, id, "property_image");
    await this.finalizeUpload(ownerId, id, "property_document");
    return id;
  }

  async finalizeUpload(ownerId: string, propertyId: string, kind: "property_image" | "property_document"): Promise<string> {
    const [created] = await this.rows<{ r: { session_id: string } }>(
      service,
      `select public.upload_session_create($1, $2, $3, $4, 1000, $5, 'file', 'bucket', 20, 600) as r`,
      [ownerId, propertyId, kind, kind === "property_document" ? "rtc" : null,
        kind === "property_image" ? "image/jpeg" : "application/pdf"],
    );
    const [claimed] = await this.rows<{ r: { lease_token: string } }>(
      service,
      "select public.upload_session_claim($1, $2, 120) as r",
      [created.r.session_id, ownerId],
    );
    const id = randomUUID();
    const checksum = "a".repeat(64);
    if (kind === "property_image") {
      await this.rows(service,
        `select public.upload_session_finalize_media($1, $2, $3, $4, 'media', $5, $6, $7, 800, 600, 1000, 20)`,
        [created.r.session_id, ownerId, claimed.r.lease_token, id,
          `properties/${propertyId}/${id}/full.webp`, `properties/${propertyId}/${id}/thumb.webp`, checksum]);
    } else {
      await this.rows(service,
        `select public.upload_session_finalize_document($1, $2, $3, $4, 'documents', $5, $6, 'application/pdf', 1000, 10)`,
        [created.r.session_id, ownerId, claimed.r.lease_token, id, `documents/${propertyId}/${id}.pdf`, checksum]);
    }
    return id;
  }

  async property(id: string): Promise<{ status: string; version: number; current_revision_id: string | null }> {
    const [row] = await this.sql<{ status: string; version: number; current_revision_id: string | null }>(
      "select status, version, current_revision_id from public.properties where id = $1", [id]);
    return row;
  }

  /** Calls transition_property as `actor` with the property's current version
   *  and revision unless overridden. */
  async transition(actor: Actor, propertyId: string, action: string,
    opts: { reason?: string; version?: number; revisionId?: string | null; requestId?: string } = {}) {
    const current = await this.property(propertyId);
    const [row] = await this.rows<{ r: { status: string; version: number; replayed: boolean } }>(
      actor,
      "select public.transition_property($1, $2, $3, $4, $5, null, $6) as r",
      [propertyId, action, opts.version ?? current.version,
        opts.revisionId === undefined ? current.current_revision_id : opts.revisionId,
        opts.reason ?? null, opts.requestId ?? null],
    );
    return row.r;
  }

  /** Drives a listing from draft to verified with a fresh admin. */
  async publish(propertyId: string, ownerId: string, adminId?: string): Promise<void> {
    const admin = adminId ?? (await this.createUser({ roles: ["admin"] }));
    await this.transition(user(ownerId), propertyId, "submit");
    await this.transition(user(admin), propertyId, "begin_review");
    await this.transition(user(admin), propertyId, "approve");
  }
}
