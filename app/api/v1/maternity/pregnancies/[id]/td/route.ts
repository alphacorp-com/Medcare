import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { findTdAntigen } from "@/lib/maternity/td";
import { loadVaccineStock } from "@/lib/stock/vaccines";

// GET /api/v1/maternity/pregnancies/[id]/td
// What the antenatal visit form needs to record a Td dose: the woman's last Td dose (to
// propose the next rank) and, when the Td antigen is managed in stock, its usable lots.
// Readable with the maternity module alone (the vaccination screens are not required).
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", "read");
  if (!permCheck.ok) return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "A facility account is required" }, { status: 403 });

  const { id } = await context.params;
  try {
    const pregnancy = await prisma.pregnancy.findFirst({ where: { id, tenantId }, select: { patientId: true } });
    if (!pregnancy) return NextResponse.json({ error: "Pregnancy not found" }, { status: 404 });

    const antigen = await findTdAntigen(tenantId);
    if (!antigen) return NextResponse.json({ data: { lastDose: null, managed: false, lots: [] } });
    const [lastDose, stock] = await Promise.all([
      prisma.immunization.findFirst({
        where: { tenantId, patientId: pregnancy.patientId, antigenCode: antigen.code },
        orderBy: [{ doseNumber: "desc" }, { administeredAt: "desc" }],
        select: { doseNumber: true, administeredAt: true },
      }),
      loadVaccineStock(tenantId, antigen.code, new Date()),
    ]);
    return NextResponse.json({ data: { lastDose, managed: stock.managed, lots: stock.lots } });
  } catch (error) {
    console.error("Error loading Td information:", error);
    return NextResponse.json({ error: "Failed to load the Td information" }, { status: 500 });
  }
}
