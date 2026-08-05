import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/v1/directory — lightweight tenant-scoped colleague list for starting a conversation.
// Deliberately returns only id/fullName/email/role — no module permissions are exposed here.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const colleagues = await prisma.tenantUser.findMany({
    where: {
      tenantId: session.user.tenantId,
      isActive: true,
      id: { not: session.user.id },
    },
    select: { id: true, fullName: true, email: true, role: true },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json(colleagues);
}
