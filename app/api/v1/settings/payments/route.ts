import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import { encryptSecret } from "@/lib/payments/crypto";
import { getMobileMoneyConfig, saveMobileMoneyConfig, MobileMoneyStoredConfig } from "@/lib/payments/config";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const config = await getMobileMoneyConfig(session.user.tenantId);

  return NextResponse.json({
    orange: config?.orange
      ? {
          enabled: config.orange.enabled,
          clientId: config.orange.clientId,
          merchantKey: config.orange.merchantKey,
          country: config.orange.country,
          hasClientSecret: Boolean(config.orange.encryptedClientSecret),
        }
      : null,
    mtn: config?.mtn
      ? {
          enabled: config.mtn.enabled,
          apiUserId: config.mtn.apiUserId,
          targetEnvironment: config.mtn.targetEnvironment,
          baseUrl: config.mtn.baseUrl,
          hasSubscriptionKey: Boolean(config.mtn.encryptedSubscriptionKey),
          hasApiKey: Boolean(config.mtn.encryptedApiKey),
        }
      : null,
  });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  try {
    const body = await req.json();
    const { orange, mtn } = body as {
      orange?: {
        enabled: boolean;
        clientId: string;
        clientSecret?: string;
        merchantKey: string;
        country: string;
      } | null;
      mtn?: {
        enabled: boolean;
        subscriptionKey?: string;
        apiUserId: string;
        apiKey?: string;
        targetEnvironment: string;
        baseUrl: string;
      } | null;
    };

    const existing = await getMobileMoneyConfig(session.user.tenantId);

    const nextConfig: MobileMoneyStoredConfig = {
      orange: null,
      mtn: null,
    };

    if (orange) {
      const encryptedClientSecret = orange.clientSecret
        ? encryptSecret(orange.clientSecret)
        : existing?.orange?.encryptedClientSecret;
      if (!encryptedClientSecret) {
        return NextResponse.json({ error: "Orange Money client secret is required on first configuration" }, { status: 400 });
      }
      nextConfig.orange = {
        enabled: Boolean(orange.enabled),
        clientId: orange.clientId,
        encryptedClientSecret,
        merchantKey: orange.merchantKey,
        country: orange.country || "cm",
      };
    }

    if (mtn) {
      const encryptedSubscriptionKey = mtn.subscriptionKey
        ? encryptSecret(mtn.subscriptionKey)
        : existing?.mtn?.encryptedSubscriptionKey;
      const encryptedApiKey = mtn.apiKey ? encryptSecret(mtn.apiKey) : existing?.mtn?.encryptedApiKey;
      if (!encryptedSubscriptionKey || !encryptedApiKey) {
        return NextResponse.json({ error: "MTN MoMo subscription key and API key are required on first configuration" }, { status: 400 });
      }
      nextConfig.mtn = {
        enabled: Boolean(mtn.enabled),
        encryptedSubscriptionKey,
        apiUserId: mtn.apiUserId,
        encryptedApiKey,
        targetEnvironment: mtn.targetEnvironment || "mtncameroon",
        baseUrl: mtn.baseUrl || "https://proxy.momoapi.mtn.com",
      };
    }

    await saveMobileMoneyConfig(session.user.tenantId, nextConfig, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating payment settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
