import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { BillingInvoiceStatus } from "@prisma/client";

// GET /api/v1/billing — list invoices for the tenant (search + status filter)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_BILLING", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as BillingInvoiceStatus | null;
    const search = searchParams.get("search")?.trim();

    const invoices = await prisma.patientInvoice.findMany({
      where: {
        tenantId: session.user.tenantId,
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
      },
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { firstName: true, lastName: true, ipp: true } },
        stay: { select: { stayNumber: true } },
        _count: { select: { lines: true } },
      },
    });

    const data = invoices.map((invoice) => ({
      id: invoice.id,
      patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
      ipp: invoice.patient.ipp,
      stayNumber: invoice.stay?.stayNumber ?? null,
      status: invoice.status,
      subtotal: Number(invoice.subtotal),
      insuranceAmount: Number(invoice.insuranceAmount),
      patientAmount: Number(invoice.patientAmount),
      paidAmount: Number(invoice.paidAmount),
      currency: invoice.currency,
      lineCount: invoice._count.lines,
      createdAt: invoice.createdAt,
    }));

    return NextResponse.json({ data, total: data.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/billing]", error);
    return NextResponse.json({ error: "Failed to fetch invoices", success: false }, { status: 500 });
  }
}

// POST /api/v1/billing — create a manual invoice (e.g. an "other" ad-hoc charge)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_BILLING", "create");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }
    if (!session.user.tenantId) {
      return NextResponse.json({ error: "No tenant on session" }, { status: 400 });
    }

    const body = await req.json();
    const { patientId, stayId, description, quantity, unitPrice, notes } = body as {
      patientId?: string;
      stayId?: string;
      description?: string;
      quantity?: number | string;
      unitPrice?: number | string;
      notes?: string;
    };

    if (!patientId || !description || unitPrice === undefined || unitPrice === null) {
      return NextResponse.json({ error: "patientId, description and unitPrice are required" }, { status: 400 });
    }

    const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId: session.user.tenantId } });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    // stayId is optional but, if given, must actually belong to this tenant and patient —
    // otherwise a client could link the invoice to another tenant's stay and read its
    // number/dates back through GET /api/v1/billing and GET /api/v1/billing/[id], which
    // both include the linked stay.
    if (stayId) {
      const stay = await prisma.stay.findFirst({ where: { id: stayId, tenantId: session.user.tenantId, patientId } });
      if (!stay) return NextResponse.json({ error: "Stay not found" }, { status: 404 });
    }

    const qty = Number(quantity ?? 1);
    const price = Number(unitPrice);
    if (Number.isNaN(qty) || Number.isNaN(price)) {
      return NextResponse.json({ error: "quantity and unitPrice must be numbers" }, { status: 400 });
    }

    const invoice = await prisma.patientInvoice.create({
      data: {
        tenantId: session.user.tenantId,
        patientId,
        stayId: stayId || null,
        status: "pending_payment",
        issuedById: session.user.id,
        currency: "XAF",
        notes: notes || null,
        subtotal: qty * price,
        patientAmount: qty * price,
        lines: {
          create: {
            tenantId: session.user.tenantId,
            sourceType: "other",
            sourceId: null,
            description,
            quantity: qty,
            unitPrice: price,
            amount: qty * price,
          },
        },
      },
      include: { lines: true },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("[POST /api/v1/billing]", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 400 });
  }
}
