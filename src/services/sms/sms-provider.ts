// Provider abstraction (architecture §44) so MSG91 can be replaced without
// touching the hook or auth logic.

/** How sure we are about a failed send (SMS-003/004). */
export type SmsFailureKind =
  /** Definitely not sent and retrying will not help (bad template, number, key). */
  | "permanent"
  /** Definitely not sent; a later retry may work (429, 5xx before acceptance). */
  | "transient"
  /** Unknown: the provider may have accepted it (timeout, unreadable response). */
  | "ambiguous";

export class SmsSendError extends Error {
  constructor(
    readonly kind: SmsFailureKind,
    readonly providerStatus: number | null,
    message: string,
  ) {
    super(message);
    this.name = "SmsSendError";
  }
}

export interface SmsProvider {
  /** Sends a Supabase-issued OTP. Resolves with the provider's request id on
   *  acceptance; rejects with SmsSendError otherwise. Implementations must
   *  never log the OTP. */
  sendOtp(phoneE164: string, otp: string): Promise<{ providerMessageId: string | null }>;
}
