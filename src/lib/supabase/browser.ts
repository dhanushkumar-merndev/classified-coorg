"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser client for client components. Holds only the public URL and
// publishable key; every privilege comes from the user's session and RLS.
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
