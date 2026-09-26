# Remember before launch

## Production setup (2026-09-26)
- Vercel project `landincoorg` (team "Dhanush", **Hobby** plan) → https://landincoorg.vercel.app, region `bom1`.
- Supabase production project `land-in-coorg-prod` (`bbgwsiwushzetifyugoi`, Mumbai). The old project (`gtwzpyzdfowmfmlxycfl`) is **staging** only: tests, test accounts and fixed test OTP codes live there.
- Production secrets are in `.env.production.local` (gitignored). Never commit or paste it.
- Run Supabase commands against production with `node scripts/supabase-prod.mjs db push` / `config push`. It builds a production config with no `[auth.sms.test_otp]` and leaves the repo's staging link alone. After adding a migration, push it to **both** projects.
- Vercel env vars are production-only (no Preview vars, so preview deploys would not reach the production DB). Test-only vars (`AUTH_TEST_OTP_PHONES`, `SMS_TEST_ALLOWLIST`, `E2E_*`) are deliberately **not** set.
- `.vercelignore` keeps `.env*` out of CLI uploads.
- Hobby allows crons only once a day, so notifications are delivered right after the action that creates them (`deliverNotificationsSoon()` via `after()`), and the daily cron sweeps up anything left.

## Still to do
- [x] Tigris production buckets and scoped key created, 5 Tigris vars set on Vercel (2026-09-26)
- [x] MSG91 widget: Captcha Validation **off**, Invisible OTP **off** (verified via API 2026-09-26)
- [ ] First production deploy (`npx vercel deploy --prod`)
- [ ] Log in on production with your number, then grant yourself `super_admin`
- [ ] Real OTP test on production
- [ ] Set `NEXT_PUBLIC_CONTACT_PHONE` (business number) on Vercel so listings show Call / WhatsApp, then redeploy
- [ ] Have the 5 seeded buying guides reviewed by someone who knows Karnataka land law
- [ ] Optional: connect the GitHub repo in Vercel so every push to `main` deploys

### Tigris production buckets (done)
Created with the Tigris CLI (`npx @tigrisdata/cli`). Match staging: private, location `sin`, snapshots on, object ACLs off.
- Buckets: `landincoorg-prod-media`, `landincoorg-prod-documents`, `landincoorg-prod-avatars`
- CORS on each: origin `https://landincoorg.vercel.app`, method `PUT`, header `Content-Type` (add the custom domain later if you get one)
- Access key `landincoorg-prod-app`: ReadWrite on those three buckets only
- Put the values in `.env.production.local` as `PROD_TIGRIS_STORAGE_ACCESS_KEY_ID`, `PROD_TIGRIS_STORAGE_SECRET_ACCESS_KEY`, `PROD_TIGRIS_BUCKET_MEDIA`, `PROD_TIGRIS_BUCKET_DOCUMENTS`, `PROD_TIGRIS_BUCKET_AVATARS`

## Rate limits
Production has the real values from the migrations (verified 2026-09-26). Clearing counters (`delete from app.rate_limits`, `pnpm e2e:reset`) is **staging only**: never run it on production.

| action | max hits | window |
|---|---|---|
| otp_request_fingerprint | 2 | 60 s |
| otp_send_phone_cooldown | 1 | 60 s |
| otp_send_phone_hourly | 5 | 1 h |
| otp_send_phone_daily | 10 | 24 h |
| otp_request_ip | 20 | 1 h |
| otp_verify_phone | 5 | 15 min |
| otp_verify_ip | 30 | 15 min |
| enquiry_create | 10 | 1 h |
| property_create | 10 | 24 h |
| upload_initiate | 60 | 1 h |
| document_read | 120 | 1 h |

Watch: Supabase Auth's own `sign_in_sign_ups` limit (30 per 5 min per IP) sees our server's IP for widget logins. If logins start failing at busy times, raise it in `supabase/config.toml` and run `config push` on production.

## Login (MSG91 widget)
- MSG91 (not Supabase) verifies codes for real numbers (continue.md §34). `SEND_SMS_HOOK_SECRET` is set on production. The Supabase SMS hook is only a fallback, and it won't send until `MSG91_OTP_TEMPLATE_ID` is set.
- If you get a custom domain: update `NEXT_PUBLIC_SITE_URL` on Vercel, `PROD_SITE_URL` in `.env.production.local`, run `config push` on production, and add the domain to the Tigris CORS rules.
