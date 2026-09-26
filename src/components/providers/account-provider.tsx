"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { createBrowserSupabase } from "@/lib/supabase/browser";

// Client-side view of the signed-in account for chrome (header menu, save
// buttons). Keeps public pages free of server cookie reads so they stay
// cacheable. Never used for authorization: every action re-checks on the server.
//
// supabase-js (~60 KiB gzipped) is loaded only when the browser holds a
// Supabase session cookie, so signed-out visitors never download it. After
// a server-side sign-in the login form calls refresh(), which sees the new
// cookie and loads the client then.

type BrowserSupabase = ReturnType<typeof createBrowserSupabase>;

/** Supabase stores the session in `sb-<project>-auth-token` cookies (split
 *  into `.0`, `.1`, … when large). */
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/;

async function checkHasSession(): Promise<boolean> {
  if (typeof window !== "undefined" && "cookieStore" in window) {
    try {
      const cookies = await (window as unknown as { cookieStore: { getAll: () => Promise<Array<{ name: string }>> } }).cookieStore.getAll();
      return cookies.some((c) => SESSION_COOKIE.test(`${c.name}=`));
    } catch {
      // Fallback if cookieStore fails
    }
  }
  return typeof document !== "undefined" && SESSION_COOKIE.test(document.cookie);
}

const ROLE_BY_ID: Record<number, string> = { 1: "buyer", 2: "seller", 3: "agent", 4: "admin", 5: "super_admin" };

export interface ClientAccount {
  id: string;
  name: string | null;
  phone: string | null;
  roles: string[];
  suspended: boolean;
}

interface AccountState {
  status: "loading" | "anonymous" | "signed-in";
  account: ClientAccount | null;
  refresh: () => Promise<void>;
  hasSaved: boolean;
  isSaved: (propertyId: string) => boolean | undefined;
  watchSaved: (propertyId: string) => void;
  setSaved: (propertyId: string, saved: boolean) => void;
}

const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<Promise<BrowserSupabase> | null>(null);
  const [supabase, setSupabase] = useState<BrowserSupabase | null>(null);
  const [status, setStatus] = useState<AccountState["status"]>("loading");
  const [account, setAccount] = useState<ClientAccount | null>(null);
  const savedSnapshot = useRef<Record<string, boolean>>({});
  const [savedCount, setSavedCount] = useState(0);
  const [saved, setSavedMap] = useState<Record<string, boolean>>({});
  const pending = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    const hasSession = await checkHasSession();
    if (!hasSession) {
      setAccount(null);
      savedSnapshot.current = {};
      setSavedMap({});
      setSavedCount(0);
      setStatus("anonymous");
      return;
    }
    clientRef.current ??= import("@/lib/supabase/browser").then((m) => m.createBrowserSupabase());
    const supabase = await clientRef.current;
    setSupabase(supabase);
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) {
      setAccount(null);
      savedSnapshot.current = {};
      setSavedMap({});
      setSavedCount(0);
      setStatus("anonymous");
      return;
    }
    const [{ data: profile }, { data: roles }, favorites] = await Promise.all([
      supabase.from("profiles").select("full_name, phone, is_suspended").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role_id").eq("user_id", userId),
      supabase.from("favorites").select("property_id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    if (!favorites.error) setSavedCount(favorites.count ?? 0);
    setAccount({
      id: userId,
      name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      suspended: Boolean(profile?.is_suspended),
      roles: (roles ?? []).map((r) => ROLE_BY_ID[r.role_id]).filter(Boolean),
    });
    setStatus("signed-in");
  }, []);

  // Re-check session on mount and whenever the route changes (e.g. after
  // server-action logout → redirect). The root layout never unmounts, so
  // pathname is the only signal that a navigation happened.
  useEffect(() => {
    const init = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(init);
  }, [pathname, refresh]);


  // Once the client is loaded (a session existed), follow its auth events.
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh, supabase]);

  // Batch saved-state lookups for every card on screen into one query.
  const flush = useCallback(async () => {
    timer.current = null;
    const ids = [...pending.current];
    pending.current.clear();
    if (ids.length === 0 || !account || !supabase) return;
    const { data, error } = await supabase.from("favorites").select("property_id").in("property_id", ids.slice(0, 200));
    if (error) return;
    const found = new Set((data ?? []).map((r) => r.property_id));
    const next = { ...savedSnapshot.current, ...Object.fromEntries(ids.filter((id) => savedSnapshot.current[id] === undefined).map((id) => [id, found.has(id)])) };
    savedSnapshot.current = next;
    setSavedMap(next);
  }, [account, supabase]);

  const watchSaved = useCallback(
    (propertyId: string) => {
      if (saved[propertyId] !== undefined) return;
      pending.current.add(propertyId);
      if (!timer.current) timer.current = setTimeout(() => void flush(), 30);
    },
    [flush, saved],
  );

  useEffect(() => {
    if (status === "signed-in" && pending.current.size > 0 && !timer.current) {
      timer.current = setTimeout(() => void flush(), 30);
    }
  }, [flush, status]);

  const value = useMemo<AccountState>(
    () => ({
      status,
      account,
      refresh,
      hasSaved: status === "signed-in" && savedCount > 0,
      isSaved: (id) => (status === "signed-in" ? saved[id] : false),
      watchSaved,
      setSaved: (id, value) => {
        if (savedSnapshot.current[id] === value) return;
        savedSnapshot.current = { ...savedSnapshot.current, [id]: value };
        setSavedCount((count) => Math.max(0, count + (value ? 1 : -1)));
        setSavedMap((prev) => ({ ...prev, [id]: value }));
      },
    }),
    [account, refresh, saved, savedCount, status, watchSaved],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountState {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
}

export function hasRole(account: ClientAccount | null, ...roles: string[]): boolean {
  return Boolean(account && roles.some((r) => account.roles.includes(r)));
}
