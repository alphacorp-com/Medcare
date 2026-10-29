import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { parseImagingDevice } from "@/lib/radiology/devices";

// GET /api/v1/settings/imaging-devices — every device of the facility (active or not), with its
// modality label. Readable by any member (the radiology booking picks from it).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = session.user.tenantId;
  const [devices, modalities] = await Promise.all([
    prisma.imagingDevice.findMany({ where: { tenantId }, orderBy: { code: "asc" } }),
    prisma.referenceCatalogItem.findMany({ where: { tenantId, catalogType: "imaging_type" }, select: { id: true, code: true, nameFr: true } }),
  ]);
  const modalityById = new Map(modalities.map((m) => [m.id, m]));
  return NextResponse.json({
    data: devices.map((d) => ({ ...d, modality: d.modalityItemId ? modalityById.get(d.modalityItemId) ?? null : null })),
    modalities,
  });
}

// POST /api/v1/settings/imaging-devices — Body: { code, label, modalityItemId? }. Administrator only.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }
  const parsed = await parseImagingDevice(session.user.tenantId, await request.json().catch(() => null), { partial: false });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    // Not partial: code and label were checked present.
    const device = await prisma.imagingDevice.create({
      data: { tenantId: session.user.tenantId, code: parsed.value.code!, label: parsed.value.label!, modalityItemId: parsed.value.modalityItemId ?? null },
    });
    return NextResponse.json(device, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "code_taken" }, { status: 409 });
    }
    console.error("[POST /api/v1/settings/imaging-devices]", error);
    return NextResponse.json({ error: "Failed to create device" }, { status: 500 });
  }
}
