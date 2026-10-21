"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api-client";
import { ART_REGIMENS } from "@/lib/hiv/regimens";
import { ENTRY_POINTS, HEPATITIS_TYPES, SCREENING_RESULTS, SCREENING_TEST_TYPES, TRANSFER_SCOPES } from "@/lib/hiv/input";
import { cn } from "@/lib/utils";

// The HIV / PMTCT / hepatitis / STI file of one patient (MODULE_HIV only: the parent hides
// this panel without the permission, and every route checks it again).

type Test = { id: string; testType: string; testedAt: string; result: string; entryPoint: string; isRetest: boolean; resultCollectedAt: string | null; treatedAt: string | null; pregnancyId: string | null; examResultId: string | null };
type Visit = { id: string; visitDate: string; regimenCode: string; regimenLine: number; daysDispensed: number; nextAppointmentDate: string; tbScreened: boolean; tbConfirmed: boolean; iptStarted: boolean };
type Enrolment = { id: string; artStartDate: string; enrolledAt: string; entryPoint: string; transferIn: string | null; status: string; statusChangedAt: string | null; visits: Visit[] };
type ViralLoad = { id: string; program: string; sampledAt: string; value: number | null; belowDetection: boolean };
type Hepatitis = { id: string; type: "hbv" | "hcv"; diagnosedAt: string; deltaPositive: boolean | null; eligibleAt: string | null; treatmentStartedAt: string | null; treatmentStoppedAt: string | null; curedAt: string | null; cirrhosisAt: string | null; liverCancerAt: string | null; diedAt: string | null };
type Infant = { motherPatientId: string | null; bornInFacility: boolean; firstSeenAt: string; nevirapineStartedAt: string | null; cotrimoxazoleStartedAt: string | null; visit6to8WeeksAt: string | null };
type PregnancyPmtct = { id: string; lastMenstrualPeriod: string; status: string; referralSource: string; pmtctStatus: { hivKnownPositiveAtEntry: boolean; onArtAtEntry: boolean; hbvKnownPositiveAtEntry: boolean } | null };
type HivFile = { tests: Test[]; enrolment: Enrolment | null; viralLoads: ViralLoad[]; hepatitisCases: Hepatitis[]; exposedInfant: Infant | null; pregnancies: PregnancyPmtct[] };

type Form = "test" | "enrol" | "visit" | "status" | "viral_load" | "hepatitis" | "infant";

const today = () => new Date().toISOString().slice(0, 10);
const dateOnly = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");
const fieldClass = "h-8 text-xs bg-white border-slate-200";
const selectClass = "flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm";
const json = (body: unknown, method = "POST") => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-slate-300" />
      {label}
    </label>
  );
}

