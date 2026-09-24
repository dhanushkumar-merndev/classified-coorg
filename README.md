# Land in Coorg — Classified Marketplace

Verified land, coffee-estate and property listings for Coorg/Kodagu.
Next.js 16 (App Router) · TypeScript · Supabase (PostgreSQL + Auth) · private Tigris storage · MSG91 · Brevo · shadcn/ui · Vercel (Mumbai).

## Specification

| File | Purpose |
|---|---|
| `architecture.md` | System design; §45 records how the build implements it |
| `design.md` | Design system and UX (UI uses shadcn/ui only) |
| `test.md` | QA blueprint; §10.1a maps implemented tests to case IDs |
| `continue.md` | Build checklist; §29 is the evidence-backed status |
| `supabase/README.md` | Migrations, Auth dashboard settings, PROPOSED decisions |

## Getting started

```bash
pnpm install
cp .env.example .env        # fill in values; never commit .env
pnpm dev
```

Supabase CLI and Tigris CLI use their own logins (`pnpm dlx supabase login`, `pnpm exec tigris login`), not `.env`.

## Checks

```bash
pnpm test        # unit + database tests; live integration tests run when .env has credentials
pnpm test:db     # migrations + RLS on in-process Postgres (no Docker)
pnpm typecheck
pnpm lint
pnpm build
```

## Layout

```text
supabase/migrations/   schema, RLS/grants, lifecycle functions, seeds
src/proxy.ts           session refresh + optimistic redirects (Next 16 "proxy")
src/lib/auth/          DAL (current actor from DB), phone, safe redirects
src/lib/storage/       Tigris provider, byte validation, image processing, delivery
src/services/          auth, property, upload, SMS (MSG91 + Send SMS hook)
src/app/api/           sms-hook, uploads, documents proxy, media preview
src/app/media/         public approved-photo delivery
tests/db/              PGlite database/RLS tests
tests/integration/     live staging Supabase/Tigris tests
```
