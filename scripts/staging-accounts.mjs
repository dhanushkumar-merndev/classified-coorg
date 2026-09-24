#!/usr/bin/env node
// Staging role accounts (one per role) using Supabase test phone numbers.
//
//   node scripts/staging-accounts.mjs            create/refresh + activate
//   node scripts/staging-accounts.mjs teardown   suspend + strip privileged roles
//
// Accounts are created through the real phone-OTP flow (the fixed codes in
// supabase/config.toml [auth.sms.test_otp] mean no SMS is sent), so profile
// provisioning runs exactly as for real users. Roles are granted with the
// secret key. Refuses to run when APP_ENV=production.
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env")) process.loadEnvFile(".env");
if (process.env.APP_ENV === "production") {
  console.error("Refusing to manage test accounts with APP_ENV=production.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishable || !secret) {
  console.error("Missing Supabase URL/keys in .env");
  process.exit(1);
}

// role_id values are fixed by the core migration.
const ACCOUNTS = [
  { key: "SUPER_ADMIN", name: "Staging Super Admin", roles: [5] },
  { key: "ADMIN", name: "Staging Admin", roles: [4] },
  { key: "SELLER", name: "Staging Seller", roles: [2], userType: "owner" },
  { key: "AGENT", name: "Staging Agent", roles: [3], userType: "agent" },
  { key: "BUYER", name: "Staging Buyer", roles: [] },
];
const PRIVILEGED = [2, 3, 4, 5];

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, secret, opts);

async function signIn(phone, otp) {
  const client = createClient(url, publishable, opts);
  const sent = await client.auth.signInWithOtp({ phone });
  if (sent.error) throw new Error(`OTP request failed for ${phone.slice(-4)}: ${sent.error.message}`);
  const { data, error } = await client.auth.verifyOtp({ phone, token: otp, type: "sms" });
  if (error || !data.user) throw new Error(`OTP verify failed for ${phone.slice(-4)}: ${error?.message}`);
  return data.user.id;
}

async function must(result, label) {
  const { error } = await result;
  if (error) throw new Error(`${label}: ${error.message}`);
}

const teardown = process.argv[2] === "teardown";
const summary = [];

for (const account of ACCOUNTS) {
  const phone = process.env[`E2E_${account.key}_PHONE`];
  const otp = process.env[`E2E_${account.key}_OTP`];
  if (!phone || !otp) throw new Error(`Missing E2E_${account.key}_PHONE / _OTP in .env`);
  const id = await signIn(phone, otp);

  if (teardown) {
    await must(service.from("user_roles").delete().eq("user_id", id).in("role_id", PRIVILEGED), "strip roles");
    await must(service.from("profiles").update({
      is_suspended: true, suspended_at: new Date().toISOString(), suspension_reason: "staging account parked",
    }).eq("id", id), "suspend");
    summary.push({ role: account.key.toLowerCase(), phone, state: "suspended" });
    continue;
  }

  await must(service.from("profiles").update({
    full_name: account.name,
    is_suspended: false, suspended_at: null, suspension_reason: null,
    ...(account.userType ? { user_type: account.userType } : {}),
  }).eq("id", id), "activate profile");
  for (const roleId of account.roles) {
    await must(service.from("user_roles").upsert({ user_id: id, role_id: roleId }, { onConflict: "user_id,role_id" }), "grant role");
  }
  summary.push({ role: account.key.toLowerCase(), phone, code: `E2E_${account.key}_OTP in .env` });
}

console.table(summary);
