import type { InitiatePaymentParams, InitiatePaymentResult, OrangeMoneyConfig } from "./types";

// Orange Money Web Payment / M Payment API (https://developer.orange.com/apis/om-webpay).
// Redirect-based flow: we request a payment_url, the payer completes payment on Orange's
// own page, and Orange calls our notif_url webhook with the final status. There is no
// merchant-initiated status-check endpoint documented for this API — status updates must
// come through the webhook (see app/api/v1/billing/webhooks/orange/route.ts).

async function getAccessToken(config: OrangeMoneyConfig): Promise<string> {
  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const res = await fetch("https://api.orange.com/oauth/v3/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Orange Money OAuth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Orange Money OAuth response did not include an access_token");
  }
  return data.access_token as string;
}

export async function testOrangeConnection(config: OrangeMoneyConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    await getAccessToken(config);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function initiateOrangePayment(
  config: OrangeMoneyConfig,
  params: InitiatePaymentParams
): Promise<InitiatePaymentResult> {
  try {
    const accessToken = await getAccessToken(config);

    const res = await fetch(`https://api.orange.com/orange-money-webpay/${config.country}/v1/webpayment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        merchant_key: config.merchantKey,
        currency: params.currency,
        order_id: params.reference,
        amount: params.amount,
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
        notif_url: params.notifyUrl,
        lang: "fr",
        reference: params.description,
      }),
    });

    const raw = await res.json().catch(() => null);

    if (!res.ok || !raw?.payment_url) {
      return { success: false, error: raw?.message || `Orange Money webpayment request failed (${res.status})`, raw };
    }

    return {
      success: true,
      providerReference: raw.pay_token,
      redirectUrl: raw.payment_url,
      raw,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
