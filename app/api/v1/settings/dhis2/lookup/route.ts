import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import { searchOrgUnits, searchDataSets, searchDataElements } from "@/lib/dhis2/client";
import { decryptSecret } from "@/lib/dhis2/crypto";
import { getDhis2Config } from "@/lib/dhis2/sync";

// GET /api/v1/settings/dhis2/lookup?type=orgUnits|dataSets|dataElements&query=...&dataSetId=...
// Searches DHIS2 metadata by name using the tenant's already-saved connection settings.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const query = searchParams.get("query") ?? "";
  const dataSetId = searchParams.get("dataSetId") ?? undefined;

  if (type !== "orgUnits" && type !== "dataSets" && type !== "dataElements") {
    return NextResponse.json({ error: "type must be one of orgUnits, dataSets, dataElements" }, { status: 400 });
  }

  const config = await getDhis2Config(session.user.tenantId);
  if (!config) {
    return NextResponse.json({ error: "Save the DHIS2 connection settings before searching." }, { status: 400 });
  }

  const credentials = { baseUrl: config.baseUrl, username: config.username, password: decryptSecret(config.encryptedPassword) };

  try {
    const results =
      type === "orgUnits"
        ? await searchOrgUnits(credentials, query)
        : type === "dataSets"
        ? await searchDataSets(credentials, query)
        : await searchDataElements(credentials, query, dataSetId);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("DHIS2 metadata lookup failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DHIS2 lookup failed" },
      { status: 502 }
    );
  }
}
