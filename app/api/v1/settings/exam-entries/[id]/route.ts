import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireTenantAdmin } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { validateExamParameters } from "@/lib/exam-catalog/validate-parameters";
import { syncExamFeeSchedule, deactivateExamFeeSchedule } from "@/lib/billing/syncFeeSchedule";
import { SCREENING_TEST_TYPES, VIRAL_LOAD_PROGRAMS } from "@/lib/hiv/input";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const permCheck = requireTenantAdmin(session);
    if (!permCheck.ok) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    const { id } = await params;
    const existing = await prisma.examCatalogEntry.findFirst({ where: { id, tenantId: session.user.tenantId } });
    if (!existing) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const body = await request.json();
    const {
      code, nameFr, nameEn, price, parameters,
      imagingCatalogItemId, anatomicalZoneId, requiresContrast, isActive, screeningTestType, viralLoadProgram,
    } = body as {
      code?: string; nameFr?: string; nameEn?: string; price?: number | string | null;
      parameters?: unknown;
      imagingCatalogItemId?: string | null; anatomicalZoneId?: string | null; requiresContrast?: boolean | null; isActive?: boolean;
      screeningTestType?: unknown;
      viralLoadProgram?: unknown;
    };
    if (viralLoadProgram !== undefined && viralLoadProgram !== null && viralLoadProgram !== "" && !(VIRAL_LOAD_PROGRAMS as readonly unknown[]).includes(viralLoadProgram)) {
      return NextResponse.json({ error: "Invalid viral load program", code: "invalid_viral_load_program" }, { status: 400 });
    }
    // An exam feeds either the screening register or the viral loads, not both.
    if (screeningTestType && viralLoadProgram) {
      return NextResponse.json({ error: "Screening test and viral load are exclusive", code: "invalid_screening_test_type" }, { status: 400 });
    }
    // Which program screening test a validated result of this exam feeds (null = none).
    if (screeningTestType !== undefined && screeningTestType !== null && screeningTestType !== "" && !(SCREENING_TEST_TYPES as readonly unknown[]).includes(screeningTestType)) {
      return NextResponse.json({ error: "Invalid screening test type", code: "invalid_screening_test_type" }, { status: 400 });
    }

    // The sheet drives result entry and automatic (critical) flags — validated server-side.
    const parsedParameters = parameters === undefined ? undefined : validateExamParameters(parameters);
    if (parsedParameters && !parsedParameters.ok) {
      return NextResponse.json(
        { error: "Invalid result parameters", code: parsedParameters.code, index: parsedParameters.index },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (code !== undefined) data.code = code.trim().toUpperCase();
    if (nameFr !== undefined) data.nameFr = nameFr.trim();
    if (nameEn !== undefined) data.nameEn = nameEn?.trim() || null;
    if (price !== undefined) data.price = price === null || price === "" ? null : Number(price);
    if (parsedParameters?.ok) data.parameters = parsedParameters.value;
    if (imagingCatalogItemId !== undefined) data.imagingCatalogItemId = imagingCatalogItemId || null;
    if (anatomicalZoneId !== undefined) data.anatomicalZoneId = anatomicalZoneId || null;
    if (requiresContrast !== undefined) data.requiresContrast = requiresContrast;
    if (isActive !== undefined) data.isActive = isActive;
    if (screeningTestType !== undefined) data.screeningTestType = screeningTestType || null;
    if (viralLoadProgram !== undefined) data.viralLoadProgram = viralLoadProgram || null;

    const updated = await prisma.examCatalogEntry.update({ where: { id }, data });

    // Renaming the code orphans the fee schedule row filed under the old one.
    if (updated.code !== existing.code) {
      await deactivateExamFeeSchedule(session.user.tenantId, existing.code);
    }
    await syncExamFeeSchedule({
      tenantId: session.user.tenantId,
      code: updated.code,
      label: updated.nameFr,
      price: updated.price ? Number(updated.price) : null,
      isActive: updated.isActive,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/v1/settings/exam-entries/[id]]", error);
    return NextResponse.json({ error: "Failed to update exam" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const permCheck = requireTenantAdmin(session);
  if (!permCheck.ok) {
    return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
  }

  const { id } = await params;
  const existing = await prisma.examCatalogEntry.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  await prisma.examCatalogEntry.delete({ where: { id } });
  await deactivateExamFeeSchedule(session.user.tenantId, existing.code);
  return NextResponse.json({ success: true });
}
