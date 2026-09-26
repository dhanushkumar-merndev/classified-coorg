import "server-only";
import { z } from "zod";

// Server environment, validated per provider on first use so that, for
// example, missing Tigris credentials do not break login. Values are never
// logged; errors name the missing variables only. See .env.example.

const appSchema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

const smsSchema = z.object({
  SEND_SMS_HOOK_SECRET: z.string().startsWith("v1,whsec_"),
  MSG91_AUTH_KEY: z.string().min(1),
  MSG91_OTP_TEMPLATE_ID: z.string().min(1),
  MSG91_OTP_VARIABLE: z.string().regex(/^[A-Za-z0-9_]+$/).default("otp"),
  SMS_TEST_ALLOWLIST: z.string().default(""),
});

const tigrisSchema = z.object({
  TIGRIS_STORAGE_ACCESS_KEY_ID: z.string().min(1),
  TIGRIS_STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  TIGRIS_STORAGE_ENDPOINT: z.url(),
  TIGRIS_STORAGE_REGION: z.string().min(1).default("auto"),
  TIGRIS_BUCKET_MEDIA: z.string().min(3),
  TIGRIS_BUCKET_DOCUMENTS: z.string().min(3),
  TIGRIS_BUCKET_AVATARS: z.string().min(3),
});

function loader<T extends z.ZodType>(name: string, schema: T): () => z.infer<T> {
  let cached: z.infer<T> | undefined;
  return () => {
    if (cached) return cached;
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ");
      throw new Error(`Invalid or missing ${name} environment variables: ${fields}`);
    }
    cached = parsed.data;
    return cached;
  };
}

export const appEnv = loader("application", appSchema);
export const supabaseEnv = loader("Supabase", supabaseSchema);
export const tigrisEnv = loader("Tigris", tigrisSchema);

export const smsEnv = loader(
  "SMS",
  smsSchema.transform((env) => ({
    ...env,
    allowlist: new Set(env.SMS_TEST_ALLOWLIST.split(",").map((s) => s.trim()).filter(Boolean)),
  })),
);

const hookSchema = z.object({
  SEND_SMS_HOOK_SECRET: z.string().startsWith("v1,whsec_"),
  SMS_TEST_ALLOWLIST: z.string().default(""),
});

export const hookEnv = loader(
  "SMS hook",
  hookSchema.transform((env) => ({
    ...env,
    allowlist: new Set(env.SMS_TEST_ALLOWLIST.split(",").map((s) => s.trim()).filter(Boolean)),
  })),
);

// MSG91 OTP widget: browser sends/verifies, server re-checks the token with
// the authkey. Unset widget id → every number uses Supabase OTP (hook path).
// AUTH_TEST_OTP_PHONES: staging numbers with fixed Supabase test codes
// ([auth.sms.test_otp]); they skip the widget so tests never send real SMS.
const widgetSchema = z.object({
  NEXT_PUBLIC_MSG91_WIDGET_ID: z.string().default(""),
  NEXT_PUBLIC_MSG91_TOKEN_AUTH: z.string().default(""),
  MSG91_AUTH_KEY: z.string().default(""),
  AUTH_TEST_OTP_PHONES: z.string().default(""),
  SMS_TEST_ALLOWLIST: z.string().default(""),
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
});

export const widgetEnv = loader(
  "MSG91 widget",
  widgetSchema.transform((env) => ({
    enabled: Boolean(env.NEXT_PUBLIC_MSG91_WIDGET_ID && env.NEXT_PUBLIC_MSG91_TOKEN_AUTH && env.MSG91_AUTH_KEY),
    // The widget token cannot confirm access tokens; only the account authkey
    // can. Pasting the token into MSG91_AUTH_KEY makes every correct code fail.
    authKeyIsWidgetToken: Boolean(env.MSG91_AUTH_KEY) && env.MSG91_AUTH_KEY === env.NEXT_PUBLIC_MSG91_TOKEN_AUTH,
    widgetId: env.NEXT_PUBLIC_MSG91_WIDGET_ID,
    tokenAuth: env.NEXT_PUBLIC_MSG91_TOKEN_AUTH,
    authKey: env.MSG91_AUTH_KEY,
    testPhones: new Set(env.AUTH_TEST_OTP_PHONES.split(",").map((s) => s.trim()).filter(Boolean)),
    // Outside production our server texts only these numbers (SMS-006); any
    // other number uses the browser widget, which automated tests stub out.
    serverSmsAllowed: (phone: string) =>
      env.APP_ENV === "production" || env.SMS_TEST_ALLOWLIST.split(",").map((s) => s.trim()).includes(phone),
  })),
);
