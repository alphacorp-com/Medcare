"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatientSearchAutocomplete } from "@/components/shared/patient-search-autocomplete";
import { Field, jsonInit, selectClass, today } from "@/components/programs/form-bits";
import { useProgramError } from "@/components/programs/use-program-error";
import { useUrlTab } from "@/hooks/use-url-tab";
import { apiFetch } from "@/lib/api-client";
import { useAppStore } from "@/lib/store/useAppStore";
import { BLOOD_GROUPS, DONOR_TYPES, TEST_RESULTS } from "@/lib/blood-bank/input";

// Blood bank (RMA3 V.6), laboratory module: donors, mobile collections, bags with their
// screening tests and what became of them. Every check is made again by the server.

type Donor = { id: string; code: string; fullName: string; sex: string; bloodGroup: string | null; donorType: string; _count: { donations: number } };
type Session = { id: string; heldAt: string; location: string; _count: { donations: number } };
type Bag = {
  id: string;
  bagNumber: string;
  collectedAt: string;
  status: string;
  hivResult: string;
  hbvResult: string;
  hcvResult: string;
  syphilisResult: string;
  donor: { code: string; fullName: string; donorType: string; bloodGroup: string | null };
  session: { location: string } | null;
};

const TESTS = ["hivResult", "hbvResult", "hcvResult", "syphilisResult"] as const;
const STATUSES = ["quarantine", "available", "served", "transfused", "destroyed"] as const;

function useSave<T>(url: string, method: string, onDone: () => void) {
  const queryClient = useQueryClient();
  const apiError = useProgramError();
  const t = useTranslations("programs");
  return useMutation({
    mutationFn: (body: T) => apiFetch(url, jsonInit(method, body)),
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: ["blood-bank"] });
      onDone();
    },
    onError: (error) => toast.error(apiError(error)),
  });
}

function BloodBankContent() {
  const t = useTranslations("programs.blood");
  const tc = useTranslations("common");
  const hasPermission = useAppStore((state) => state.hasPermission);
  const canRead = hasPermission("MODULE_LAB", "read");
  const canCreate = hasPermission("MODULE_LAB", "create");
  const canUpdate = hasPermission("MODULE_LAB", "update");
  const [tab, setTab] = useUrlTab(["bags", "donors", "sessions"] as const, "bags");
  if (!canRead) return <p className="p-6 text-sm text-slate-500">{tc("restricted_access")}</p>;
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
        <p className="text-xs text-slate-500">{t("subtitle")}</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="bags">{t("tab_bags")}</TabsTrigger>
          <TabsTrigger value="donors">{t("tab_donors")}</TabsTrigger>
          <TabsTrigger value="sessions">{t("tab_sessions")}</TabsTrigger>
        </TabsList>
        <TabsContent value="bags" className="pt-4"><BagsTab canCreate={canCreate} canUpdate={canUpdate} /></TabsContent>
        <TabsContent value="donors" className="pt-4"><DonorsTab canCreate={canCreate} /></TabsContent>
        <TabsContent value="sessions" className="pt-4"><SessionsTab canCreate={canCreate} /></TabsContent>
      </Tabs>
    </div>
  );
}

