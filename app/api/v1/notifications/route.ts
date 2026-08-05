import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/v1/notifications — current user's notifications, newest first.
// Query params: take (default 30, max 100)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const take = Math.min(100, Math.max(1, parseInt(searchParams.get("take") ?? "30", 10) || 30));

  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.user.id },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json(notifications);
}
