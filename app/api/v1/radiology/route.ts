import { NextResponse } from 'next/server';

const radiologyReqs = [
  { id: "RAD-25-001", patientName: "John Doe", ipp: "100000123", exam: "Scanner Thoracique", status: "Result Available", date: new Date().toISOString(), urgency: "Routine" },
  { id: "RAD-25-002", patientName: "Alice Johnson", ipp: "100000125", exam: "IRM Cérébrale", status: "Awaiting Exam", date: new Date(Date.now() - 3600000).toISOString(), urgency: "STAT" },
];

export async function GET() {
  return NextResponse.json(radiologyReqs);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newReq = {
      id: `RAD-25-${String(radiologyReqs.length + 1).padStart(3, '0')}`,
      patientName: body.patientName || "Unknown",
      ipp: body.ipp || "000000000",
      exam: body.exam || "Unknown Exam",
      status: "Awaiting Exam",
      date: new Date().toISOString(),
      urgency: body.urgency || "Routine"
    };
    radiologyReqs.push(newReq);
    return NextResponse.json(newReq, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
