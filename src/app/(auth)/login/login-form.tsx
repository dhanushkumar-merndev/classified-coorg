"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { requestOtpAction, startLoginAction, verifyOtpAction, verifyWidgetCodeAction, verifyWidgetLoginAction } from "./actions";
import { browserFingerprint } from "@/components/auth/browser-fingerprint";
import { WidgetError, widgetRetry, widgetRetrySeconds, widgetSend, widgetVerify } from "@/components/auth/msg91-widget";
import { useAccount } from "@/components/providers/account-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

// AUTH-001..007: phone → one-time code → session. Real numbers use the MSG91
// widget (MSG91 sends and checks the code, the server re-verifies its token);
// staging test numbers use Supabase-issued codes. Errors name the next action
// (design §25); the resend timer mirrors the provider cooldown.

const INVALID_CODE = "That code is incorrect or has expired. Check the SMS or request a new code.";
const SEND_FAILED = "We could not send the code. Please try again shortly.";
/** True when this document itself was loaded at /login (not reached by an
 *  in-app navigation, which keeps the previous page's CSP). */
function documentLoadedAtLogin(): boolean {
  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (!entry) return true;
  try { return new URL(entry.name).pathname === "/login"; } catch { return true; }
}

/** Friendly text for a widget failure; MSG91's own wording shown in development. */
function widgetMessage(error: unknown, fallback: string): string {
  const raw = error instanceof WidgetError ? error.message : "";
  if (/limit|too many|exceed/i.test(raw)) return "Too many code requests. Please wait before trying again.";
  if (/did not respond/i.test(raw)) return "The SMS service did not respond. Please try again.";
  if (/could not be reached|did not load/i.test(raw)) {
    return "Your browser blocked our SMS service. If you use Brave or an ad blocker, allow this site and try again.";
  }
  return process.env.NODE_ENV === "production" || !raw ? fallback : `${fallback} (${raw})`;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  const { refresh } = useAccount();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [method, setMethod] = useState<"supabase" | "widget" | "widget-server">("supabase");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeLength, setCodeLength] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const verifying = useRef(false);
  const reqId = useRef<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function finishSession(result: Awaited<ReturnType<typeof verifyOtpAction>>) {
    if (result.error) {
      setError(result.error.code === "OTP_INVALID_OR_EXPIRED" ? INVALID_CODE : result.error.message);
      setCode("");
      return;
    }
    await refresh();
    router.replace(result.data.redirectTo);
    router.refresh();
  }

  function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    startTransition(async () => {
      // Resend on the code screen.
      if (step === "code" && method === "widget-server") {
        const again = await startLoginAction({ phone, fingerprint: await browserFingerprint() });
        if (again.error) {
          setError(again.error.message);
          if (again.error.retryAfterSeconds) setCooldown(again.error.retryAfterSeconds);
          return;
        }
        if (again.data.method === "widget-server") {
          reqId.current = again.data.reqId;
          setCooldown(again.data.resendAfterSeconds);
        }
        return;
      }
      if (step === "code") {
        if (method === "widget") {
          try {
            await widgetRetry(reqId.current);
            setCooldown(widgetRetrySeconds());
          } catch (e) {
            setError(widgetMessage(e, SEND_FAILED));
          }
          return;
        }
        const again = await requestOtpAction({ phone, fingerprint: await browserFingerprint() });
        if (again.error) {
          setError(again.error.message);
          if (again.error.retryAfterSeconds) setCooldown(again.error.retryAfterSeconds);
          return;
        }
        setCooldown(again.data.resendAfterSeconds);
        return;
      }

      const started = await startLoginAction({ phone: phoneInput, fingerprint: await browserFingerprint() });
      if (started.error) {
        setError(started.error.message);
        if (started.error.retryAfterSeconds) setCooldown(started.error.retryAfterSeconds);
        return;
      }
      const start = started.data;
      setPhone(start.phone);
      setMethod(start.method);
      setCode("");
      if (start.method === "supabase") {
        setCodeLength(6);
        setStep("code");
        setCooldown(start.resendAfterSeconds);
        return;
      }
      if (start.method === "widget-server") {
        reqId.current = start.reqId;
        setCodeLength(start.codeLength);
        setStep("code");
        setCooldown(start.resendAfterSeconds);
        return;
      }
      if (!documentLoadedAtLogin()) {
        // MSG91's browser script (captcha on) is allowed by our CSP only on a
        // page loaded at /login. After an in-app navigation the previous
        // page's stricter policy still applies, so load /login properly.
        window.location.reload();
        return;
      }
      try {
        const sent = await widgetSend(start.identifier);
        if (sent.accessToken) {
          // MSG91 verified the number without a code.
          await finishSession(await verifyWidgetLoginAction({ phone: start.phone, accessToken: sent.accessToken, next }));
          return;
        }
        reqId.current = sent.reqId;
        const length = Number((window.getWidgetData?.() as { otpLength?: unknown } | undefined)?.otpLength);
        setCodeLength(length >= 4 && length <= 8 ? length : 6);
        setStep("code");
        setCooldown(widgetRetrySeconds());
      } catch (e) {
        setError(widgetMessage(e, SEND_FAILED));
      }
    });
  }

  function verify(value: string) {
    if (value.length !== codeLength || verifying.current) return;
    verifying.current = true;
    setError(null);
    startTransition(async () => {
      try {
        if (method === "widget-server") {
          await finishSession(await verifyWidgetCodeAction({ phone, reqId: reqId.current ?? "", code: value, next }));
        } else if (method === "widget") {
          let accessToken: string;
          try {
            accessToken = await widgetVerify(value, reqId.current);
          } catch (e) {
            setError(widgetMessage(e, INVALID_CODE));
            setCode("");
            return;
          }
          await finishSession(await verifyWidgetLoginAction({ phone, accessToken, next }));
        } else {
          await finishSession(await verifyOtpAction({ phone, token: value, next }));
        }
      } finally {
        verifying.current = false;
      }
    });
  }

  return (
    <Card className="w-full max-w-md py-8 shadow-[0_8px_24px_-12px_rgba(20,26,22,.16)] [--card-spacing:--spacing(8)]">
      <CardHeader className="space-y-1">
        <h1 className="font-display text-2xl leading-tight">{step === "phone" ? "Log in or sign up" : "Enter the code"}</h1>
        <CardDescription>
          {step === "phone"
            ? "We will send a one-time code to your mobile number."
            : <>Sent to <span className="font-medium text-foreground">{phone.replace(/^\+91/, "+91 ")}</span></>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {step === "phone" ? (
          <form onSubmit={sendCode} className="space-y-5" noValidate>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="phone">Mobile number</FieldLabel>
              <InputGroup>
                <InputGroupAddon><InputGroupText>+91</InputGroupText></InputGroupAddon>
                <InputGroupInput id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" required
                  placeholder="98765 43210" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)}
                  aria-invalid={Boolean(error)} aria-describedby="phone-help" autoFocus />
              </InputGroup>
              <FieldDescription id="phone-help">Indian mobile numbers only.</FieldDescription>
              {error && <FieldError role="alert">{error}</FieldError>}
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={pending || phoneInput.trim().length < 10 || cooldown > 0}>
              {pending ? "Sending code…" : cooldown > 0 ? `Try again in ${cooldown}s` : "Send code"}
            </Button>
          </form>
        ) : (
          <div className="space-y-5">
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="otp">{codeLength}-digit code</FieldLabel>
              <InputOTP id="otp" maxLength={codeLength} value={code} inputMode="numeric" autoComplete="one-time-code" pattern="^[0-9]*$"
                containerClassName="w-full"
                onChange={(v) => { setCode(v); if (v.length === codeLength) verify(v); }} disabled={pending} autoFocus aria-invalid={Boolean(error)}>
                <InputOTPGroup className="w-full gap-2 sm:gap-3">
                  {Array.from({ length: codeLength }, (_, i) => (
                    <InputOTPSlot key={i} index={i} className="h-14 min-w-0 flex-1 rounded-md border bg-card text-xl font-semibold" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {error && <FieldError role="alert">{error}</FieldError>}
            </Field>
            <Button size="lg" className="w-full" onClick={() => verify(code)} disabled={pending || code.length !== codeLength}>
              {pending ? "Verifying…" : "Verify and continue"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <Button variant="ghost" size="sm" onClick={() => { setStep("phone"); setError(null); }}>
                <ArrowLeft /> Change number
              </Button>
              <Button variant="link" size="sm" onClick={() => sendCode()} disabled={pending || cooldown > 0} aria-live="polite">
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
