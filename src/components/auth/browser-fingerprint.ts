"use client";

// Best-effort browser fingerprint for rate limiting login-code requests. Not
// an identity and not stored: the server hashes it together with request
// headers and uses it only as a rate-limit key.

let cached: Promise<string> | null = null;

export function browserFingerprint(): Promise<string> {
  cached ??= compute().catch(() => "");
  return cached;
}

async function compute(): Promise<string> {
  const n = navigator as Navigator & { deviceMemory?: number };
  const parts = [
    n.userAgent, n.language, (n.languages ?? []).join(","), n.platform, n.hardwareConcurrency, n.deviceMemory ?? "",
    n.maxTouchPoints, Intl.DateTimeFormat().resolvedOptions().timeZone, screen.width, screen.height, screen.colorDepth,
    window.devicePixelRatio, canvasSignature(),
  ].join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canvasSignature(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 220;
    canvas.height = 30;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(100, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Land in Coorg ₹ 😃", 2, 15);
    return canvas.toDataURL().slice(-64);
  } catch {
    return "";
  }
}
