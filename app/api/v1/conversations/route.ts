import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkOnPremLicenseGuard } from "@/lib/onprem-license/guard";
import { getConversationSummaries } from "@/lib/messaging/conversation-summaries";

// GET /api/v1/conversations — current user's conversations, most recently active first.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Unread counts and last-message previews come from one grouped query; the
  // conversations themselves (with participants) from one more — constant, whatever the
  // number of conversations.
  const [participations, summaries] = await Promise.all([
    prisma.conversationParticipant.findMany({
      where: { userId: session.user.id },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: { select: { id: true, fullName: true, email: true } } },
            },
          },
        },
      },
      orderBy: { conversation: { lastMessageAt: "desc" } },
    }),
    getConversationSummaries(session.user.id),
  ]);

  const result = participations.map(({ conversation }) => {
    const summary = summaries.get(conversation.id);
    return {
      id: conversation.id,
      title: conversation.title,
      isGroup: conversation.isGroup,
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: summary?.lastMessagePreview ?? null,
      unreadCount: summary?.unreadCount ?? 0,
      participants: conversation.participants
        .filter((p) => p.userId !== session.user.id)
        .map((p) => p.user),
    };
  });

  return NextResponse.json(result);
}

// POST /api/v1/conversations — create (or reuse) a conversation.
// Body: { participantIds: string[], title?: string, isGroup?: boolean }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guard = await checkOnPremLicenseGuard();
  if (guard.blocked) {
    return NextResponse.json({ error: "Tenant access is not active" }, { status: 403 });
  }

  const body = await req.json();
  const participantIds: string[] = Array.isArray(body?.participantIds) ? body.participantIds : [];
  const title: string | undefined = typeof body?.title === "string" ? body.title.trim() : undefined;
  const isGroup: boolean = Boolean(body?.isGroup) || participantIds.length > 1;

  const uniqueParticipantIds = Array.from(new Set(participantIds.filter((id) => id !== session.user.id)));
  if (uniqueParticipantIds.length === 0) {
    return NextResponse.json({ error: "At least one participant is required" }, { status: 400 });
  }

  // Tenant isolation: every participant must belong to the same tenant as the caller.
  const validParticipants = await prisma.tenantUser.findMany({
    where: { id: { in: uniqueParticipantIds }, tenantId: session.user.tenantId, isActive: true },
    select: { id: true },
  });
  if (validParticipants.length !== uniqueParticipantIds.length) {
    return NextResponse.json({ error: "One or more participants are not part of your tenant" }, { status: 400 });
  }

  const allParticipantIds = [session.user.id, ...uniqueParticipantIds];

  if (!isGroup && uniqueParticipantIds.length === 1) {
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        tenantId: session.user.tenantId,
        participants: { every: { userId: { in: allParticipantIds } } },
        AND: [
          { participants: { some: { userId: session.user.id } } },
          { participants: { some: { userId: uniqueParticipantIds[0] } } },
        ],
      },
      include: { participants: true },
    });
    if (existing && existing.participants.length === 2) {
      return NextResponse.json({ id: existing.id, reused: true });
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      tenantId: session.user.tenantId,
      title: isGroup ? title : undefined,
      isGroup,
      createdBy: session.user.id,
      participants: {
        create: allParticipantIds.map((userId) => ({ userId })),
      },
    },
  });

  return NextResponse.json({ id: conversation.id, reused: false }, { status: 201 });
}
