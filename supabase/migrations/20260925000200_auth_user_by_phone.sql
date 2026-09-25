-- MSG91 widget login: after the server confirms a phone with MSG91, it looks the
-- Auth user up by phone. auth.users.phone is unique-indexed, so this is an
-- index probe regardless of table size (never a listUsers scan). Service role only.

create or replace function public.auth_user_id_by_phone(p_phone text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where u.phone = p_phone limit 1;
$$;

revoke all on function public.auth_user_id_by_phone(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_phone(text) to service_role;
