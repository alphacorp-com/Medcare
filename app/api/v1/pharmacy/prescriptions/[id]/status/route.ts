import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { PrescriptionStatus } from "@prisma/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['pending', 'validated', 'dispensed'].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status", success: false },
        { status: 400 }
      );
    }

    // Fetch current prescription with items
    const currentRx = await prisma.prescription.findUnique({
      where: { id },
      include: { patient: true }
    });

    if (!currentRx) {
      return NextResponse.json(
        { error: "Prescription not found", success: false },
        { status: 404 }
      );
    }

    let updateData: any = {
      status: status as PrescriptionStatus,
      ...(status === 'validated' ? { validatedAt: new Date() } : {})
    };

    if (status === 'validated') {
      // Generate invoice on validation
      let itemsList: any[] = [];
      try {
        if (typeof currentRx.items === 'string') {
          itemsList = JSON.parse(currentRx.items);
        } else if (Array.isArray(currentRx.items)) {
          itemsList = currentRx.items;
        }
      } catch (e) {}

      // Fetch inventory for pricing
      const inventory = await prisma.medicationInventory.findMany({
        where: { isActive: true },
        select: { id: true, name: true, unitPrice: true }
      });
      const inventoryMap = new Map(inventory.map(i => [i.name.toLowerCase(), { id: i.id, unitPrice: i.unitPrice }]));

      // Calculate invoice items
      const invoiceItems = itemsList.map((item: any) => {
        const drugName = item.drug || item.name || '';
        const invData = inventoryMap.get(drugName.toLowerCase());
        const unitPrice = invData?.unitPrice ? parseFloat(invData.unitPrice.toString()) : 0;
        const quantity = parseFloat(item.quantity) || 0;
        const lineTotal = quantity * unitPrice;

        return {
          drugName,
          inventoryId: invData?.id || null,
          quantity,
          unitPrice,
          lineTotal
        };
      });

      const totalAmount = invoiceItems.reduce((sum, item) => sum + item.lineTotal, 0);

      const invoiceData = {
        id: `INV-${Date.now()}`,
        status: 'pending',
        totalAmount,
        currency: 'XAF',
        createdAt: new Date().toISOString(),
        items: invoiceItems
      };

      updateData.notes = JSON.stringify({
        ...(currentRx.notes ? JSON.parse(currentRx.notes as string) : {}),
        invoice: invoiceData
      });
    }

    if (status === 'dispensed') {
      // Check if invoice is paid
      let notesData: any = {};
      try {
        if (currentRx.notes) {
          notesData = JSON.parse(currentRx.notes as string);
        }
      } catch (e) {}

      if (!notesData.invoice || notesData.invoice.status !== 'paid') {
        return NextResponse.json(
          { error: "Cannot dispense: Invoice must be paid first", success: false },
          { status: 400 }
        );
      }

      // Deduct stock
      let itemsList: any[] = [];
      try {
        if (typeof currentRx.items === 'string') {
          itemsList = JSON.parse(currentRx.items);
        } else if (Array.isArray(currentRx.items)) {
          itemsList = currentRx.items;
        }
      } catch (e) {}

      const inventory = await prisma.medicationInventory.findMany({
        where: { isActive: true },
        select: { id: true, name: true, stock: true }
      });
      const inventoryMap = new Map(inventory.map(i => [i.name.toLowerCase(), i]));

      for (const item of itemsList) {
        const drugName = item.drug || item.name || '';
        const invItem = inventoryMap.get(drugName.toLowerCase());
        if (invItem) {
          const quantity = parseFloat(item.quantity) || 0;
          await prisma.medicationInventory.update({
            where: { id: invItem.id },
            data: { stock: Math.max(0, invItem.stock - quantity) }
          });
        }
      }

      // Create DrugDispensing records (assuming there's a model, but since not in schema, skip for now)
      updateData.dispensedAt = new Date();
    }

    const prescription = await prisma.prescription.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ data: prescription, success: true });
  } catch (error) {
    console.error("[PATCH /api/v1/pharmacy/prescriptions/[id]/status]", error);
    return NextResponse.json(
      { error: "Failed to update prescription status", success: false },
      { status: 500 }
    );
  }
}
