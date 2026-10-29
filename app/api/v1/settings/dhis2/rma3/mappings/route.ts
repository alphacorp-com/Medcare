import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { extractRequestMeta, recordAuditEvent } from "@/lib/audit";
import { parseMappingCsv } from "@/lib/dhis2/rma3-export";
import { buildRma3Export, saveRma3Mappings } from "@/lib/dhis2/rma3-sync";
import { failure, periodFrom, rma3Guard } from "@/lib/dhis2/rma3-route";

// A mapping file of the whole RMA3 is a few hundred KB; this stops anything much larger.
const MAX_CSV_CHARS = 3_000_000;
const MAX_REPORTED_ERRORS = 50;

// POST /api/v1/settings/dhis2/rma3/mappings — Body: { period, csv }. Applies a filled mapping CSV
// (see mapping-template). Every line is checked against the cells the report really produces
// that month; if ANY line is invalid, nothing is saved and the errors come back with their line.
export async function POST(request: Request) {
  const guard = await rma3Guard("heavy");
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => null)) as { period?: string; csv?: unknown } | null;
  const parsed = periodFrom(body?.period);
  if ("response" in parsed) return parsed.response;
  if (typeof body?.csv !== "string" || body.csv.length === 0) return NextResponse.json({ error: "invalid_csv" }, { status: 400 });
  if (body.csv.length > MAX_CSV_CHARS) return NextResponse.json({ error: "csv_too_large" }, { status: 413 });

  try {
    const built = await buildRma3Export(guard.tenantId, parsed.period);
    const result = parseMappingCsv(body.csv, built.values);
    if (result.errors.length > 0) {
      return NextResponse.json({ error: "invalid_mapping_file", errors: result.errors.slice(0, MAX_REPORTED_ERRORS), errorCount: result.errors.length }, { status: 422 });
    }
    if (result.mappings.length === 0) return NextResponse.json({ error: "no_mapping_in_file", skipped: result.skipped }, { status: 422 });

    await saveRma3Mappings(guard.tenantId, guard.userId, result.mappings, "csv");
    await recordAuditEvent({
      tenantId: guard.tenantId,
      actorId: guard.userId,
      actorType: "tenant_user",
      action: "dhis2.rma3_mappings_imported",
      resourceType: "dhis2_rma3",
      payload: { period: parsed.period, applied: result.mappings.length, skipped: result.skipped },
      ...extractRequestMeta(request.headers),
    });
    return NextResponse.json({ applied: result.mappings.length, skipped: result.skipped });
  } catch (error) {
    return failure(error, "POST /api/v1/settings/dhis2/rma3/mappings");
  }
}

// DELETE /api/v1/settings/dhis2/rma3/mappings — forgets every mapping of the facility (a wrong
// data set, a new national version). The values themselves are untouched: they come from the registers.
export async function DELETE(request: Request) {
  const guard = await rma3Guard("heavy");
  if (!guard.ok) return guard.response;
  try {
    const { count } = await prisma.dhis2Rma3Mapping.deleteMany({ where: { tenantId: guard.tenantId } });
    await recordAuditEvent({
      tenantId: guard.tenantId,
      actorId: guard.userId,
      actorType: "tenant_user",
      action: "dhis2.rma3_mappings_cleared",
      resourceType: "dhis2_rma3",
      payload: { removed: count },
      ...extractRequestMeta(request.headers),
    });
    return NextResponse.json({ removed: count });
  } catch (error) {
    return failure(error, "DELETE /api/v1/settings/dhis2/rma3/mappings");
  }
}
