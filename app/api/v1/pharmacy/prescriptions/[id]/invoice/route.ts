import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModulePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_PHARMACY", "read");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;

    const prescription = await prisma.prescription.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { notes: true }
    });

    if (!prescription) {
      return NextResponse.json(
        { error: "Prescription not found", success: false },
        { status: 404 }
      );
    }

    let notesData: any = {};
    try {
      if (prescription.notes) {
        notesData = JSON.parse(prescription.notes as string);
      }
    } catch (e) {}

    const invoice = notesData.invoice || null;

    return NextResponse.json({ data: invoice, success: true });
  } catch (error) {
    console.error("[GET /api/v1/pharmacy/prescriptions/[id]/invoice]", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice", success: false },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireModulePermission(session, "MODULE_PHARMACY", "update");
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (status !== 'paid') {
      return NextResponse.json(
        { error: "Invalid status. Only 'paid' is allowed", success: false },
        { status: 400 }
      );
    }

    const prescription = await prisma.prescription.findFirst({
      where: { id, tenantId: session.user.tenantId },
      select: { notes: true }
    });

    if (!prescription) {
      return NextResponse.json(
        { error: "Prescription not found", success: false },
        { status: 404 }
      );
    }

    let notesData: any = {};
    try {
      if (prescription.notes) {
        notesData = JSON.parse(prescription.notes as string);
      }
    } catch (e) {}

    if (!notesData.invoice) {
      return NextResponse.json(
        { error: "No invoice found for this prescription", success: false },
        { status: 404 }
      );
    }

    notesData.invoice.status = 'paid';
    notesData.invoice.paidAt = new Date().toISOString();

    await prisma.prescription.update({
      where: { id },
      data: { notes: JSON.stringify(notesData) }
    });

    return NextResponse.json({ data: notesData.invoice, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/pharmacy/prescriptions/[id]/invoice]", error);
    return NextResponse.json(
      { error: "Failed to update invoice status", success: false },
      { status: 500 }
    );
  }
}