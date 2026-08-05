import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/v1/notifications/unread-count — lightweight count for polling the bell badge.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await prisma.notification.count({
    where: { recipientId: session.user.id, isRead: false },
  });

  return NextResponse.json({ count });
}
