import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { clientFeatures } from "@/lib/features";

// GET /api/v1/settings/features — which optional settings sections this deployment shows
// (environment switches, lib/features). Read at run time: no rebuild to change them.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(clientFeatures());
}
