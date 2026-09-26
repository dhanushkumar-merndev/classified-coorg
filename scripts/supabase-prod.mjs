#!/usr/bin/env node
// Runs a Supabase CLI command against the PRODUCTION project without touching
// the repo's staging link or config:
//   node scripts/supabase-prod.mjs db push
//   node scripts/supabase-prod.mjs config push
// Builds .scratch/supabase-prod/supabase with the repo's migrations and a
// production config.toml: no [auth.sms.test_otp] fixed codes, production
// site URL, SMS hook pointed at the production app. Secrets come from
// .env.production.local (gitignored) and are never printed.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.production.local"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
for (const k of ["PROD_PROJECT_REF", "PROD_SITE_URL", "PROD_DB_PASSWORD", "PROD_SEND_SMS_HOOK_SECRET"]) {
  if (!env[k]) throw new Error(`${k} missing from .env.production.local`);
}

const work = resolve(root, ".scratch/supabase-prod");
const dir = resolve(work, "supabase");
mkdirSync(dir, { recursive: true });
rmSync(resolve(dir, "migrations"), { force: true, recursive: true });
symlinkSync(resolve(root, "supabase/migrations"), resolve(dir, "migrations"));

const lines = readFileSync(resolve(root, "supabase/config.toml"), "utf8").split("\n");
const out = [];
let skipping = false;
for (const line of lines) {
  if (line.trim() === "[auth.sms.test_otp]") { skipping = true; continue; }
  if (skipping && (line.trim() === "" || line.trim().startsWith("["))) skipping = false;
  if (skipping) continue;
  out.push(line);
}
const config = out.join("\n")
  .replace(/^site_url = .*$/m, `site_url = "${env.PROD_SITE_URL}"`)
  .replace(/^additional_redirect_urls = .*$/m, `additional_redirect_urls = ["${env.PROD_SITE_URL}"]`);
if (/test_otp\s*\]/.test(config) || config.includes("localhost:3000")) throw new Error("production config still has test settings");
writeFileSync(resolve(dir, "config.toml"), config);

const run = (args) => {
  const r = spawnSync("npx", ["--yes", "supabase", ...args, "--workdir", work], {
    stdio: "inherit",
    env: {
      ...process.env,
      SUPABASE_DB_PASSWORD: env.PROD_DB_PASSWORD,
      SEND_SMS_HOOK_SECRET: env.PROD_SEND_SMS_HOOK_SECRET,
      SUPABASE_SEND_SMS_HOOK_URI: `${env.PROD_SITE_URL}/api/auth/sms-hook`,
    },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!existsSync(resolve(dir, ".temp/project-ref")) || readFileSync(resolve(dir, ".temp/project-ref"), "utf8").trim() !== env.PROD_PROJECT_REF) {
  run(["link", "--project-ref", env.PROD_PROJECT_REF]);
}
run(process.argv.slice(2));
