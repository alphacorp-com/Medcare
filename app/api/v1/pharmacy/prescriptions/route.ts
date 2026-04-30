import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const prescriptions = await prisma.prescription.findMany({
      orderBy: { prescribedAt: 'desc' },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            ipp: true
          }
        }
      }
    });

    // Fetch all doctors to map prescriberId to name
    const doctors = await prisma.tenantUser.findMany({
      where: { role: 'doctor' },
      select: { id: true, fullName: true }
    });

    const doctorMap = new Map(doctors.map(d => [d.id, d.fullName]));

    // Fetch all inventory for stock lookup
    const inventory = await prisma.medicationInventory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, stock: true, unitPrice: true }
    });

    const inventoryMap = new Map(inventory.map(i => [i.name.toLowerCase(), i]));

    // We format the prescriptions to match the UI expectations
    const formattedData = prescriptions.map((rx) => {
      // items is a Json field, so we parse it safely
      let itemsList: any[] = [];
      try {
        if (typeof rx.items === 'string') {
          itemsList = JSON.parse(rx.items);
        } else if (Array.isArray(rx.items)) {
          itemsList = rx.items;
        }
      } catch (e) {
        // ignore
      }

      // Enrich items with stock status and pricing
      const enrichedItems = itemsList.map((item: any) => {
        const drugName = item.drug || item.name || '';
        const invItem = inventoryMap.get(drugName.toLowerCase());
        let stockStatus: 'in_stock' | 'out_of_stock' | 'not_in_inventory' = 'not_in_inventory';
        let inventoryStock = 0;
        let unitPrice: number | null = null;
        let inventoryId: string | null = null;

        if (invItem) {
          inventoryId = invItem.id;
          inventoryStock = invItem.stock;
          unitPrice = invItem.unitPrice ? parseFloat(invItem.unitPrice.toString()) : null;
          stockStatus = invItem.stock > 0 ? 'in_stock' : 'out_of_stock';
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
        const qty = parseFloat(item.quantity) || 0;
        const price = item.unitPrice || 0;
        return sum + (qty * price);
      }, 0);

      // Extract invoice data from notes
      let invoiceId: string | null = null;
      let invoiceStatus: string | null = null;
      let invoiceTotal: number | null = null;
      let invoiceItems: any[] | null = null;

      let notesData: any = {};
      try {
        if (rx.notes) {
          notesData = JSON.parse(rx.notes as string);
        }
      } catch (e) {}

      if (notesData.invoice) {
        invoiceId = notesData.invoice.id;
        invoiceStatus = notesData.invoice.status;
        invoiceTotal = notesData.invoice.totalAmount;
        invoiceItems = notesData.invoice.items;
      }

      return {
        id: rx.id,
        patientName: `${rx.patient.firstName} ${rx.patient.lastName}`,
        prescriber: doctorMap.get(rx.prescriberId) || `ID: ${rx.prescriberId}`,
        date: rx.prescribedAt,
        status: rx.status === 'pending' ? 'Pending Queue' : rx.status === 'validated' ? 'Validated' : 'Dispensed',
        items: itemsList.length || 0,
        itemsData: enrichedItems,
        alert: false, // In a real app, this would come from rx.contraindicationCheck
        ipp: rx.patient.ipp,
        totalCost,
        invoiceId,
        invoiceStatus,
        invoiceTotal,
        invoiceItems
      };
    });

    return NextResponse.json({
      data: formattedData,
      total: formattedData.length,
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
