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

      return {
        id: rx.id,
        patientName: `${rx.patient.firstName} ${rx.patient.lastName}`,
        prescriber: doctorMap.get(rx.prescriberId) || `ID: ${rx.prescriberId}`,
        date: rx.prescribedAt,
        status: rx.status === 'pending' ? 'Pending Queue' : rx.status === 'validated' ? 'Validated' : 'Dispensed',
        items: itemsList.length || 0,
        itemsData: itemsList,
        alert: false, // In a real app, this would come from rx.contraindicationCheck
        ipp: rx.patient.ipp
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
