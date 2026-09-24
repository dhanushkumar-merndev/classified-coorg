import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/env";

/**
 * Supabase client bound to the current user's session cookies. Queries run
 * as that user, so RLS and the database functions decide what is allowed.
 * Use this for everything a user does.
 */
export async function createSessionClient() {
  const env = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; proxy.ts refreshes the session.
        }
      },
    },
  });
}

/**
 * Anonymous client with no session: sees exactly what a signed-out visitor
 * sees under RLS. Use for public reads (search, detail, media eligibility) so
 * the public eligibility predicate is enforced by the database, and the
 * result is safe to cache across users.
 */
export function createPublicClient() {
  const env = supabaseEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Service-role client. Bypasses RLS. Only call after the actor has been
 * authorized in application code, and prefer the server-only database
 * functions (which re-check the actor) over direct table writes.
 */
export function createServiceClient() {
  const env = supabaseEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
