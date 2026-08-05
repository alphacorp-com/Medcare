import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/v1/conversations/[id]/read — mark the current user caught up on this conversation.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: session.user.id } },
  });
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: id, userId: session.user.id } },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
