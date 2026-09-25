-- Product decision (2026-09-25): at most 2 login-code requests per minute per
-- browser fingerprint (client-side hash combined server-side with request
-- headers), on top of the per-phone and per-IP limits.
insert into app.rate_limit_policies (action, max_hits, window_seconds) values
  ('otp_request_fingerprint', 2, 60)
on conflict (action) do update set max_hits = excluded.max_hits, window_seconds = excluded.window_seconds;
