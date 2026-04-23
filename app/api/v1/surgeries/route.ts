import { NextResponse } from 'next/server';

// In-memory mock database for surgeries
const surgeries = [
  { id: "SURG-2025-001", patientName: "John Doe", ipp: "100000123", surgeon: "Dr. Kelly", type: "Appendectomy", status: "Scheduled", date: new Date().toISOString(), checklistCompleted: false },
  { id: "SURG-2025-002", patientName: "Charlie Davis", ipp: "100000127", surgeon: "Dr. Thorne", type: "Cholecystectomy", status: "In Progress", date: new Date(Date.now() - 3600000).toISOString(), checklistCompleted: true },
  { id: "SURG-2025-003", patientName: "Alice Johnson", ipp: "100000125", surgeon: "Dr. Kelly", type: "Hernia Repair", status: "Completed", date: new Date(Date.now() - 7200000).toISOString(), checklistCompleted: true },
  { id: "SURG-2025-004", patientName: "Bob Brown", ipp: "100000126", surgeon: "Dr. Davis", type: "Knee Replacement", status: "Scheduled", date: new Date(Date.now() + 86400000).toISOString(), checklistCompleted: true }
];

export async function GET() {
  return NextResponse.json(surgeries);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newSurgery = {
      id: `SURG-2025-00${surgeries.length + 1}`,
      patientName: body.patientName || "Unknown",
      ipp: body.ipp || "000000000",
      surgeon: body.surgeon || "Unknown",
      type: body.type || "Unknown Procedure",
      status: "Scheduled",
      date: body.date || new Date().toISOString(),
      checklistCompleted: false
    };
    surgeries.push(newSurgery);
    return NextResponse.json(newSurgery, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

// We simulate DB globally inside the instance instead of strict exports
(global as any).surgeriesDB = surgeries;
