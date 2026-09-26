"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Home, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { completeOnboardingAction } from "@/actions/account";
import { useAccount } from "@/components/providers/account-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet, FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const INTENTS = [
  { value: "buy", icon: Search, title: "I want to buy land", body: "Browse verified estates, save favourites and talk to our team." },
  { value: "owner", icon: Home, title: "I want to sell my land", body: "Post your property. Our team verifies it before it goes live." },
  { value: "developer", icon: Building2, title: "I am a developer", body: "List plots and projects for verification." },
] as const;

const fullName = z.string().trim().min(2, "Enter your full name").max(100, "Keep it under 100 characters");
const withIntent = z.object({ fullName, intent: z.enum(["buy", "owner", "developer"], { error: "Choose one option" }) });
const nameOnly = z.object({ fullName, intent: z.undefined() });

type Values = { fullName: string; intent?: z.infer<typeof withIntent>["intent"] };

export function OnboardingForm({ next, askIntent }: { next?: string; askIntent: boolean }) {
  const router = useRouter();
  const { refresh } = useAccount();
  const [pending, start] = useTransition();
  const form = useForm<Values>({
    resolver: (askIntent ? zodResolver(withIntent) : zodResolver(nameOnly)) as Resolver<Values>,
    defaultValues: { fullName: "", intent: undefined },
  });

  const submit = form.handleSubmit((values) => start(async () => {
    const result = await completeOnboardingAction({ ...values, next });
    if (result.error) {
      form.setError("root", { message: result.error.message });
      return;
    }
    await refresh();
    router.replace(result.data.redirectTo);
    router.refresh();
  }));

  return (
    <Card className="w-full max-w-lg py-8 shadow-[0_8px_24px_-12px_rgba(20,26,22,.16)] [--card-spacing:--spacing(8)]">
      <CardHeader className="space-y-1">
        <h1 className="font-display text-2xl leading-tight">Welcome to Land in Coorg</h1>
        <CardDescription>
          {askIntent ? "Two quick questions to set up your account." : "Tell us your name to finish setting up your account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={submit} noValidate>
          <Controller name="fullName" control={form.control} render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="fullName">Your full name</FieldLabel>
              <Input id="fullName" autoComplete="name" autoFocus {...field} aria-invalid={fieldState.invalid} />
              <FieldDescription>Our team uses it when they call you back.</FieldDescription>
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )} />

          {askIntent && (
            <Controller name="intent" control={form.control} render={({ field, fieldState }) => (
              <FieldSet data-invalid={fieldState.invalid}>
                <FieldLegend variant="label">What brings you here?</FieldLegend>
                <RadioGroup name={field.name} value={field.value ?? ""} onValueChange={field.onChange} aria-invalid={fieldState.invalid}>
                  {INTENTS.map(({ value, icon: Icon, title, body }) => (
                    <FieldLabel key={value} htmlFor={`intent-${value}`}>
                      <Field orientation="horizontal">
                        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                        <FieldContent>
                          <FieldTitle>{title}</FieldTitle>
                          <FieldDescription>{body}</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem id={`intent-${value}`} value={value} />
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
                <FieldDescription>Are you an agent? Our team sets up agent accounts. Contact us and we will add you.</FieldDescription>
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </FieldSet>
            )} />
          )}

          {form.formState.errors.root && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Setting up…" : "Continue"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
