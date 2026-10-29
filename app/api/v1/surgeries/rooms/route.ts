import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import { listOperatingRooms } from "@/lib/surgery/references";

// GET /api/v1/surgeries/rooms — the facility's operating rooms (active beds whose room type is
// "SURGICAL"), for the room picker of a surgery.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireModulePermission(session, "MODULE_SURGERY", "read");
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }
  try {
    return NextResponse.json({ data: await listOperatingRooms(session.user.tenantId) });
  } catch (error) {
    console.error("[GET /api/v1/surgeries/rooms]", error);
    return NextResponse.json({ error: "Failed to load operating rooms" }, { status: 500 });
  }
}
