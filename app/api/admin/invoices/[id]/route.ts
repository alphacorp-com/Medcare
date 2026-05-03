import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            contactEmail: true,
            address: true,
            contactPhone: true,
            // taxId: true,
            logoUrl: true,
          },
        },
        subscription: {
          select: {
            id: true,
            plan: { select: { name: true } },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const formattedInvoice = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      number: invoice.invoiceNumber,
      date: invoice.createdAt.toLocaleDateString(),
      dueDate: invoice.dueDate.toLocaleDateString(),
      status: invoice.status,
      tenantName: invoice.tenant.name,
      tenantAddress: invoice.tenant.address || "N/A",
      tenantPhone: invoice.tenant.contactPhone || "N/A",
      tenantEmail: invoice.tenant.contactEmail || "N/A",
    //   tenantTaxId: invoice.tenant.taxId,
      tenantLogo: invoice.tenant.logoUrl,
      subtotal: Number(invoice.amountHt),
      taxRate: Number(invoice.taxRate),
      tax: Number(invoice.amountHt) * (Number(invoice.taxRate) / 100),
      total: Number(invoice.amountHt) * (1 + Number(invoice.taxRate) / 100),
      currency: invoice.currency,
      lineItems: invoice.lineItems || [],
      paidAt: invoice.paidAt?.toLocaleDateString() || null,
    };

    return NextResponse.json(formattedInvoice);
  } catch (error) {
    console.error("[GET /api/admin/invoices/[id]]", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}
