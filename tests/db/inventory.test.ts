// RLS-001, RLS-007, GAP-22: every exposed object is inventoried, and a new
// table/function without an explicit decision fails CI.
import { beforeAll, describe, expect, test } from "vitest";
import { TestDb, anon, user } from "./harness";

let db: TestDb;
beforeAll(async () => {
  db = await TestDb.create();
});

const ANON_EXECUTABLE = [
  "app.has_any_role",
  "app.is_active_user",
  "app.is_admin",
  "app.listing_visible",
  "public.get_listing_seller",
  "public.location_listing_counts",
];

const AUTHENTICATED_EXECUTABLE = [
  ...ANON_EXECUTABLE,
  "public.admin_add_note",
  "public.admin_change_role",
  "public.admin_dashboard_summary",
  "public.admin_set_featured",
  "public.admin_set_suspension",
  "public.admin_trend",
  "public.arrange_property_media",
  "public.become_seller",
  "public.create_enquiry",
  "public.delete_property_draft",
  "public.ensure_profile",
  "public.list_received_enquiries",
  "public.my_listing_status_counts",
  "public.record_property_view",
  "public.remove_property_document",
  "public.remove_property_media",
  "public.seller_enquiry_counts",
  "public.transition_property",
  "public.update_enquiry_status",
].sort();

// Tables clients may touch at all, and how. Anything else must have no grant.
const CLIENT_TABLE_PRIVILEGES: Record<string, { anon: string[]; authenticated: string[] }> = {
  articles: { anon: ["SELECT"], authenticated: ["SELECT"] },
  enquiries: { anon: [], authenticated: ["SELECT"] },
  favorites: { anon: [], authenticated: ["DELETE", "SELECT"] },
  locations: { anon: ["SELECT"], authenticated: ["SELECT"] },
  notifications: { anon: [], authenticated: ["SELECT"] },
  profiles: { anon: [], authenticated: ["SELECT"] },
  properties: { anon: ["SELECT"], authenticated: ["SELECT"] },
  property_documents: { anon: [], authenticated: ["SELECT"] },
  property_features: { anon: ["SELECT"], authenticated: ["DELETE", "SELECT"] },
  property_media: { anon: ["SELECT"], authenticated: ["SELECT"] },
  property_revisions: { anon: [], authenticated: ["SELECT"] },
  property_slug_history: { anon: ["SELECT"], authenticated: ["SELECT"] },
  property_status_history: { anon: [], authenticated: ["SELECT"] },
  recently_viewed: { anon: [], authenticated: ["DELETE", "SELECT"] },
  roles: { anon: ["SELECT"], authenticated: ["SELECT"] },
  user_roles: { anon: [], authenticated: ["SELECT"] },
  verification_reviews: { anon: [], authenticated: [] }, // column-level only
  admin_notes: { anon: [], authenticated: [] },
  audit_logs: { anon: [], authenticated: [] },
  notification_intents: { anon: [], authenticated: [] },
};

describe("object inventory", () => {
  test("every public table has RLS enabled and a privilege decision", async () => {
    const tables = await db.sql<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r','p') order by 1`);
    expect(tables.filter((t) => !t.relrowsecurity)).toEqual([]);
    expect(tables.map((t) => t.relname).sort()).toEqual(Object.keys(CLIENT_TABLE_PRIVILEGES).sort());
  });

  test("table-level client privileges match the allowlist exactly", async () => {
    const grants = await db.sql<{ table_name: string; grantee: string; privilege_type: string }>(
      `select table_name, grantee, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and grantee in ('anon','authenticated')`);
    for (const [table, expected] of Object.entries(CLIENT_TABLE_PRIVILEGES)) {
      for (const role of ["anon", "authenticated"] as const) {
        const actual = grants
          .filter((g) => g.table_name === table && g.grantee === role)
          .map((g) => g.privilege_type)
          .sort();
        expect({ table, role, actual }).toEqual({ table, role, actual: expected[role] });
      }
    }
  });

  test("private schema objects are not reachable by clients", async () => {
    const rows = await db.sql<{ name: string }>(
      `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'app' and c.relkind = 'r'
         and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('authenticated', c.oid, 'select')
              or has_table_privilege('service_role', c.oid, 'select'))`);
    expect(rows).toEqual([]);
  });

  test("function EXECUTE allowlists per role", async () => {
    const executable = async (role: string) =>
      (await db.sql<{ fn: string }>(
        `select distinct n.nspname || '.' || p.proname as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public','app') and has_function_privilege($1, p.oid, 'execute') order by 1`, [role]))
        .map((r) => r.fn);
    expect(await executable("anon")).toEqual(ANON_EXECUTABLE);
    expect(await executable("authenticated")).toEqual(AUTHENTICATED_EXECUTABLE);
  });

  test("every SECURITY DEFINER function pins search_path", async () => {
    const rows = await db.sql<{ fn: string }>(
      `select n.nspname || '.' || p.proname as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public','app') and p.prosecdef
         and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    expect(rows).toEqual([]);
  });
});

describe("query plans stay proportional to matched rows", () => {
  async function plan(actor: Parameters<TestDb["as"]>[0], query: string): Promise<string> {
    return db.as(actor, async (tx) => {
      await tx.exec("set local enable_seqscan = off");
      const rows = (await tx.query<{ "QUERY PLAN": string }>(`explain ${query}`)).rows;
      return rows.map((r) => r["QUERY PLAN"]).join("\n");
    });
  }

  // With seqscan disabled the planner must still find an index path: that only
  // happens if the RLS/query predicate implies the `where is_listed` partial
  // index predicate. Which listed index wins on an empty table is irrelevant.
  function expectListedIndexPlan(text: string) {
    expect(text).toMatch(/Index.* (using|on) properties_listed_\w+_idx/);
    expect(text).not.toContain("Seq Scan");
    expect(text).not.toContain("listing_visible"); // inlined, not called per row
    expect(text).not.toContain("SubPlan"); // session helpers are InitPlans
  }

  test("anon public feed is served from a listed partial index", async () => {
    expectListedIndexPlan(
      await plan(anon, "select id from public.properties order by published_at desc, id desc limit 24"));
  });

  test("signed-in public feed with the explicit predicate uses a listed partial index", async () => {
    const someone = await db.createUser();
    expectListedIndexPlan(await plan(user(someone),
      `select id from public.properties
       where is_listed and published_at <= now() and (expires_at is null or expires_at > now())
       order by published_at desc, id desc limit 24`));
  });

  test("anon location page is served from a listed partial index", async () => {
    const locationId = await db.locationId();
    expectListedIndexPlan(await plan(anon,
      `select id from public.properties where location_id = '${locationId}'
       order by published_at desc, id desc limit 24`));
  });
});
