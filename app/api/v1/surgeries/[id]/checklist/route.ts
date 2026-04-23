import { NextResponse } from 'next/server';

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const surgeries = (global as any).surgeriesDB || [];
  const index = surgeries.findIndex((s: any) => s.id === id);
  
  if (index === -1) return NextResponse.json({ error: "Surgery not found" }, { status: 404 });
  
  surgeries[index].checklistCompleted = true;
  return NextResponse.json(surgeries[index]);
}
