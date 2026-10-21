import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { loadDispensableStock } from "@/lib/stock/availability";

// ── GET /api/v1/stock/prescribable ──────────────────────────────────────────
// The articles a prescriber can pick (active, not vaccines), with the units that can be
// dispensed now. Readable with the patient module: prescribers need not access the pharmacy.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_CORE_PATIENT", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "A facility account is required", success: false }, { status: 403 });
    }

    const items = await prisma.medicationInventory.findMany({
      where: { tenantId, isActive: true, vaccineAntigenCode: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, storageLocationId: true },
    });
    const dispensable = await loadDispensableStock(tenantId, items);

    return NextResponse.json({
      data: items.map(({ storageLocationId: _location, ...item }) => ({ ...item, dispensable: dispensable.get(item.id) ?? 0 })),
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/stock/prescribable]", error);
    return NextResponse.json({ error: "Failed to fetch prescribable articles", success: false }, { status: 500 });
  }
}
