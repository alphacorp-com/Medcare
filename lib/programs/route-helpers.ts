import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helpers shared by the oxygen and nutrition routes (the guard is requireEpiAccess:
// disease programs module, facility of the session).

export const programError = (code: string, status = 400) => NextResponse.json({ error: code, code }, { status });

// The patient belongs to the caller's facility (never trust an id from the browser).
export async function patientInTenant(tenantId: string, patientId: string): Promise<boolean> {
  return Boolean(await prisma.patient.findFirst({ where: { id: patientId, tenantId }, select: { id: true } }));
}

export const PATIENT_REF = { select: { id: true, firstName: true, lastName: true, ipp: true, birthDate: true, gender: true } } as const;
