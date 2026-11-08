import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { encryptSecret } from "@/lib/dhis2/crypto";
import { getDhis2Config, saveDhis2Config } from "@/lib/dhis2/config";
import { requireTenantAdmin } from "@/lib/permissions";
import { safeExternalUrl } from "@/lib/safe-url";
import { DHIS2_UID } from "@/lib/dhis2/rma3-export";

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
    const { baseUrl, username, password, orgUnitId: orgUnitId_, dataSetId: dataSetId_, enabled } = data as {
      baseUrl: string;
      username: string;
      password?: string;
      orgUnitId?: string;
      dataSetId?: string;
      enabled?: boolean;
    };

    // The connection comes first: the organisation unit and data set are searched by name through
    // the SAVED connection (lookup route), so they cannot be required to save it. They stay empty
    // until chosen; without them nothing is sent (dhis2_target_missing) and auto-send stays off.
    if (!baseUrl || !username) {
      return NextResponse.json({ error: "baseUrl and username are required" }, { status: 400 });
    }
    const orgUnitId = (orgUnitId_ ?? "").trim();
    const dataSetId = (dataSetId_ ?? "").trim();
    if ((orgUnitId && !DHIS2_UID.test(orgUnitId)) || (dataSetId && !DHIS2_UID.test(dataSetId))) {
      return NextResponse.json({ error: "orgUnitId and dataSetId must be DHIS2 identifiers" }, { status: 400 });
    }
    if (enabled && (!orgUnitId || !dataSetId)) {
      return NextResponse.json({ error: "orgUnitId and dataSetId are required to enable the automatic send" }, { status: 400 });
    }

    // The server calls this URL with the account's credentials: only a plain http(s) URL.
    const safeBaseUrl = safeExternalUrl(baseUrl);
    if (!safeBaseUrl) {
      return NextResponse.json({ error: "baseUrl must be a valid http(s) URL" }, { status: 400 });
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
        baseUrl: safeBaseUrl.replace(/\/+$/, ""),
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
