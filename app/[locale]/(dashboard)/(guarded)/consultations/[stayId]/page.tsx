"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { isConfidentialResult } from "@/lib/hiv/confidential-flag";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, FileSignature, FlaskConical, HeartPulse, Loader2, Pill, Wallet } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TriageBadge } from "@/components/shared/triage-badge";
import { cn } from "@/lib/utils";
import { notifyBillingGeneratedMany } from "@/lib/billing/client";
import { ExamParametersTable } from "@/components/shared/exam-parameters-editor";
import { DiagnosisEditor, toDiagnosisPayload, type DiagnosisDraft, useDiagnosisErrorMessage } from "@/components/shared/diagnosis-editor";
import { EMPTY_RX_ITEM, PrescriptionSheet, prescriptionPayloadItems, usePrescriptionErrorMessage, type RxItem } from "../../stays/[id]/_components/PrescriptionSheet";
import { MedicalOrderSheet } from "../../stays/[id]/_components/MedicalOrderSheet";
import type {
  CatalogOption,
  Doctor,
  MedicalActOption,
  OrderItem,
  StayDetail,
  StayExamRequest,
} from "../../stays/[id]/types";

const EMPTY_ORDER: OrderItem = { source: "laboratory", code: "", urgency: "routine" };

// The doctor's consultation workspace for one admission: the reason recorded at admission,
// the latest vitals, the consultation note, and prescribing medications and lab/radiology
// exams. Exams are billed when prescribed and only become actionable in the lab/radiology
// modules once paid, so their payment state is shown here. Signing the note closes the
// consultation and takes the patient out of the queue.
export default function ConsultationWorkspacePage() {
  const t = useTranslations("consultations");
  const diagnosisError = useDiagnosisErrorMessage();
  const ta = useTranslations("admissions");
  const tc = useTranslations("common");
  const router = useRouter();
  const { stayId } = useParams<{ stayId: string }>();
  const { data: session } = useSession();

  const [stay, setStay] = useState<StayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [labCatalog, setLabCatalog] = useState<CatalogOption[]>([]);
  const [radiologyCatalog, setRadiologyCatalog] = useState<CatalogOption[]>([]);
  const [medicalActs, setMedicalActs] = useState<MedicalActOption[]>([]);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  // Coded diagnoses (ICD-10): the principal one is required to sign (RMA3 causes of consultation).
  const [diagnoses, setDiagnoses] = useState<DiagnosisDraft[]>([]);
  const [signing, setSigning] = useState(false);
  const [followedProtocol, setFollowedProtocol] = useState(false);

  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [rxItems, setRxItems] = useState<RxItem[]>([{ ...EMPTY_RX_ITEM }]);
  const prescriptionError = usePrescriptionErrorMessage();
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ ...EMPTY_ORDER }]);
  const [submitting, setSubmitting] = useState(false);

  // The note is only saved when signed, so keep an unsent draft per stay in case the
  // doctor navigates away while the patient is at the cashier or the lab.
  const draftKey = `consultation-draft:${stayId}`;

  const fetchStay = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/stays/${stayId}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t("failed_load_stay"));
      setStay(json.data as StayDetail);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failed_load_stay"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stayId]);

  useEffect(() => {
    void fetchStay();
    Promise.all([
      fetch("/api/v1/doctors").then((r) => r.json()),
      fetch("/api/v1/exam-catalog?domain=laboratory").then((r) => r.json()),
      fetch("/api/v1/exam-catalog?domain=radiology").then((r) => r.json()),
      fetch("/api/v1/medical-acts").then((r) => r.json()),
    ])
      .then(([docsJson, labJson, radioJson, actsJson]) => {
        if (docsJson.success) setDoctors(docsJson.data);
        if (Array.isArray(labJson)) setLabCatalog(labJson);
        if (Array.isArray(radioJson)) setRadiologyCatalog(radioJson);
        if (Array.isArray(actsJson)) setMedicalActs(actsJson);
      })
      .catch((e) => console.error("Failed to fetch reference data", e));
  }, [fetchStay]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNoteTitle(saved.title ?? "");
        setNoteContent(saved.content ?? "");
        if (Array.isArray(saved.diagnoses)) setDiagnoses(saved.diagnoses);
      }
    } catch {
      // Storage unavailable — the draft simply isn't restored.
    }
  }, [draftKey]);

  useEffect(() => {
    try {
      if (noteTitle || noteContent || diagnoses.length) {
        localStorage.setItem(draftKey, JSON.stringify({ title: noteTitle, content: noteContent, diagnoses }));
      } else localStorage.removeItem(draftKey);
    } catch {
      // Storage unavailable — nothing to persist to.
    }
  }, [draftKey, noteTitle, noteContent, diagnoses]);

  // Defaults to the signed-in doctor when the sheet's prescriber picker is left empty.
  const prescriberFrom = (formData: FormData) => (formData.get("prescriberId") as string) || session?.user?.id;

  const handlePrescription = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/v1/stays/${stayId}/prescriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescriberId: prescriberFrom(formData),
          notes: formData.get("notes"),
          items: prescriptionPayloadItems(rxItems),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(prescriptionError(json) ?? json.error ?? ta("error_save"));
      toast.success(t("prescription_saved"));
      setPrescriptionOpen(false);
      setRxItems([{ ...EMPTY_RX_ITEM }]);
      void fetchStay();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ta("error_save"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/v1/stays/${stayId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescriberId: prescriberFrom(formData),
          notes: formData.get("notes"),
          items: orderItems.filter((item) => item.code !== ""),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? ta("error_save"));
      const awaitingPayment = (json.data as StayExamRequest[]).some((exam) => exam.status === "awaiting_payment");
      toast.success(awaitingPayment ? t("exams_sent_to_billing") : t("exams_saved"));
      notifyBillingGeneratedMany(json.billing, tc("invoice_generated"));
      setOrderOpen(false);
      setOrderItems([{ ...EMPTY_ORDER }]);
      void fetchStay();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ta("error_save"));
    } finally {
      setSubmitting(false);
    }
  };

  const hasPrincipalDiagnosis = diagnoses.some((d) => d.kind === "principal");

  const handleSign = async () => {
    if (!stay || !session?.user?.id || !noteContent.trim() || !hasPrincipalDiagnosis) return;
    if (!window.confirm(t("confirm_sign"))) return;
    setSigning(true);
    try {
      const now = new Date().toISOString();
      const res = await fetch(`/api/v1/patients/${stay.patientId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "consultation",
          stayId,
          authorId: session.user.id,
          title: noteTitle.trim() || null,
          content: noteContent.trim(),
          isSigned: true,
          signedAt: now,
          signedBy: session.user.id,
          diagnoses: toDiagnosisPayload(diagnoses),
          followedNationalProtocol: followedProtocol,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(diagnosisError(json) ?? json.error ?? ta("error_save"));
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // Nothing to clean up.
      }
      toast.success(t("consultation_completed"));
      router.push("/consultations");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : ta("error_save"));
    } finally {
      setSigning(false);
    }
  };

  const handleRelease = async () => {
    if (!window.confirm(t("confirm_release"))) return;
    const res = await fetch(`/api/v1/stays/${stayId}/release`, { method: "POST" });
    if (res.ok) router.push("/consultations");
    else toast.error(t("release_failed"));
  };

  if (loading && !stay) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !stay) {
    return <div className="p-8 text-center text-red-600 text-sm">{error ?? t("failed_load_stay")}</div>;
  }

  const awaitingPayment = stay.consultationStatus === "awaiting_payment";
  const completed = stay.consultationStatus === "completed";
  const readOnly = awaitingPayment || completed;
  const vitals = stay.vitalSigns?.[0];
  const labRadioExams = stay.examRequests.filter((exam) => exam.type === "biology" || exam.type === "radiology");
  const otherOrders = stay.examRequests.filter((exam) => exam.type !== "biology" && exam.type !== "radiology");
  const signedNotes = stay.medicalRecords.filter((record) => record.type === "consultation" || record.type === "complementary_note");

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto pb-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 md:p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.push("/consultations")} title={t("back_to_queue")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">
              {stay.patient.lastName} {stay.patient.firstName}
            </h1>
            <p className="text-xs text-slate-500">
              <span className="font-mono">#{stay.patient.ipp}</span> · {stay.stayNumber} ·{" "}
              {format(new Date(stay.admissionDate), "dd/MM/yyyy HH:mm")}
            </p>
          </div>
          {stay.triageAcuity && <TriageBadge acuity={stay.triageAcuity} className="shrink-0" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/patients/${stay.patientId}`}>
            <Button variant="outline" size="sm">{t("open_patient_file")}</Button>
          </Link>
          {stay.consultationStatus === "claimed" && (
            <Button variant="ghost" size="sm" onClick={handleRelease}>{t("release")}</Button>
          )}
        </div>
      </div>

      {awaitingPayment && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-center gap-2">
          <Wallet className="h-4 w-4 shrink-0" /> {t("banner_awaiting_payment")}
        </div>
      )}
      {completed && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{t("banner_completed")}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left column: context */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ClipboardList className="h-3.5 w-3.5" /> {t("chief_complaint")}
            </h2>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{stay.admissionReason || t("no_chief_complaint")}</p>
            {stay.medicalAct && (
              <p className="mt-3 text-xs text-slate-500">
                {t("admission_act")}: <span className="font-medium text-slate-700">{stay.medicalAct.label}</span>
              </p>
            )}
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <HeartPulse className="h-3.5 w-3.5" /> {t("vitals")}
            </h2>
            {vitals ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <VitalItem label={t("vital_bp")} value={vitals.bloodPressureSystolic != null ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic ?? "–"} mmHg` : null} />
                <VitalItem label={t("vital_pulse")} value={vitals.pulse != null ? `${vitals.pulse} bpm` : null} />
                <VitalItem label={t("vital_temperature")} value={vitals.temperature != null ? `${vitals.temperature} °C` : null} />
                <VitalItem label={t("vital_spo2")} value={vitals.spo2 != null ? `${vitals.spo2} %` : null} />
                <VitalItem label={t("vital_weight")} value={vitals.weight != null ? `${vitals.weight} kg` : null} />
                <VitalItem label={t("vital_height")} value={vitals.height != null ? `${vitals.height} cm` : null} />
              </dl>
            ) : (
              <p className="text-xs text-slate-400">{t("no_vitals")}</p>
            )}
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FlaskConical className="h-3.5 w-3.5" /> {t("exams")}
              </h2>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={readOnly} onClick={() => setOrderOpen(true)}>
                {t("prescribe_exams")}
              </Button>
            </div>
            {labRadioExams.length + otherOrders.length === 0 ? (
              <p className="text-xs text-slate-400">{t("no_exams")}</p>
            ) : (
              <ul className="space-y-2">
                {[...labRadioExams, ...otherOrders].map((exam) => (
                  <li key={exam.id} className="flex flex-wrap items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{exam.examLabel}</p>
                      <p className="text-slate-400">
                        {ta(`order_type_${exam.type}`)} · {format(new Date(exam.requestedAt), "dd/MM HH:mm")}
                      </p>
                    </div>
                    <ExamStatusChip status={exam.status} label={ta(`exam_status_${exam.status}`)} />
                    {exam.results?.[0]?.validatedAt && (
                      <details className="basis-full mt-1">
                        <summary className="cursor-pointer text-[11px] font-medium text-blue-700">{t("view_result")}</summary>
                        <div className="mt-1 rounded border border-slate-100 overflow-x-auto">
                          {isConfidentialResult(exam.results[0].resultData) && (
                            <p className="p-2 text-xs italic text-violet-700">{tc("confidential_result")}</p>
                          )}
                          {exam.results[0].resultData.parameters?.length ? (
                            <ExamParametersTable parameters={exam.results[0].resultData.parameters} />
                          ) : null}
                          {exam.results[0].resultData.impression && (
                            <p className="p-2 text-xs text-slate-700"><span className="font-semibold">{t("impression")} : </span>{exam.results[0].resultData.impression}</p>
                          )}
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {labRadioExams.some((exam) => exam.status === "awaiting_payment") && (
              <p className="mt-3 text-[11px] text-amber-700">{t("exams_awaiting_payment_hint")}</p>
            )}
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Pill className="h-3.5 w-3.5" /> {t("medications")}
              </h2>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={readOnly} onClick={() => setPrescriptionOpen(true)}>
                {t("prescribe_medications")}
              </Button>
            </div>
            {stay.prescriptions.length === 0 ? (
              <p className="text-xs text-slate-400">{t("no_prescriptions")}</p>
            ) : (
              <ul className="space-y-3">
                {stay.prescriptions.map((rx) => (
                  <li key={rx.id} className="text-xs">
                    <p className="text-slate-400 mb-1">{format(new Date(rx.prescribedAt), "dd/MM HH:mm")} · {rx.status}</p>
                    <ul className="space-y-0.5">
                      {(rx.items ?? []).map((item, index) => (
                        <li key={index} className="text-slate-800">
                          <span className="font-medium">{item.drug}</span>
                          {[item.dosage, item.frequency, item.duration].filter(Boolean).length > 0 && (
                            <span className="text-slate-500"> — {[item.dosage, item.frequency, item.duration].filter(Boolean).join(", ")}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right column: consultation note */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <FileSignature className="h-3.5 w-3.5" /> {t("consultation_note")}
            </h2>
            <Input
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder={t("note_title_placeholder")}
              disabled={readOnly}
              className="text-sm"
            />
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder={t("note_content_placeholder")}
              disabled={readOnly}
              className="min-h-[280px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 disabled:bg-slate-50"
            />
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("diagnoses_title")}</h3>
              <DiagnosisEditor value={diagnoses} onChange={setDiagnoses} required={!readOnly} disabled={readOnly} />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={followedProtocol} disabled={readOnly} onChange={(e) => setFollowedProtocol(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
              {t("followed_national_protocol")}
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-slate-400">{t("draft_hint")}</p>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                disabled={readOnly || signing || !noteContent.trim() || !hasPrincipalDiagnosis}
                onClick={handleSign}
              >
                {signing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSignature className="h-4 w-4 mr-2" />}
                {t("sign_and_complete")}
              </Button>
            </div>
          </section>

          {signedNotes.length > 0 && (
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{t("previous_notes")}</h2>
              <ul className="space-y-4">
                {signedNotes.map((record) => (
                  <li key={record.id} className="text-sm">
                    <p className="text-xs text-slate-400">
                      {format(new Date(record.createdAt), "dd/MM/yyyy HH:mm")}
                      {record.type === "complementary_note" && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{t("complementary_note")}</span>}
                    </p>
                    {record.title && <p className="font-medium text-slate-800">{record.title}</p>}
                    <p className="text-slate-700 whitespace-pre-wrap">{record.content}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <PrescriptionSheet
        open={prescriptionOpen}
        onOpenChange={setPrescriptionOpen}
        doctors={doctors}
        rxItems={rxItems}
        setRxItems={setRxItems}
        submitting={submitting}
        onSubmit={handlePrescription}
      />

      <MedicalOrderSheet
        open={orderOpen}
        onOpenChange={setOrderOpen}
        doctors={doctors}
        labCatalog={labCatalog}
        radiologyCatalog={radiologyCatalog}
        medicalActs={medicalActs}
        orderItems={orderItems}
        setOrderItems={setOrderItems}
        submitting={submitting}
        onSubmit={handleOrder}
      />
    </div>
  );
}

function VitalItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value ?? "–"}</dd>
    </div>
  );
}

function ExamStatusChip({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
        status === "awaiting_payment" && "bg-amber-100 text-amber-700",
        status === "requested" && "bg-slate-100 text-slate-600",
        (status === "scheduled" || status === "in_progress") && "bg-blue-100 text-blue-700",
        status === "completed" && "bg-green-100 text-green-700",
        status === "cancelled" && "bg-slate-100 text-slate-400 line-through"
      )}
    >
      {label}
    </span>
  );
}
