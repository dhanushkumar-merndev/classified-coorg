import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "";

// Next injects inline scripts for hydration, so script-src keeps 'unsafe-inline'
// (nonce-based CSP would force fully dynamic rendering and disable static caching).
function buildCsp(extra: { script?: string; connect?: string; frame?: string; style?: string; img?: string; worker?: string } = {}) {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} ${extra.script ?? ""}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${extra.style ?? ""}`,
    "font-src 'self' https://fonts.gstatic.com data:",
    `img-src 'self' data: blob: ${extra.img ?? ""}`,
    `connect-src 'self' ${supabaseHost ? `https://${supabaseHost} wss://${supabaseHost}` : ""} https://*.t3.storage.dev https://t3.storage.dev ${extra.connect ?? ""}`,
    ...(extra.frame ? [`frame-src ${extra.frame}`] : []),
    ...(extra.worker ? [`worker-src ${extra.worker}`] : []),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ").replace(/ +/g, " ");
}

const csp = buildCsp();

// Login only: the MSG91 OTP widget and the invisible captcha it runs
// (hCaptcha or reCAPTCHA Enterprise). Its analytics script stays blocked.
const loginCsp = buildCsp({
  script: "https://verify.msg91.com https://verify.phone91.com https://control.msg91.com https://hcaptcha.com https://js.hcaptcha.com https://*.hcaptcha.com https://www.google.com https://www.gstatic.com https://cdnjs.cloudflare.com",
  connect: "https://control.msg91.com https://*.msg91.com https://*.phone91.com https://hcaptcha.com https://*.hcaptcha.com https://www.google.com https://api.db-ip.com https://ipinfo.io",
  frame: "https://hcaptcha.com https://*.hcaptcha.com https://www.google.com https://recaptcha.google.com",
  style: "https://cdnjs.cloudflare.com https://control.msg91.com https://*.hcaptcha.com",
  img: "https://*.msg91.com https://*.hcaptcha.com https://www.gstatic.com",
  // hCaptcha runs its proof-of-work in a blob: worker.
  worker: "'self' blob:",
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Dev only: the temporary HTTPS tunnel used to test real SMS login
  // (hCaptcha refuses localhost). Ignored by production builds.
  allowedDevOrigins: ["upper-electable-chase.ngrok-free.dev"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
        ],
      },
      // Later entries override earlier ones for the same header key.
      { source: "/login", headers: [{ key: "Content-Security-Policy", value: loginCsp }] },
    ];
  },
};

export default nextConfig;