export function HivPatientPanel({ patientId, canEdit }: { patientId: string; canEdit: boolean }) {
  const t = useTranslations("diseasePrograms.hiv");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const key = ["hiv", "patient", patientId];
  const query = useQuery({ queryKey: key, queryFn: () => apiFetch<{ data: HivFile }>(`/api/v1/hiv/patients/${patientId}`) });
  const [form, setForm] = useState<Form | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const set = (patch: Record<string, unknown>) => setValues((v) => ({ ...v, ...patch }));
  const open = (f: Form, initial: Record<string, unknown>) => {
    setValues(initial);
    setForm(f);
  };

  const file = query.data?.data;
  const enrolment = file?.enrolment ?? null;
  const day = (iso: string | null | undefined) => (iso ? format.dateTime(new Date(iso), { dateStyle: "short", timeZone: "UTC" }) : "—");

  const save = useMutation({
    mutationFn: async () => {
      const v = { ...values, patientId };
      switch (form) {
        case "test":
          return apiFetch("/api/v1/hiv/screening-tests", json(v));
        case "enrol":
          return apiFetch("/api/v1/hiv/enrolments", json(v));
        case "visit":
          return apiFetch(`/api/v1/hiv/enrolments/${enrolment!.id}/visits`, json(v));
        case "status":
          return apiFetch(`/api/v1/hiv/enrolments/${enrolment!.id}`, json(v, "PATCH"));
        case "viral_load":
          return apiFetch("/api/v1/hiv/viral-loads", json(v));
        case "hepatitis":
          return apiFetch("/api/v1/hiv/hepatitis-cases", json(v));
        case "infant":
          return apiFetch("/api/v1/hiv/exposed-infants", json(v));
        default:
          throw new Error("no_form");
      }
    },
    onSuccess: () => {
      setForm(null);
      toast.success(t("saved"));
      return queryClient.invalidateQueries({ queryKey: ["hiv"] });
    },
    onError: (error) => {
      const code = error instanceof Error ? error.message : "";
      toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("save_error"));
    },
  });
  const savePmtct = useMutation({
    mutationFn: (p: { id: string; body: Record<string, unknown> }) => apiFetch(`/api/v1/hiv/pregnancies/${p.id}`, json(p.body, "PUT")),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: () => toast.error(t("save_error")),
  });

  if (query.isPending) return <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>;
  if (query.isError || !file) return <p className="text-xs text-red-600">{t("load_error")}</p>;

  const lastVisit = enrolment?.visits[0];
  const section = (title: string, action?: React.ReactNode, children?: React.ReactNode) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{title}</h5>
        {canEdit && action}
      </div>
      {children}
    </div>
  );
  const addButton = (label: string, onClick: () => void) => (
    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClick}>
      <Plus className="h-3.5 w-3.5 mr-1" /> {label}
    </Button>
  );

  return (
    <div className="space-y-5 rounded border border-violet-200 bg-violet-50/30 p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-violet-800">
        <Lock className="h-3.5 w-3.5" /> {t("confidential_notice")}
      </p>

      {/* Screening tests */}
      {section(
        t("tests_title"),
        addButton(t("test_add"), () => open("test", { testType: "hiv", result: "negative", entryPoint: "vct", testedAt: today(), isRetest: false, referralSource: "none" })),
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-slate-100">
            {file.tests.length === 0 && <tr><td className="py-2 text-slate-500 italic">{t("none")}</td></tr>}
            {file.tests.map((test) => (
              <tr key={test.id}>
                <td className="py-1.5 pr-2 whitespace-nowrap">{day(test.testedAt)}</td>
                <td className="py-1.5 pr-2 font-medium">{t(`test_type_${test.testType}`)}{test.isRetest ? ` · ${t("retest")}` : ""}</td>
                <td className={cn("py-1.5 pr-2 font-semibold", test.result === "positive" ? "text-red-700" : "text-slate-700")}>{t(`result_${test.result}`)}</td>
                <td className="py-1.5 pr-2 text-slate-500">{t(`entry_${test.entryPoint}`)}{test.examResultId ? ` · ${t("from_lab")}` : ""}</td>
                <td className="py-1.5 text-right space-x-2 whitespace-nowrap">
                  {canEdit && !test.resultCollectedAt && (
                    <button type="button" className="text-[11px] font-semibold text-blue-600 hover:underline" onClick={() => apiFetch(`/api/v1/hiv/screening-tests/${test.id}`, json({ resultCollectedAt: today() }, "PATCH")).then(() => queryClient.invalidateQueries({ queryKey: key }))}>
                      {t("mark_collected")}
                    </button>
                  )}
                  {canEdit && test.result === "positive" && test.testType !== "hiv" && test.testType !== "hiv_pcr" && !test.treatedAt && (
                    <button type="button" className="text-[11px] font-semibold text-green-700 hover:underline" onClick={() => apiFetch(`/api/v1/hiv/screening-tests/${test.id}`, json({ treatedAt: today() }, "PATCH")).then(() => queryClient.invalidateQueries({ queryKey: key }))}>
                      {t("mark_treated")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ART */}
      {section(
        t("art_title"),
        enrolment
          ? enrolment.status === "active" && (
              <div className="flex gap-1">
                {addButton(t("visit_add"), () => open("visit", { visitDate: today(), regimenCode: lastVisit?.regimenCode ?? "TDF-3TC-DTG", daysDispensed: 30 }))}
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => open("status", { status: "transferred_out", statusChangedAt: today(), transferOut: "in_country" })}>
                  {t("status_change")}
                </Button>
              </div>
            )
          : addButton(t("enrol"), () => open("enrol", { artStartDate: today(), entryPoint: "vct" })),
        enrolment ? (
          <div className="space-y-1 text-xs">
            <p>
              {t("art_summary", { start: day(enrolment.artStartDate), status: t(`status_${enrolment.status}`) })}
              {enrolment.transferIn ? ` · ${t("transfer_in_badge")}` : ""}
            </p>
            {lastVisit && (
              <p className="text-slate-600">
                {t("last_visit", { date: day(lastVisit.visitDate), regimen: ART_REGIMENS.find((r) => r.code === lastVisit.regimenCode)?.label ?? lastVisit.regimenCode, next: day(lastVisit.nextAppointmentDate) })}
              </p>
            )}
            <ul className="text-[11px] text-slate-500">
              {enrolment.visits.slice(0, 6).map((v) => (
                <li key={v.id}>
                  {day(v.visitDate)} — {v.regimenCode} ({t("line", { line: v.regimenLine })}) · {v.daysDispensed} j{v.tbScreened ? ` · ${t("tb_screened_badge")}` : ""}{v.iptStarted ? " · INH" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">{t("not_enrolled")}</p>
        )
      )}

      {/* Viral loads */}
      {section(
        t("viral_loads_title"),
        addButton(t("viral_load_add"), () => open("viral_load", { program: "hiv", sampledAt: today(), belowDetection: false })),
        <ul className="text-xs">
          {file.viralLoads.length === 0 && <li className="text-slate-500 italic">{t("none")}</li>}
          {file.viralLoads.map((v) => (
            <li key={v.id}>
              {day(v.sampledAt)} — {t(`program_${v.program}`)} : {v.belowDetection ? t("below_detection") : v.value}
            </li>
          ))}
        </ul>
      )}

      {/* Hepatitis */}
      {section(
        t("hepatitis_title"),
        addButton(t("hepatitis_add"), () => open("hepatitis", { type: "hbv", diagnosedAt: today() })),
        <ul className="text-xs space-y-1">
          {file.hepatitisCases.length === 0 && <li className="text-slate-500 italic">{t("none")}</li>}
          {file.hepatitisCases.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span>
                {t(`hep_${c.type}`)} — {t("diagnosed_on", { date: day(c.diagnosedAt) })}
                {c.deltaPositive ? " · Delta+" : ""}
                {c.treatmentStartedAt ? ` · ${t("treated_since", { date: day(c.treatmentStartedAt) })}` : ""}
                {c.curedAt ? ` · ${t("cured")}` : ""}
              </span>
              {canEdit && (
                <button type="button" className="text-[11px] font-semibold text-blue-600 hover:underline" onClick={() => open("hepatitis", { ...c, diagnosedAt: dateOnly(c.diagnosedAt), eligibleAt: dateOnly(c.eligibleAt), treatmentStartedAt: dateOnly(c.treatmentStartedAt), treatmentStoppedAt: dateOnly(c.treatmentStoppedAt), curedAt: dateOnly(c.curedAt), cirrhosisAt: dateOnly(c.cirrhosisAt), liverCancerAt: dateOnly(c.liverCancerAt), diedAt: dateOnly(c.diedAt) })}>
                  {t("edit")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Pregnancies (PMTCT status) */}
      {file.pregnancies.length > 0 &&
        section(
          t("pmtct_title"),
          undefined,
          <ul className="space-y-2 text-xs">
            {file.pregnancies.map((p) => {
              const status = p.pmtctStatus ?? { hivKnownPositiveAtEntry: false, onArtAtEntry: false, hbvKnownPositiveAtEntry: false };
              const update = (patch: Record<string, unknown>) => savePmtct.mutate({ id: p.id, body: { ...status, referralSource: p.referralSource, ...patch } });
              return (
                <li key={p.id} className="rounded border border-slate-200 bg-white p-2 space-y-1">
                  <div className="font-semibold">{t("pregnancy_of", { date: day(p.lastMenstrualPeriod) })}</div>
                  <div className="flex flex-wrap gap-3">
                    <Check label={t("known_positive_at_entry")} checked={status.hivKnownPositiveAtEntry} onChange={(v) => canEdit && update({ hivKnownPositiveAtEntry: v })} />
                    <Check label={t("on_art_at_entry")} checked={status.onArtAtEntry} onChange={(v) => canEdit && update({ onArtAtEntry: v })} />
                    <Check label={t("hbv_known_at_entry")} checked={status.hbvKnownPositiveAtEntry} onChange={(v) => canEdit && update({ hbvKnownPositiveAtEntry: v })} />
                    <select value={p.referralSource} disabled={!canEdit} onChange={(e) => update({ referralSource: e.target.value })} className={cn(selectClass, "w-auto h-7")} aria-label={t("referral")}>
                      {(["none", "asc", "obc"] as const).map((r) => (
                        <option key={r} value={r}>{t(`referral_${r}`)}</option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

      {/* Exposed infant */}
      {section(
        t("infant_title"),
        addButton(file.exposedInfant ? t("edit") : t("infant_start"), () =>
          open("infant", file.exposedInfant
            ? { ...file.exposedInfant, firstSeenAt: dateOnly(file.exposedInfant.firstSeenAt), nevirapineStartedAt: dateOnly(file.exposedInfant.nevirapineStartedAt), cotrimoxazoleStartedAt: dateOnly(file.exposedInfant.cotrimoxazoleStartedAt), visit6to8WeeksAt: dateOnly(file.exposedInfant.visit6to8WeeksAt) }
            : { firstSeenAt: today(), bornInFacility: true })
        ),
        file.exposedInfant ? (
          <p className="text-xs">
            {t("infant_summary", { seen: day(file.exposedInfant.firstSeenAt), nvp: day(file.exposedInfant.nevirapineStartedAt), ctx: day(file.exposedInfant.cotrimoxazoleStartedAt) })}
          </p>
        ) : (
          <p className="text-xs text-slate-500 italic">{t("infant_none")}</p>
        )
      )}

      <Sheet open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="sm:max-w-md w-full p-0 flex flex-col bg-slate-50">
          <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
            <SheetTitle className="text-lg">{form ? t(`form_${form}`) : ""}</SheetTitle>
            <SheetDescription className="text-xs">{t("confidential_notice")}</SheetDescription>
          </SheetHeader>
          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            {form === "test" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("test_type")}>
                    <select value={String(values.testType)} onChange={(e) => set({ testType: e.target.value })} className={selectClass}>
                      {SCREENING_TEST_TYPES.map((x) => <option key={x} value={x}>{t(`test_type_${x}`)}</option>)}
                    </select>
                  </Field>
                  <Field label={t("result")}>
                    <select value={String(values.result)} onChange={(e) => set({ result: e.target.value })} className={selectClass}>
                      {SCREENING_RESULTS.map((x) => <option key={x} value={x}>{t(`result_${x}`)}</option>)}
                    </select>
                  </Field>
                  <Field label={t("date")}>
                    <Input type="date" max={today()} value={String(values.testedAt ?? "")} onChange={(e) => set({ testedAt: e.target.value })} className={fieldClass} />
                  </Field>
                  <Field label={t("entry_point")}>
                    <select value={String(values.entryPoint)} onChange={(e) => set({ entryPoint: e.target.value })} className={selectClass}>
                      {ENTRY_POINTS.map((x) => <option key={x} value={x}>{t(`entry_${x}`)}</option>)}
                    </select>
                  </Field>
                </div>
                {file.pregnancies.length > 0 && (
                  <Field label={t("during_pregnancy")}>
                    <select value={String(values.pregnancyId ?? "")} onChange={(e) => set({ pregnancyId: e.target.value || null })} className={selectClass}>
                      <option value="">—</option>
                      {file.pregnancies.map((p) => <option key={p.id} value={p.id}>{t("pregnancy_of", { date: day(p.lastMenstrualPeriod) })}</option>)}
                    </select>
                  </Field>
                )}
                <Check label={t("is_retest")} checked={values.isRetest === true} onChange={(v) => set({ isRetest: v })} />
                <Check label={t("result_collected")} checked={Boolean(values.resultCollectedAt)} onChange={(v) => set({ resultCollectedAt: v ? values.testedAt : null })} />
              </>
            )}
            {form === "enrol" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("diagnosis_date")}>
                  <Input type="date" max={today()} value={String(values.hivDiagnosisDate ?? "")} onChange={(e) => set({ hivDiagnosisDate: e.target.value })} className={fieldClass} />
                </Field>
                <Field label={t("art_start_date")}>
                  <Input type="date" max={today()} value={String(values.artStartDate ?? "")} onChange={(e) => set({ artStartDate: e.target.value })} className={fieldClass} />
                </Field>
                <Field label={t("entry_point")}>
                  <select value={String(values.entryPoint)} onChange={(e) => set({ entryPoint: e.target.value })} className={selectClass}>
                    {ENTRY_POINTS.map((x) => <option key={x} value={x}>{t(`entry_${x}`)}</option>)}
                  </select>
                </Field>
                <Field label={t("transfer_in")}>
                  <select value={String(values.transferIn ?? "")} onChange={(e) => set({ transferIn: e.target.value || null, enrolledAt: e.target.value ? today() : undefined })} className={selectClass}>
                    <option value="">{t("transfer_none")}</option>
                    {TRANSFER_SCOPES.map((x) => <option key={x} value={x}>{t(`scope_${x}`)}</option>)}
                  </select>
                </Field>
                {Boolean(values.transferIn) && (
                  <Field label={t("enrolled_at")}>
                    <Input type="date" max={today()} value={String(values.enrolledAt ?? "")} onChange={(e) => set({ enrolledAt: e.target.value })} className={fieldClass} />
                  </Field>
                )}
              </div>
            )}
            {form === "visit" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("date")}>
                    <Input type="date" max={today()} value={String(values.visitDate ?? "")} onChange={(e) => set({ visitDate: e.target.value })} className={fieldClass} />
                  </Field>
                  <Field label={t("days_dispensed")}>
                    <Input type="number" min={1} max={366} value={String(values.daysDispensed ?? "")} onChange={(e) => set({ daysDispensed: Number(e.target.value) })} className={fieldClass} />
                  </Field>
                </div>
                <Field label={t("regimen")}>
                  <select value={String(values.regimenCode)} onChange={(e) => set({ regimenCode: e.target.value })} className={selectClass}>
                    {[1, 2, 3].map((line) => (
                      <optgroup key={line} label={t("line", { line })}>
                        {ART_REGIMENS.filter((r) => r.line === line).map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  {(["tbScreened", "tbSymptomsPositive", "tbTested", "tbConfirmed", "tbTreatmentStarted", "iptStarted", "isEmergencySupply"] as const).map((k) => (
                    <Check key={k} label={t(`visit_${k}`)} checked={values[k] === true} onChange={(v) => set({ [k]: v })} />
                  ))}
                </div>
              </>
            )}
            {form === "status" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("status")}>
                  <select value={String(values.status)} onChange={(e) => set({ status: e.target.value })} className={selectClass}>
                    {(["transferred_out", "dead", "stopped"] as const).map((x) => <option key={x} value={x}>{t(`status_${x}`)}</option>)}
                  </select>
                </Field>
                <Field label={t("date")}>
                  <Input type="date" max={today()} value={String(values.statusChangedAt ?? "")} onChange={(e) => set({ statusChangedAt: e.target.value })} className={fieldClass} />
                </Field>
                {values.status === "transferred_out" && (
                  <Field label={t("transfer_out")}>
                    <select value={String(values.transferOut)} onChange={(e) => set({ transferOut: e.target.value })} className={selectClass}>
                      {TRANSFER_SCOPES.map((x) => <option key={x} value={x}>{t(`scope_${x}`)}</option>)}
                    </select>
                  </Field>
                )}
              </div>
            )}
            {form === "viral_load" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("program")}>
                  <select value={String(values.program)} onChange={(e) => set({ program: e.target.value })} className={selectClass}>
                    {(["hiv", "hbv", "hcv"] as const).map((x) => <option key={x} value={x}>{t(`program_${x}`)}</option>)}
                  </select>
                </Field>
                <Field label={t("date")}>
                  <Input type="date" max={today()} value={String(values.sampledAt ?? "")} onChange={(e) => set({ sampledAt: e.target.value })} className={fieldClass} />
                </Field>
                <Field label={t("value")}>
                  <Input type="number" min={0} disabled={values.belowDetection === true} value={String(values.value ?? "")} onChange={(e) => set({ value: e.target.value })} className={fieldClass} />
                </Field>
                <div className="flex items-end pb-1">
                  <Check label={t("below_detection")} checked={values.belowDetection === true} onChange={(v) => set({ belowDetection: v })} />
                </div>
              </div>
            )}
            {form === "hepatitis" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("hep_type")}>
                  <select value={String(values.type)} onChange={(e) => set({ type: e.target.value })} className={selectClass}>
                    {HEPATITIS_TYPES.map((x) => <option key={x} value={x}>{t(`hep_${x}`)}</option>)}
                  </select>
                </Field>
                {(["diagnosedAt", "eligibleAt", "treatmentStartedAt", "treatmentStoppedAt", "cirrhosisAt", "liverCancerAt", "diedAt", ...(values.type === "hcv" ? ["curedAt"] : [])] as const).map((k) => (
                  <Field key={k} label={t(`hep_${k}`)}>
                    <Input type="date" max={today()} value={String(values[k] ?? "")} onChange={(e) => set({ [k]: e.target.value })} className={fieldClass} />
                  </Field>
                ))}
                {values.type === "hbv" && (
                  <div className="col-span-2">
                    <Check label={t("delta_positive")} checked={values.deltaPositive === true} onChange={(v) => set({ deltaPositive: v })} />
                  </div>
                )}
              </div>
            )}
            {form === "infant" && (
              <div className="grid grid-cols-2 gap-3">
                {(["firstSeenAt", "nevirapineStartedAt", "cotrimoxazoleStartedAt", "visit6to8WeeksAt"] as const).map((k) => (
                  <Field key={k} label={t(`infant_${k}`)}>
                    <Input type="date" max={today()} value={String(values[k] ?? "")} onChange={(e) => set({ [k]: e.target.value })} className={fieldClass} />
                  </Field>
                ))}
                <div className="col-span-2">
                  <Check label={t("born_in_facility")} checked={values.bornInFacility !== false} onChange={(v) => set({ bornInFacility: v })} />
                </div>
                <p className="col-span-2 text-[11px] text-slate-500">{t("infant_pcr_hint")}</p>
              </div>
            )}
          </div>
          <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
            <Button variant="outline" className="text-xs h-8" onClick={() => setForm(null)} disabled={save.isPending}>{t("cancel")}</Button>
            <Button className="text-xs h-8 bg-violet-600 hover:bg-violet-700" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("save")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
