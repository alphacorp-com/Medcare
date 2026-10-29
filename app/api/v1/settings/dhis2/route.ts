import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { encryptSecret } from "@/lib/dhis2/crypto";
import { getDhis2Config, saveDhis2Config } from "@/lib/dhis2/config";
import { requireTenantAdmin } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const config = await getDhis2Config(session.user.tenantId);

  return NextResponse.json({
    baseUrl: config?.baseUrl ?? "",
    username: config?.username ?? "",
    orgUnitId: config?.orgUnitId ?? "",
    dataSetId: config?.dataSetId ?? "",
    enabled: config?.enabled ?? false,
    hasPassword: Boolean(config?.encryptedPassword),
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
    const data = await req.json();
    const { baseUrl, username, password, orgUnitId, dataSetId, enabled } = data as {
      baseUrl: string;
      username: string;
      password?: string;
      orgUnitId: string;
      dataSetId: string;
      enabled: boolean;
    };

    if (!baseUrl || !username || !orgUnitId || !dataSetId) {
      return NextResponse.json(
        { error: "baseUrl, username, orgUnitId and dataSetId are required" },
        { status: 400 }
      );
    }

    const existing = await getDhis2Config(session.user.tenantId);
    const encryptedPassword = password ? encryptSecret(password) : existing?.encryptedPassword;

    if (!encryptedPassword) {
      return NextResponse.json({ error: "password is required on first configuration" }, { status: 400 });
    }

    await saveDhis2Config(
      session.user.tenantId,
      {
        // Whatever else is stored (the legacy per-metric mapping) is kept as it was.
        ...existing,
        baseUrl,
        username,
        encryptedPassword,
        orgUnitId,
        dataSetId,
        enabled: Boolean(enabled),
      },
      session.user.id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating DHIS2 settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
