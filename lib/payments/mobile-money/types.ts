export type InitiatePaymentParams = {
  amount: number;
  currency: string;
  phoneNumber: string;
  reference: string; // our Payment.id, used as the merchant-side idempotency/order key
  description: string;
  returnUrl?: string;
  cancelUrl?: string;
  notifyUrl?: string;
};

export type InitiatePaymentResult =
  | { success: true; providerReference: string; redirectUrl?: string; raw: unknown }
  | { success: false; error: string; raw?: unknown };

export type PaymentStatusResult = {
  status: "pending" | "successful" | "failed";
  raw: unknown;
};

export type OrangeMoneyConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string; // decrypted at call time
  merchantKey: string;
  country: string; // e.g. "cm" for Cameroon
};

export type MtnMomoConfig = {
  enabled: boolean;
  subscriptionKey: string; // decrypted at call time
  apiUserId: string;
  apiKey: string; // decrypted at call time
  targetEnvironment: string; // "mtncameroon" in production, "sandbox" for MTN's self-service sandbox
  baseUrl: string; // https://proxy.momoapi.mtn.com in production, https://sandbox.momodeveloper.mtn.com in sandbox
};
