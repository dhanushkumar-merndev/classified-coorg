"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { requestOtpAction, verifyOtpAction } from "./actions";
import { useAccount } from "@/components/providers/account-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

// AUTH-001..007: phone → Supabase-issued OTP → session. Errors name the next
// action (design §25); the resend timer mirrors the server cooldown.

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  const { refresh } = useAccount();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const verifying = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestOtpAction({ phone: step === "phone" ? phoneInput : phone });
      if (result.error) {
        setError(result.error.message);
        if (result.error.retryAfterSeconds) setCooldown(result.error.retryAfterSeconds);
        return;
      }
      setPhone(result.data.phone);
      setStep("code");
      setCode("");
      setCooldown(result.data.resendAfterSeconds);
    });
  }

  function verify(value: string) {
    if (value.length !== 6 || verifying.current) return;
    verifying.current = true;
    setError(null);
    startTransition(async () => {
      const result = await verifyOtpAction({ phone, token: value, next });
      verifying.current = false;
      if (result.error) {
        setError(result.error.code === "OTP_INVALID_OR_EXPIRED"
          ? "That code is incorrect or has expired. Check the SMS or request a new code."
          : result.error.message);
        setCode("");
        return;
      }
      await refresh();
      router.replace(result.data.redirectTo);
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-md rounded-lg py-8 shadow-[0_24px_48px_-24px_rgba(26,36,25,.25)] [--card-spacing:--spacing(8)]">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-3xl">{step === "phone" ? "Log in or sign up" : "Enter the code"}</CardTitle>
        <CardDescription>
          {step === "phone"
            ? "We will send a 6-digit code to your mobile number."
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
              <FieldLabel htmlFor="otp">6-digit code</FieldLabel>
              <InputOTP id="otp" maxLength={6} value={code} inputMode="numeric" autoComplete="one-time-code" pattern="^[0-9]*$"
                onChange={(v) => { setCode(v); if (v.length === 6) verify(v); }} disabled={pending} autoFocus aria-invalid={Boolean(error)}>
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, i) => <InputOTPSlot key={i} index={i} className="size-12 text-lg" />)}
                </InputOTPGroup>
              </InputOTP>
              {error && <FieldError role="alert">{error}</FieldError>}
            </Field>
            <Button size="lg" className="w-full" onClick={() => verify(code)} disabled={pending || code.length !== 6}>
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
        <Alert className="border-none bg-muted/70">
          <ShieldCheck />
          <AlertDescription className="text-xs">
            We never share your number publicly. Sellers only see enquiries you choose to send.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
