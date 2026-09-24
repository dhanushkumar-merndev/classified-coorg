"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { runAction } from "@/lib/api/response";
import { clientIp } from "@/lib/request/client-ip";
import * as auth from "@/services/auth.service";

// Server actions for the phone OTP screens. They return the typed
// {data, error} envelope; the UI renders errors and never sees the OTP.

export async function requestOtpAction(input: { phone: string }) {
  const ip = clientIp(await headers());
  return runAction("auth.requestOtp", () => auth.requestOtp({ phone: input.phone, ip }));
}

export async function verifyOtpAction(input: { phone: string; token: string; next?: string }) {
  const ip = clientIp(await headers());
  return runAction("auth.verifyOtp", () => auth.verifyOtp({ ...input, ip }));
}

export async function signOutAction() {
  await auth.signOut();
  redirect("/");
}
