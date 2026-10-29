import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { parseImagingDevice } from "@/lib/radiology/devices";

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) return { response: NextResponse.json({ error: permCheck.error }, { status: permCheck.status }) };
  return { tenantId: session.user.tenantId };
}

// PATCH /api/v1/settings/imaging-devices/[id] — Body: any of { code, label, modalityItemId, isActive }.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("response" in g) return g.response;
  const { id } = await context.params;
  const parsed = await parseImagingDevice(g.tenantId, await request.json().catch(() => null), { partial: true });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const { count } = await prisma.imagingDevice.updateMany({ where: { id, tenantId: g.tenantId }, data: parsed.value });
    if (count === 0) return NextResponse.json({ error: "Device not found" }, { status: 404 });
    return NextResponse.json(await prisma.imagingDevice.findUnique({ where: { id } }));
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === "P2002") return NextResponse.json({ error: "code_taken" }, { status: 409 });
    console.error("[PATCH /api/v1/settings/imaging-devices/[id]]", error);
    return NextResponse.json({ error: "Failed to update device" }, { status: 500 });
  }
}

// DELETE /api/v1/settings/imaging-devices/[id] — only a device never booked; otherwise deactivate it.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("response" in g) return g.response;
  const { id } = await context.params;
  const used = await prisma.examRequest.count({ where: { tenantId: g.tenantId, deviceId: id } });
  if (used > 0) return NextResponse.json({ error: "device_in_use" }, { status: 409 });
  const { count } = await prisma.imagingDevice.deleteMany({ where: { id, tenantId: g.tenantId } });
  if (count === 0) return NextResponse.json({ error: "Device not found" }, { status: 404 });
  return NextResponse.json({ removed: true });
}
