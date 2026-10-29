import type { Session } from "next-auth";
import { extractRequestMeta, recordAuditEvent } from "@/lib/audit";

// One audit line per clinical step of an exam or a surgery (who did what, when, from where).
// Never throws: recordAuditEvent swallows its own errors.
export function auditClinicalAction(
  session: Session,
  request: Request,
  action: string,
  resource: { type: "exam_request" | "surgical_procedure"; id: string },
  payload: Record<string, unknown> = {}
) {
  return recordAuditEvent({
    tenantId: session.user.tenantId,
    actorId: session.user.id,
    actorType: "tenant_user",
    action,
    resourceType: resource.type,
    resourceId: resource.id,
    payload,
    ...extractRequestMeta(request.headers),
  });
}
