# Supabase: database, RLS and Auth setup

## Migrations

| File | Contents |
|---|---|
| `20260924000100_core_schema.sql` | Tables, constraints, indexes, edit-lock and propagation triggers, `app` helper schema |
| `20260924000200_lifecycle_functions.sql` | Listing state machine, enquiries, upload sessions, role/suspension admin, rate limiter, profile provisioning |
| `20260924000300_rls_and_grants.sql` | RLS on every table, deny-by-default grants, RPC allowlists |
| `20260924000400_seed_locations.sql` | Coorg + 8 initial locations |

Apply to a linked project. CLI credentials come from `supabase login`, not
from `.env`:

```bash
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <project-ref>   # prompts for the DB password
pnpm dlx supabase db push
```

Run against staging first. `db push` on production only from reviewed code.

## Tests (no Docker needed)

`pnpm test:db` applies every migration to an in-process Postgres (PGlite) that
emulates Supabase's `anon` / `authenticated` / `service_role` roles, `auth.uid()`
and default grants, then checks RLS per actor, the full transition matrix,
grants/function allowlists and index-backed query plans.

## Auth dashboard settings (not in migrations)

- **Authentication → Providers → Phone**: enabled. SMS provider is replaced by the hook below.
- **Authentication → Hooks → Send SMS**: HTTPS, `https://<site>/api/auth/sms-hook`.
  Copy the generated secret (`v1,whsec_…`) into `SEND_SMS_HOOK_SECRET`.
- **OTP**: length 6, expiry 300 s (PROPOSED, GAP-03).
- **Rate limits**: keep Supabase's built-in SMS and token-verification limits on.
  Per-phone limits are enforced in the hook; per-IP limits in the login action.
- **Data API**: exposed schemas `public` only. Never expose `app`.
- Leave Google and email magic link disabled (post-MVP, AUTH-015).

## Decisions taken as PROPOSED baselines (need Product sign-off)

These follow `test.md` §2 baselines and are easy to change later:

- GAP-01: content editable only in `draft` / `changes_required`; verified listings are not editable.
- GAP-02: public = verified, published, not expired, not deleted, seller active, location active. Sold/archived hidden.
- GAP-03: property types, units, document types, submission requirements (≥1 photo + cover, ≥1 document, title ≥10, description ≥50), upload limits in `src/lib/config/uploads.ts`, India-only mobile numbers.
- GAP-04: phone login grants `buyer`; a named, phone-verified user may self-onboard as `seller`; `agent` only by admin.
- GAP-05: admin manages ordinary users and content; super admin manages admins; no self-promotion/demotion or self-suspension; last active super admin protected; audit logs readable server-side only.
- GAP-08: enquiry parties derived server-side, no self-contact, idempotency key per buyer, 10/hour per buyer.
- GAP-13: owners can soft-delete drafts only; mark-sold and archive by owner or admin (admin needs a reason). Unpublish/restore/override are denied until defined.
- GAP-17: limits in `app.rate_limit_policies` (editable without deploys).

Still BLOCKED (no values invented): listing expiry period, seller/agent inventory quotas, report workflow, retention periods, precise vs approximate public coordinates.
