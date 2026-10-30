import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { parsePagination } from "@/lib/pagination";
import type { Prisma, PrescriptionStatus } from "@prisma/client";
import { loadDispensableStock } from "@/lib/stock/availability";
import { lineDrugName, parseStoredLines, resolveLineArticle } from "@/lib/stock/prescription-items";

// The pharmacy queue's three tabs, as stored statuses.
const LIST_STATUSES: PrescriptionStatus[] = ["pending", "validated", "dispensed"];

// GET /api/v1/pharmacy/prescriptions — paged queue: ?status=pending|validated|dispensed,
// ?search= (patient name/IPP), ?id= (one prescription, e.g. a dashboard deep link),
// ?page=, ?pageSize=. Returns per-status counts over the whole tenant for the tiles.
// Every lookup below is bounded by the page: it used to load every prescription ever
// written, then match invoice lines with one LIKE clause per prescription.
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_PHARMACY", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const rawStatus = searchParams.get("status");
    const status = rawStatus && (LIST_STATUSES as string[]).includes(rawStatus) ? (rawStatus as PrescriptionStatus) : null;
    const search = searchParams.get("search")?.trim();
    const id = searchParams.get("id");
    const pagination = parsePagination(searchParams);

    const tenantScope: Prisma.PrescriptionWhereInput = { tenantId: session.user.tenantId };
    const where: Prisma.PrescriptionWhereInput = {
      ...tenantScope,
      ...(id ? { id } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            patient: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { ipp: { contains: search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const [prescriptions, total, statusGroups] = await Promise.all([
      prisma.prescription.findMany({
        where,
        orderBy: { prescribedAt: 'desc' },
        include: { patient: { select: { firstName: true, lastName: true, ipp: true } } },
        skip: pagination.skip,
        take: pagination.take,
      }),
      prisma.prescription.count({ where }),
      prisma.prescription.groupBy({ by: ["status"], where: tenantScope, _count: true }),
    ]);

    const parseItems = parseStoredLines;
    const allLines = prescriptions.flatMap((rx) => parseItems(rx.items));
    // Pre-rule lines are matched by name; current ones (and seed lines) by article id.
    const drugNames = [...new Set(allLines.filter((l) => !("inventoryId" in l)).map(lineDrugName).filter(Boolean))];
    const articleIds = [...new Set(allLines.flatMap((l) => [l.inventoryId, l.drugCode]).filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))];
    const prescriberIds = [...new Set(prescriptions.map((rx) => rx.prescriberId))];
    const rxIds = prescriptions.map((rx) => rx.id);

    // Prescriber names, stock of the drugs on this page, and the invoice lines generated
    // when these prescriptions were validated (sourceId is `${prescriptionId}:${drugCode}`;
    // matched by prefix because the drug code depends on the inventory at validation time).
    const [doctors, inventory, invoiceLines] = await Promise.all([
      prescriberIds.length
        ? prisma.tenantUser.findMany({
            // Tenant-scoped: this used to read every clinical provider of every tenant.
            where: { id: { in: prescriberIds }, tenantId: session.user.tenantId },
            select: { id: true, fullName: true },
          })
        : [],
      drugNames.length || articleIds.length
        ? prisma.medicationInventory.findMany({
            where: {
              isActive: true,
              tenantId: session.user.tenantId,
              OR: [
                ...(articleIds.length ? [{ id: { in: articleIds } }] : []),
                ...drugNames.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })),
              ],
            },
            select: { id: true, name: true, stock: true, unitPrice: true, storageLocationId: true },
          })
        : [],
      rxIds.length
        ? prisma.patientInvoiceLine.findMany({
            where: {
              sourceType: "pharmacy_dispensation",
              OR: rxIds.map((rxId) => ({ sourceId: { startsWith: `${rxId}:` } })),
            },
            include: { invoice: true },
          })
        : [],
    ]);

    const doctorMap = new Map(doctors.map(d => [d.id, d.fullName]));
    const inventoryById = new Map(inventory.map((i) => [i.id, i]));
    const inventoryByName = new Map(inventory.map((i) => [i.name.toLowerCase(), i]));
    // What can really be handed out: non-expired lots of the article's dispensing depot.
    const dispensable = session.user.tenantId ? await loadDispensableStock(session.user.tenantId, inventory) : new Map<string, number>();

    const invoiceLinesByRx = new Map<string, typeof invoiceLines>();
    for (const line of invoiceLines) {
      const rxId = line.sourceId?.split(":")[0];
      if (!rxId) continue;
      const bucket = invoiceLinesByRx.get(rxId) ?? [];
      bucket.push(line);
      invoiceLinesByRx.set(rxId, bucket);
    }

    // We format the prescriptions to match the UI expectations
    const formattedData = prescriptions.map((rx) => {
      const itemsList = parseItems(rx.items);

      // Enrich items with stock status and pricing
      const enrichedItems = itemsList.map((item) => {
        const invItem = resolveLineArticle(item, inventoryById, inventoryByName);
        let stockStatus: 'in_stock' | 'out_of_stock' | 'not_in_inventory' = 'not_in_inventory';
        let inventoryStock = 0;
        let unitPrice: number | null = null;
        let inventoryId: string | null = null;

        if (invItem) {
          inventoryId = invItem.id;
          inventoryStock = dispensable.get(invItem.id) ?? 0;
          unitPrice = invItem.unitPrice ? parseFloat(invItem.unitPrice.toString()) : null;
          // Enough for this line (whole units), not merely "some left".
          const needed = Math.ceil(parseFloat(String(item.quantity)) || 0);
          stockStatus = inventoryStock > 0 && inventoryStock >= needed ? 'in_stock' : 'out_of_stock';
        }

        return {
          ...item,
          stockStatus,
          inventoryStock,
          unitPrice,
          inventoryId
        };
      });

      // Calculate total cost
      const totalCost = enrichedItems.reduce((sum, item) => {
        const qty = parseFloat(String(item.quantity)) || 0;
        const price = item.unitPrice || 0;
        return sum + (qty * price);
      }, 0);

      const invoiceLines = invoiceLinesByRx.get(rx.id) ?? [];
      const invoice = invoiceLines[0]?.invoice ?? null;

      return {
        id: rx.id,
        patientName: `${rx.patient.firstName} ${rx.patient.lastName}`,
        prescriber: doctorMap.get(rx.prescriberId) || `ID: ${rx.prescriberId}`,
        date: rx.prescribedAt,
        status: rx.status === 'pending' ? 'Pending Queue' : rx.status === 'validated' ? 'Validated' : rx.status === 'dispensed' ? 'Dispensed' : 'Cancelled',
        patientId: rx.patientId,
        // Cancellation reason(s), appended to the notes by the status route.
        notes: rx.notes,
        items: itemsList.length || 0,
        itemsData: enrichedItems,
        ipp: rx.patient.ipp,
        totalCost,
        invoiceId: invoice?.id ?? null,
        invoiceStatus: invoice?.status ?? null,
        invoiceTotal: invoice ? Number(invoice.subtotal) : null,
      };
    });

    return NextResponse.json({
      data: formattedData,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      counts: Object.fromEntries(statusGroups.map((g) => [g.status, g._count])),
      success: true,
    });
  } catch (error) {
    console.error("[GET /api/v1/pharmacy/prescriptions]", error);
    return NextResponse.json(
      { error: "Failed to fetch prescriptions", success: false },
      { status: 500 }
    );
  }
}
