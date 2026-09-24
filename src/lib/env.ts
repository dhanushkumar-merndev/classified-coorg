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