function BagsTab({ canCreate, canUpdate }: { canCreate: boolean; canUpdate: boolean }) {
  const t = useTranslations("programs.blood");
  const format = useFormatter();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("quarantine");
  const [newOpen, setNewOpen] = useState(false);
  const [actionBag, setActionBag] = useState<Bag | null>(null);
  const bags = useQuery({ queryKey: ["blood-bank", "bags", status], queryFn: () => apiFetch<{ data: Bag[] }>(`/api/v1/blood-bank/donations?status=${status}`) });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Field label={t("status")} className="w-48">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectClass}>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status_${s}`)}</option>)}
          </select>
        </Field>
        {canCreate && <Button size="sm" className="h-8 text-xs" onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5" /> {t("new_donation")}</Button>}
      </div>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("bag_number")}</th>
              <th className="px-3 py-2">{t("donor")}</th>
              <th className="px-3 py-2">{t("collected_at")}</th>
              <th className="px-3 py-2">{t("tests")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bags.isLoading && <tr><td colSpan={5} className="px-3 py-4 text-center"><Loader2 className="inline h-4 w-4 animate-spin text-slate-400" /></td></tr>}
            {bags.data?.data.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center italic text-slate-400">{t("no_bags")}</td></tr>}
            {bags.data?.data.map((b) => (
              <tr key={b.id}>
                <td className="px-3 py-2 font-mono">{b.bagNumber}</td>
                <td className="px-3 py-2">{b.donor.fullName} <span className="text-slate-400">{b.donor.bloodGroup ?? ""}</span></td>
                <td className="px-3 py-2">{format.dateTime(new Date(b.collectedAt), { dateStyle: "medium" })}{b.session ? ` · ${b.session.location}` : ""}</td>
                <td className="px-3 py-2">
                  {TESTS.map((k) => (
                    <span key={k} className={`mr-1 rounded px-1.5 py-0.5 text-[10px] ${b[k] === "negative" ? "bg-emerald-50 text-emerald-700" : b[k] === "not_done" ? "bg-slate-100 text-slate-500" : "bg-red-50 text-red-700"}`}>
                      {t(`test_short_${k}`)} {t(`result_short_${b[k]}`)}
                    </span>
                  ))}
                </td>
                <td className="px-3 py-2 text-right">
                  {canUpdate && b.status !== "transfused" && b.status !== "destroyed" && (
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setActionBag(b)}>{t("actions")}</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {newOpen && <DonationDialog onClose={() => setNewOpen(false)} />}
      {actionBag && <BagActionDialog bag={actionBag} onClose={() => setActionBag(null)} />}
    </div>
  );
}

function DonationDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("programs.blood");
  const tp = useTranslations("programs");
  const [q, setQ] = useState("");
  const donors = useQuery({ queryKey: ["blood-bank", "donors", q], queryFn: () => apiFetch<{ data: Donor[] }>(`/api/v1/blood-bank/donors?q=${encodeURIComponent(q)}`) });
  const sessions = useQuery({ queryKey: ["blood-bank", "sessions"], queryFn: () => apiFetch<{ data: Session[] }>("/api/v1/blood-bank/sessions") });
  const [form, setForm] = useState({ donorId: "", sessionId: "", bagNumber: "", collectedAt: today(), hivResult: "not_done", hbvResult: "not_done", hcvResult: "not_done", syphilisResult: "not_done" });
  const save = useSave<typeof form>("/api/v1/blood-bank/donations", "POST", onClose);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("new_donation")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("search_donor")} className="col-span-2"><Input value={q} onChange={(e) => setQ(e.target.value)} className="h-8 text-xs" /></Field>
          <Field label={t("donor")} className="col-span-2">
            <select value={form.donorId} onChange={(e) => set({ donorId: e.target.value })} className={selectClass}>
              <option value="">—</option>
              {donors.data?.data.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.fullName}</option>)}
            </select>
          </Field>
          <Field label={t("bag_number")}><Input value={form.bagNumber} maxLength={40} onChange={(e) => set({ bagNumber: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("collected_at")}><Input type="date" value={form.collectedAt} max={today()} onChange={(e) => set({ collectedAt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("collection_site")} className="col-span-2">
            <select value={form.sessionId} onChange={(e) => set({ sessionId: e.target.value })} className={selectClass}>
              <option value="">{t("fixed_post")}</option>
              {sessions.data?.data.map((s) => <option key={s.id} value={s.id}>{t("mobile_session")} : {s.location} ({s.heldAt.slice(0, 10)})</option>)}
            </select>
          </Field>
          {TESTS.map((k) => (
            <Field key={k} label={t(`test_${k}`)}>
              <select value={form[k]} onChange={(e) => set({ [k]: e.target.value })} className={selectClass}>
                {TEST_RESULTS.map((r) => <option key={r} value={r}>{t(`result_${r}`)}</option>)}
              </select>
            </Field>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={!form.donorId || !form.bagNumber || save.isPending} onClick={() => save.mutate(form)}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BagActionDialog({ bag, onClose }: { bag: Bag; onClose: () => void }) {
  const t = useTranslations("programs.blood");
  const tp = useTranslations("programs");
  const actions = bag.status === "quarantine" ? ["tests", "release", "destroy"] : bag.status === "available" ? ["serve", "transfuse", "destroy"] : ["transfuse", "destroy"];
  const [action, setAction] = useState(actions[0]);
  const [form, setForm] = useState({ at: today(), reason: "", recipientPatientId: "", hivResult: bag.hivResult, hbvResult: bag.hbvResult, hcvResult: bag.hcvResult, syphilisResult: bag.syphilisResult });
  const save = useSave<Record<string, unknown>>(`/api/v1/blood-bank/donations/${bag.id}`, "PATCH", onClose);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const body = () =>
    action === "tests"
      ? { action, hivResult: form.hivResult, hbvResult: form.hbvResult, hcvResult: form.hcvResult, syphilisResult: form.syphilisResult }
      : action === "release"
        ? { action }
        : action === "destroy"
          ? { action, at: form.at, reason: form.reason }
          : action === "transfuse"
            ? { action, at: form.at, recipientPatientId: form.recipientPatientId || null }
            : { action, at: form.at };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("bag")} {bag.bagNumber}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label={t("action")}>
            <select value={action} onChange={(e) => setAction(e.target.value)} className={selectClass}>
              {actions.map((a) => <option key={a} value={a}>{t(`action_${a}`)}</option>)}
            </select>
          </Field>
          {action === "tests" && (
            <div className="grid grid-cols-2 gap-3">
              {TESTS.map((k) => (
                <Field key={k} label={t(`test_${k}`)}>
                  <select value={form[k]} onChange={(e) => set({ [k]: e.target.value })} className={selectClass}>
                    {TEST_RESULTS.map((r) => <option key={r} value={r}>{t(`result_${r}`)}</option>)}
                  </select>
                </Field>
              ))}
            </div>
          )}
          {action === "release" && <p className="text-xs text-slate-500">{t("release_hint")}</p>}
          {["serve", "transfuse", "destroy"].includes(action) && (
            <Field label={t("date")}><Input type="date" value={form.at} max={today()} onChange={(e) => set({ at: e.target.value })} className="h-8 text-xs" /></Field>
          )}
          {action === "transfuse" && <Field label={t("recipient")}><PatientSearchAutocomplete className="h-8 text-xs" onSelect={(p) => set({ recipientPatientId: p?.id ?? "" })} /></Field>}
          {action === "destroy" && <Field label={t("reason")}><Input value={form.reason} maxLength={200} onChange={(e) => set({ reason: e.target.value })} className="h-8 text-xs" /></Field>}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(body())}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DonorsTab({ canCreate }: { canCreate: boolean }) {
  const t = useTranslations("programs.blood");
  const tp = useTranslations("programs");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const donors = useQuery({ queryKey: ["blood-bank", "donors", q], queryFn: () => apiFetch<{ data: Donor[] }>(`/api/v1/blood-bank/donors?q=${encodeURIComponent(q)}`) });
  const [form, setForm] = useState({ code: "", fullName: "", sex: "M", birthDate: "", phone: "", bloodGroup: "", donorType: "voluntary", patientId: "" });
  const save = useSave<typeof form>("/api/v1/blood-bank/donors", "POST", () => setOpen(false));
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <Field label={t("search_donor")} className="w-64"><Input value={q} onChange={(e) => setQ(e.target.value)} className="h-8 text-xs" /></Field>
        {canCreate && <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> {t("new_donor")}</Button>}
      </div>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("code")}</th>
              <th className="px-3 py-2">{t("full_name")}</th>
              <th className="px-3 py-2">{t("blood_group")}</th>
              <th className="px-3 py-2">{t("donor_type")}</th>
              <th className="px-3 py-2">{t("donations")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {donors.data?.data.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center italic text-slate-400">{t("no_donors")}</td></tr>}
            {donors.data?.data.map((d) => (
              <tr key={d.id}>
                <td className="px-3 py-2 font-mono">{d.code}</td>
                <td className="px-3 py-2">{d.fullName}</td>
                <td className="px-3 py-2">{d.bloodGroup ?? "—"}</td>
                <td className="px-3 py-2">{t(`donor_${d.donorType}`)}</td>
                <td className="px-3 py-2">{d._count.donations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{t("new_donor")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("code")}><Input value={form.code} maxLength={40} onChange={(e) => set({ code: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label={t("donor_type")}>
                <select value={form.donorType} onChange={(e) => set({ donorType: e.target.value })} className={selectClass}>
                  {DONOR_TYPES.map((x) => <option key={x} value={x}>{t(`donor_${x}`)}</option>)}
                </select>
              </Field>
              <Field label={t("full_name")} className="col-span-2"><Input value={form.fullName} maxLength={150} onChange={(e) => set({ fullName: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label={t("sex")}>
                <select value={form.sex} onChange={(e) => set({ sex: e.target.value })} className={selectClass}>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </Field>
              <Field label={t("blood_group")}>
                <select value={form.bloodGroup} onChange={(e) => set({ bloodGroup: e.target.value })} className={selectClass}>
                  <option value="">—</option>
                  {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label={t("birth_date")}><Input type="date" value={form.birthDate} max={today()} onChange={(e) => set({ birthDate: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label={t("phone")}><Input value={form.phone} maxLength={30} onChange={(e) => set({ phone: e.target.value })} className="h-8 text-xs" /></Field>
              <Field label={t("patient_file")} className="col-span-2"><PatientSearchAutocomplete className="h-8 text-xs" onSelect={(p) => set({ patientId: p?.id ?? "" })} /></Field>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>{tp("cancel")}</Button>
              <Button size="sm" disabled={!form.code || !form.fullName || save.isPending} onClick={() => save.mutate(form)}>{tp("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function SessionsTab({ canCreate }: { canCreate: boolean }) {
  const t = useTranslations("programs.blood");
  const tp = useTranslations("programs");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ heldAt: today(), location: "" });
  const sessions = useQuery({ queryKey: ["blood-bank", "sessions"], queryFn: () => apiFetch<{ data: Session[] }>("/api/v1/blood-bank/sessions") });
  const save = useSave<typeof form>("/api/v1/blood-bank/sessions", "POST", () => setOpen(false));
  return (
    <div className="space-y-3">
      <div className="flex justify-end">{canCreate && <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> {t("new_session")}</Button>}</div>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("date")}</th>
              <th className="px-3 py-2">{t("location")}</th>
              <th className="px-3 py-2">{t("donations")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sessions.data?.data.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center italic text-slate-400">{t("no_sessions")}</td></tr>}
            {sessions.data?.data.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2">{format.dateTime(new Date(s.heldAt), { dateStyle: "medium" })}</td>
                <td className="px-3 py-2">{s.location}</td>
                <td className="px-3 py-2">{s._count.donations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>{t("new_session")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Field label={t("date")}><Input type="date" value={form.heldAt} max={today()} onChange={(e) => setForm((f) => ({ ...f, heldAt: e.target.value }))} className="h-8 text-xs" /></Field>
              <Field label={t("location")}><Input value={form.location} maxLength={150} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="h-8 text-xs" /></Field>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>{tp("cancel")}</Button>
              <Button size="sm" disabled={!form.location || save.isPending} onClick={() => save.mutate(form)}>{tp("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// The active tab lives in the URL (?tab=, see useUrlTab), which needs a Suspense boundary.
export default function BloodBankPage() {
  return (
    <Suspense fallback={null}>
      <BloodBankContent />
    </Suspense>
  );
}
