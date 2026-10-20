import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ── GET /api/v1/discharges ──────────────────────────────────────────────────
// Hospitalised patients, for the "Sorties" page.
// Query params:
//   view  – "pending" (default): hospitalised (deposit paid or waived) and still in their
//           bed, i.e. those a doctor can discharge; "done": hospitalised stays that have
//           ended (discharged, transferred, deceased).
//   q     – search on patient last/first name, IPP or stay number
//   page, limit – pagination (limit max 100)
// Each row carries the hospitalisation bill's state so the doctor sees whether a balance is
// still owed (longer stay than planned) or a refund is due after the regularisation.
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_ADMISSION", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const tenantId = session.user.tenantId;
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") === "done" ? "done" : "pending";
    const q = searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    const where: Prisma.StayWhereInput = {
      tenantId,
      hospitalizationStatus: "admitted",
      ...(view === "pending"
        ? { status: "in_progress" }
        : { status: { in: ["discharged", "transferred", "deceased"] } }),
      ...(q
        ? {
            OR: [
              { stayNumber: { contains: q, mode: "insensitive" } },
              { patient: { lastName: { contains: q, mode: "insensitive" } } },
              { patient: { firstName: { contains: q, mode: "insensitive" } } },
              { patient: { ipp: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [stays, total] = await Promise.all([
      prisma.stay.findMany({
        where,
        orderBy: view === "pending" ? [{ hospitalizedAt: "asc" }, { id: "asc" }] : [{ dischargeDate: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          stayNumber: true,
          status: true,
          hospitalizedAt: true,
          dischargeDate: true,
          hospitalizationBedId: true,
          hospitalizationDepartmentId: true,
          patient: { select: { id: true, firstName: true, lastName: true, ipp: true } },
        },
      }),
      prisma.stay.count({ where }),
    ]);

    const ids = (values: (string | null)[]) => Array.from(new Set(values.filter((value): value is string => Boolean(value))));
    const [beds, departments, lines] = await Promise.all([
      prisma.bed.findMany({
        where: { tenantId, id: { in: ids(stays.map((stay) => stay.hospitalizationBedId)) } },
        select: { id: true, label: true, roomTypeId: true },
      }),
      prisma.department.findMany({
        where: { tenantId, id: { in: ids(stays.map((stay) => stay.hospitalizationDepartmentId)) } },
        select: { id: true, name: true },
      }),
      prisma.patientInvoiceLine.findMany({
        where: { tenantId, sourceType: "hospitalization", sourceId: { in: stays.map((stay) => stay.id) } },
        select: {
          sourceId: true,
          invoice: { select: { id: true, status: true, patientAmount: true, paidAmount: true } },
        },
      }),
    ]);
    const rooms = await prisma.referenceCatalogItem.findMany({
      where: { tenantId, id: { in: ids(beds.map((bed) => bed.roomTypeId)) } },
      select: { id: true, nameFr: true },
    });

    const bedById = new Map(beds.map((bed) => [bed.id, bed]));
    const roomById = new Map(rooms.map((room) => [room.id, room.nameFr]));
    const departmentById = new Map(departments.map((department) => [department.id, department.name]));
    const invoiceByStay = new Map(lines.map((line) => [line.sourceId, line.invoice]));

    const data = stays.map((stay) => {
      const bed = stay.hospitalizationBedId ? bedById.get(stay.hospitalizationBedId) : undefined;
      const invoice = invoiceByStay.get(stay.id);
      const owed = invoice ? Number(invoice.patientAmount) : 0;
      const paid = invoice ? Number(invoice.paidAmount) : 0;
      return {
        id: stay.id,
        stayNumber: stay.stayNumber,
        status: stay.status,
        hospitalizedAt: stay.hospitalizedAt,
        dischargeDate: stay.dischargeDate,
        patient: stay.patient,
        departmentName: stay.hospitalizationDepartmentId ? departmentById.get(stay.hospitalizationDepartmentId) ?? null : null,
        bedLabel: bed?.label ?? null,
        roomLabel: bed?.roomTypeId ? roomById.get(bed.roomTypeId) ?? null : null,
        billing:
          invoice && invoice.status !== "cancelled"
            ? { invoiceId: invoice.id, outstanding: Math.max(0, owed - paid), refundDue: Math.max(0, paid - owed) }
            : null,
      };
    });

    return NextResponse.json({ data, total, page, limit, success: true });
  } catch (error) {
    console.error("[GET /api/v1/discharges]", error);
    return NextResponse.json({ error: "Failed to fetch discharges", success: false }, { status: 500 });
  }
}
