import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { resolveTenantAccess } from "@/lib/tenant-licensing";
import { RESOURCE_ACCESS_DENIED } from "@/lib/permissions";

async function requireParticipant(conversationId: string, userId: string) {
  return prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
}

// GET /api/v1/conversations/[id]/messages — paginated history, oldest first.
// Query params: take (default 50, max 100), before (ISO timestamp cursor for older pages)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const participant = await requireParticipant(id, session.user.id);
  if (!participant) {
    return NextResponse.json({ error: RESOURCE_ACCESS_DENIED }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const take = Math.min(100, Math.max(1, parseInt(searchParams.get("take") ?? "50", 10) || 50));
  const before = searchParams.get("before");

  const messages = await prisma.message.findMany({
    where: {
      conversationId: id,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { sender: { select: { id: true, fullName: true } } },
  });

  return NextResponse.json(messages.reverse());
}

// POST /api/v1/conversations/[id]/messages — send a message.
// Body: { body: string }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.tenantId) {
    const access = await resolveTenantAccess(session.user.tenantId);
    if (!access.isActive) {
      return NextResponse.json({ error: "Tenant access is not active" }, { status: 403 });
    }
  }

  const { id } = await params;
  const participant = await requireParticipant(id, session.user.id);
  if (!participant) {
    return NextResponse.json({ error: RESOURCE_ACCESS_DENIED }, { status: 403 });
  }

  const body = await req.json();
  const text: string = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const now = new Date();

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId: id, senderId: session.user.id, body: text },
      include: { sender: { select: { id: true, fullName: true } } },
    }),
    prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: now },
    }),
    prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId: session.user.id } },
      data: { lastReadAt: now },
    }),
  ]);

  const otherParticipants = await prisma.conversationParticipant.findMany({
    where: { conversationId: id, userId: { not: session.user.id } },
    select: { userId: true },
  });

  if (otherParticipants.length > 0) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { title: true, isGroup: true },
    });
    const senderName = message.sender.fullName;
    const title = conversation?.isGroup && conversation.title
      ? `${senderName} in ${conversation.title}`
      : senderName;

    await prisma.notification.createMany({
      data: otherParticipants.map((p) => ({
        tenantId: session.user.tenantId,
        recipientId: p.userId,
        type: "message" as const,
        title,
        body: text.length > 140 ? `${text.slice(0, 140)}…` : text,
        link: "/messages",
        resourceType: "conversation",
        resourceId: id,
        actorId: session.user.id,
      })),
    });
  }

  return NextResponse.json(message, { status: 201 });
}
