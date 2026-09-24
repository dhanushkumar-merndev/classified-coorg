// Structured server logging with redaction (architecture §27, GAP-24).
// Never log OTPs, tokens, keys, signed URLs or document contents.

const SENSITIVE_KEY = /otp|token|secret|password|authorization|cookie|signature|apikey|api_key|authkey|key_id|access_key/i;
const SIGNED_URL = /([?&](X-Amz-[A-Za-z-]+|signature|token)=)[^&\s"]+/gi;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[depth]";
  if (typeof value === "string") {
    return value.replace(SIGNED_URL, "$1[redacted]").replace(JWT, "[jwt]");
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redact(value.message, depth + 1),
      ...(value.cause !== undefined ? { cause: redact(value.cause, depth + 1) } : {}),
    };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1)]),
    );
  }
  return value;
}

function write(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...(redact(fields) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, fields: Record<string, unknown> = {}) => write("info", event, fields),
  warn: (event: string, fields: Record<string, unknown> = {}) => write("warn", event, fields),
  error: (event: string, fields: Record<string, unknown> = {}) => write("error", event, fields),
};
