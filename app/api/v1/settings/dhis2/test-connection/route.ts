import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { testConnection } from "@/lib/dhis2/client";
import { decryptSecret } from "@/lib/dhis2/crypto";
import { getDhis2Config } from "@/lib/dhis2/sync";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || session.user.role !== "tenant_admin") {
    return NextResponse.json({ error: "Unauthorized - Tenant admin access required" }, { status: 403 });
  }

  try {
    const data = await req.json().catch(() => ({}));
    const { baseUrl, username, password } = data as { baseUrl?: string; username?: string; password?: string };

    let credentials: { baseUrl: string; username: string; password: string };

    if (baseUrl && username && password) {
      // Test an in-progress, not-yet-saved draft of the connection settings.
      credentials = { baseUrl, username, password };
    } else {
      const config = await getDhis2Config(session.user.tenantId);
      if (!config) {
        return NextResponse.json({ error: "No DHIS2 configuration saved yet" }, { status: 400 });
      }
      credentials = { baseUrl: config.baseUrl, username: config.username, password: decryptSecret(config.encryptedPassword) };
    }

    const result = await testConnection(credentials);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("Error testing DHIS2 connection:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
