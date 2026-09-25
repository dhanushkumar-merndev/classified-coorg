# Remember before launch

## Add the rate limits back
Rate limits are relaxed/cleared for testing on staging. Before going live, restore the real values and make sure nothing is disabled.

Real policy values (`app.rate_limit_policies`, from `supabase/migrations/20260924000100_core_schema.sql`):

| action | max hits | window |
|---|---|---|
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

Checklist:
- [ ] `select * from app.rate_limit_policies` on production matches the table above
- [ ] No test-only bypass or raised limit left in any migration or function
- [ ] Clearing counters (`delete from app.rate_limits`) was staging-only, never run on production
- [ ] Re-run the rate-limit tests (integration + e2e) against the final config

## Login (MSG91 widget)
- [ ] `AUTH_TEST_OTP_PHONES` empty in production (and remove `[auth.sms.test_otp]`)
- [ ] `SMS_TEST_ALLOWLIST` empty in production
- [ ] In the MSG91 widget settings, confirm OTP length, resend limits and captcha; add the production domain if the widget restricts domains
- [ ] Review the decision that MSG91 (not Supabase) verifies codes for real numbers (continue.md §34)

## Broker model
- [ ] Set `NEXT_PUBLIC_CONTACT_PHONE` (your business number) so listings show Call / WhatsApp
- [ ] Decide MSG91 widget captcha: off = server-side login works in every browser (our SMS limits apply); on = browser widget (blocked by Brave/ad blockers)

## Other test-only settings to undo
- [ ] Remove `[auth.sms.test_otp]` fixed codes from `supabase/config.toml` and push auth config
- [ ] `node scripts/staging-accounts.mjs teardown`
- [ ] Point the SMS hook URI at the production URL — it currently points at a temporary ngrok tunnel (`*.ngrok-free.dev`), which stops working when ngrok stops; set `MSG91_OTP_TEMPLATE_ID`
- [ ] Have the 5 seeded buying guides reviewed by someone who knows Karnataka land law
- [ ] Set production CORS origin and `CRON_SECRET`
