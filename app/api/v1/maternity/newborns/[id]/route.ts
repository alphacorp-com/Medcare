import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { parseNewbornUpdate } from "@/lib/maternity/input";

// PATCH /api/v1/maternity/newborns/[id]
// Body (every field optional): { kangarooCare?, incubatorCare?, died?: boolean, diedAt?,
// deathCause?, deathReviewedAt? } — neonatal follow-up after the birth was registered (RMA3
// II.1.4-007 to 023). A death within 28 days of the birth turns the outcome into
// "neonatal_death"; died: false (a correction) turns it back to "alive".
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permCheck = requireModulePermission(session, "MODULE_MATERNITY", "update");
  if (!permCheck.ok) return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "A facility account is required" }, { status: 403 });

  const { id } = await context.params;
  try {
    const newborn = await prisma.newborn.findFirst({
      where: { id, tenantId },
      select: { id: true, outcome: true, diedAt: true, delivery: { select: { deliveryDate: true } } },
    });
    if (!newborn) return NextResponse.json({ error: "Newborn not found" }, { status: 404 });
    if (!newborn.delivery.deliveryDate) return NextResponse.json({ error: "delivery_not_completed", code: "delivery_not_completed" }, { status: 409 });

    const parsed = parseNewbornUpdate(await req.json().catch(() => null), newborn.delivery.deliveryDate, newborn);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: parsed.error }, { status: 400 });
    const { death, ...rest } = parsed.value;

    const updated = await prisma.newborn.update({
      where: { id },
      data: {
        ...rest,
        ...(death === undefined
          ? {}
          : death === null
            ? { outcome: "alive", diedAt: null, deathCause: null, deathReviewedAt: null }
            : { outcome: "neonatal_death", diedAt: death.diedAt, deathCause: death.deathCause }),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating newborn:", error);
    return NextResponse.json({ error: "Failed to update the newborn" }, { status: 500 });
  }
}
