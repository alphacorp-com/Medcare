import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireTenantAdmin } from "@/lib/permissions";
import { previousMonthPeriod } from "@/lib/dhis2/indicators";
import { computeRma3Report } from "@/lib/reports/rma3";
import { buildRma3Document } from "@/lib/reports/rma3-docx";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permCheck = requireTenantAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    if (!session.user.tenantId) {
      return NextResponse.json({ error: "Tenant ID not found in session" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? previousMonthPeriod();
    if (!/^\d{6}$/.test(period)) {
      return NextResponse.json({ error: "Invalid period format, expected YYYYMM" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { slug: true },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const data = await computeRma3Report(session.user.tenantId, period);
    const buffer = await buildRma3Document(data, {
      generatedByName: session.user.name ?? session.user.email ?? "-",
      generatedByEmail: session.user.email ?? "-",
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="RMA3_${tenant.slug}_${period}.docx"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[GET /api/v1/settings/reports/rma3]", error);
    return NextResponse.json({ error: "Failed to generate RMA3 report" }, { status: 500 });
  }
}
