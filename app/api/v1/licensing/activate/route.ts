import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redeemLicenseForTenant } from "@/lib/tenant-licensing";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const licenseKey = String(body.licenseKey || "").trim();

    if (!licenseKey) {
      return NextResponse.json({ error: "License key is required." }, { status: 400 });
    }

    const result = await redeemLicenseForTenant({
      tenantId: session.user.tenantId,
      rawLicenseKey: licenseKey,
      redeemedByUserId: session.user.id,
    });

    return NextResponse.json({
      message: "Tenant successfully activated.",
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to activate license.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
