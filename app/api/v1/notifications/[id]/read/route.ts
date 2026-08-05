import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { RESOURCE_ACCESS_DENIED } from "@/lib/permissions";

// PATCH /api/v1/notifications/[id]/read — mark a single notification read.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }
  if (notification.recipientId !== session.user.id) {
    return NextResponse.json({ error: RESOURCE_ACCESS_DENIED }, { status: 403 });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });

  return NextResponse.json(updated);
}
