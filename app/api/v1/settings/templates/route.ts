import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const SETTING_KEY = "document_templates";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const setting = await prisma.tenantSetting.findUnique({
      where: {
        tenantId_key: {
          tenantId: session.user.tenantId,
          key: SETTING_KEY,
        },
      },
    });

    return NextResponse.json(setting?.value || {});
  } catch (error) {
    console.error("Error fetching template settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const value = await req.json();

    const setting = await prisma.tenantSetting.upsert({
      where: {
        tenantId_key: {
          tenantId: session.user.tenantId,
          key: SETTING_KEY,
        },
      },
      update: { value },
      create: {
        tenantId: session.user.tenantId,
        key: SETTING_KEY,
        value,
      },
    });

    return NextResponse.json(setting.value);
  } catch (error) {
    console.error("Error updating template settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
