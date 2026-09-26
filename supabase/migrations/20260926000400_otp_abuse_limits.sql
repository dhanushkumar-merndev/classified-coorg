-- Production OTP limits (2026-09-26).
--
-- Short windows are loosened for shared networks (office Wi-Fi, mobile
-- carrier NAT, where many real users share one IP). Daily windows are the
-- abuse ban: a phone, IP or browser that keeps failing or requesting is locked
-- out for up to 24 hours. Rows live 2 days (public.run_maintenance), which covers
-- the longest window here.
insert into app.rate_limit_policies (action, max_hits, window_seconds) values
  ('otp_request_ip', 40, 3600),
  ('otp_request_ip_daily', 150, 86400),
  ('otp_request_fingerprint_daily', 20, 86400),
  ('otp_verify_ip', 60, 900),
  ('otp_verify_phone_daily', 20, 86400)
on conflict (action) do update set max_hits = excluded.max_hits, window_seconds = excluded.window_seconds;
