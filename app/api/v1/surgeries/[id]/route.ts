import { NextResponse } from 'next/server';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const surgeries = (global as any).surgeriesDB || [];
  const surgery = surgeries.find((s: any) => s.id === id);
  if (!surgery) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });
  return NextResponse.json(surgery);
}
