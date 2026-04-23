import { NextResponse } from "next/server";
// import prisma from "@/lib/prisma"; // Assuming prisma is setup in lib/prisma.ts

export async function GET(request: Request) {
  try {
    // In a real implementation:
    // const patients = await prisma.patient.findMany({ where: { isDeceased: false } });
    
    const mockPatients = [
      { id: "PAT-001", ipp: "100000123", lastName: "Doe", firstName: "John", gender: "M" }
    ];
    
    return NextResponse.json({ data: mockPatients, success: true });
  } catch (error) {
    console.error("Error fetching patients:", error);
    return NextResponse.json({ error: "Failed to fetch patients", success: false }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // In a real implementation:
    // const newPatient = await prisma.patient.create({ data: { ...body } });
    
    return NextResponse.json({ data: { id: "NEW-PAT-123", ...body }, success: true }, { status: 201 });
  } catch (error) {
    console.error("Error creating patient:", error);
    return NextResponse.json({ error: "Failed to create patient", success: false }, { status: 500 });
  }
}
