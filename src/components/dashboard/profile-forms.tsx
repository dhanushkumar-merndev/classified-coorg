"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { becomeSellerAction, requestEmailChangeAction, updateNameAction } from "@/actions/account";
import { useAccount } from "@/components/providers/account-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const nameForm = z.object({ fullName: z.string().trim().min(2, "Enter your full name").max(100, "Keep it under 100 characters") });
const emailForm = z.object({ email: z.email("Enter a valid email address").max(254) });

export function ProfileForms(props: {
  fullName: string; phone: string; email: string | null; pendingEmail: string | null;
  emailConfirmed: boolean; isSeller: boolean; roles: string[];
}) {
  const router = useRouter();
  const { refresh } = useAccount();
  const [pending, start] = useTransition();
  const [pendingEmail, setPendingEmail] = useState(props.pendingEmail);
  const [sellerType, setSellerType] = useState<"owner" | "developer">("owner");

  const name = useForm({ resolver: zodResolver(nameForm), defaultValues: { fullName: props.fullName } });
  const email = useForm({ resolver: zodResolver(emailForm), defaultValues: { email: "" } });

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Your details</CardTitle><CardDescription>Our team uses your name when they call you back.</CardDescription></CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={name.handleSubmit((v) => start(async () => {
            const r = await updateNameAction(v);
            if (r.error) toast.error(r.error.message);
            else { toast.success("Profile updated"); await refresh(); router.refresh(); }
          }))}>
            <Controller name="fullName" control={name.control} render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                <Input id="fullName" autoComplete="name" {...field} aria-invalid={fieldState.invalid} />
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )} />
            <Field>
              <FieldLabel htmlFor="phone">Mobile number</FieldLabel>
              <Input id="phone" value={props.phone} readOnly disabled />
              <FieldDescription>Your login number. It is never shown publicly.</FieldDescription>
            </Field>
            <div className="flex flex-wrap gap-2">{props.roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}</div>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Email for notifications</CardTitle><CardDescription>Optional. We confirm it before sending anything.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {props.emailConfirmed && (
            <Alert><CheckCircle2 /><AlertTitle>Email confirmed</AlertTitle><AlertDescription>You will receive listing and enquiry updates by email.</AlertDescription></Alert>
          )}
          <p className="text-sm">Current: <span className="font-medium">{props.email ?? "No email added"}</span></p>
          {pendingEmail && <p className="text-sm text-muted-foreground">Waiting for confirmation of {pendingEmail}. Check your inbox.</p>}
          <form className="space-y-4" onSubmit={email.handleSubmit((v) => start(async () => {
            const r = await requestEmailChangeAction(v);
            if (r.error) toast.error(r.error.message);
            else { setPendingEmail(r.data.pendingEmail); email.reset(); toast.success("Check your inbox to confirm the address"); }
          }))}>
            <Controller name="email" control={email.control} render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="email">{props.email ? "New email address" : "Email address"}</FieldLabel>
                <Input id="email" type="email" autoComplete="email" {...field} aria-invalid={fieldState.invalid} />
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )} />
            <Button type="submit" variant="outline" disabled={pending}>Send confirmation link</Button>
          </form>
        </CardContent>
      </Card>

      {!props.isSeller && (
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Store className="size-5 text-primary" aria-hidden="true" /> Sell on Land in Coorg</CardTitle>
            <CardDescription>Add seller tools to your account to post properties for verification. Agents are onboarded by our team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={sellerType} onValueChange={(v) => setSellerType(v as "owner" | "developer")} className="flex gap-6">
              <div className="flex items-center gap-2"><RadioGroupItem id="st-owner" value="owner" /><Label htmlFor="st-owner">I am the owner</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem id="st-dev" value="developer" /><Label htmlFor="st-dev">I am a developer</Label></div>
            </RadioGroup>
            <Button disabled={pending || !props.fullName} onClick={() => start(async () => {
              const r = await becomeSellerAction({ sellerType });
              if (r.error) toast.error(r.error.code === "PROFILE_INCOMPLETE" ? "Save your full name first." : r.error.message);
              else { toast.success("Seller tools enabled"); await refresh(); router.push("/dashboard/properties/new"); }
            })}>Become a seller</Button>
            {!props.fullName && <p className="text-sm text-muted-foreground">Save your full name above first.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
