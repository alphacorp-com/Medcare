import { NextResponse } from 'next/server';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const rad = { id: id, patientName: "Unknown", ipp: "000000", exam: "Unknown Exam", status: "Result Available", date: new Date().toISOString(), urgency: "Routine" };
  if (!rad) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  return NextResponse.json(rad);
}
