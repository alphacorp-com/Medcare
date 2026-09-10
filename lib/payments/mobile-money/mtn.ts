import crypto from "crypto";
import type { InitiatePaymentParams, InitiatePaymentResult, MtnMomoConfig, PaymentStatusResult } from "./types";

// MTN MoMo Collections API (https://momodeveloper.mtn.com). Push flow: requestToPay
// triggers a USSD prompt on the payer's phone immediately (no redirect needed), and the
// merchant polls GET .../requesttopay/{referenceId} for the final status. A free
// self-service sandbox is available (npx momo-sandbox) — unlike Orange Money this can be
// tested end-to-end without a live merchant account.

async function getAccessToken(config: MtnMomoConfig): Promise<string> {
  const basicAuth = Buffer.from(`${config.apiUserId}:${config.apiKey}`).toString("base64");
  const res = await fetch(`${config.baseUrl}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MTN MoMo token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("MTN MoMo token response did not include an access_token");
  }
  return data.access_token as string;
}

export async function testMtnConnection(config: MtnMomoConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    await getAccessToken(config);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function initiateMtnPayment(
  config: MtnMomoConfig,
  params: InitiatePaymentParams
): Promise<InitiatePaymentResult> {
  try {
    const accessToken = await getAccessToken(config);
    const referenceId = crypto.randomUUID();

    const res = await fetch(`${config.baseUrl}/collection/v1_0/requesttopay`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Reference-Id": referenceId,
        "X-Target-Environment": config.targetEnvironment,
        "Ocp-Apim-Subscription-Key": config.subscriptionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: String(params.amount),
        currency: params.currency,
        externalId: params.reference,
        payer: { partyIdType: "MSISDN", partyId: params.phoneNumber.replace(/^\+/, "") },
        payerMessage: params.description,
        payeeNote: params.description,
      }),
    });

    if (res.status !== 202) {
      const raw = await res.json().catch(() => null);
      return { success: false, error: raw?.message || `MTN MoMo requestToPay failed (${res.status})`, raw };
    }

    return { success: true, providerReference: referenceId, raw: { referenceId } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function checkMtnPaymentStatus(
  config: MtnMomoConfig,
  referenceId: string
): Promise<PaymentStatusResult> {
  const accessToken = await getAccessToken(config);

  const res = await fetch(`${config.baseUrl}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Target-Environment": config.targetEnvironment,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
    },
  });

  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(raw?.message || `MTN MoMo status check failed (${res.status})`);
  }

  const status = raw?.status === "SUCCESSFUL" ? "successful" : raw?.status === "FAILED" ? "failed" : "pending";
  return { status, raw };
}
