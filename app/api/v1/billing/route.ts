import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const billingStays = await prisma.billingStay.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            ipp: true,
          }
        },
        stay: {
          select: {
            stayNumber: true,
            admissionDate: true,
            dischargeDate: true,
            pmsiCode: true,
          }
        }
      }
    });

    const data = billingStays.map((record) => ({
      id: record.id,
      stayId: record.stayId,
      stayNumber: record.stay?.stayNumber || `#${record.stayId.slice(0, 8)}`,
      patientName: `${record.patient.firstName} ${record.patient.lastName}`,
      ipp: record.patient.ipp,
      status: record.status,
      amount: Number(record.totalAmount.toString()),
      pmsiCode: record.pmsiCode || record.stay?.pmsiCode || null,
      dischargeDate: record.stay?.dischargeDate ?? record.createdAt,
      lineItems: record.lineItems,
    }));

    return NextResponse.json({ data, total: data.length, success: true });
  } catch (error) {
    console.error("[GET /api/v1/billing]", error);
    return NextResponse.json(
      { error: "Failed to fetch billing records", success: false },
      { status: 500 }
    );
  }
}
