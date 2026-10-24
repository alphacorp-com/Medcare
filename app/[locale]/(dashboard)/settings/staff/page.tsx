"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Field, jsonInit, selectClass } from "@/components/programs/form-bits";
import { useProgramError } from "@/components/programs/use-program-error";
import { apiFetch } from "@/lib/api-client";
import { STAFF_CADRES, STAFF_CADRES_BY_CODE } from "@/lib/hr/cadres";

// Staff register (RMA3 VI.5): one line per person, whether or not they have a user account
// (drivers, guards…). Tenant administrators only (the API checks it).

type Staff = {
  id: string;
  fullName: string;
  sex: "M" | "F";
  cadre: string;
  payer: "state" | "local";
  inPost: boolean;
  birthDate: string | null;
  hiredAt: string | null;
  retirementDate: string | null;
  leftAt: string | null;
  notes: string | null;
};

const EMPTY = { fullName: "", sex: "F", cadre: STAFF_CADRES[0].code, payer: "state", inPost: true, birthDate: "", hiredAt: "", retirementDate: "", leftAt: "", notes: "" };
const day = (iso: string | null) => iso?.slice(0, 10) ?? "";

export default function StaffPage() {
  const t = useTranslations("programs.staff");
  const format = useFormatter();
  const [editing, setEditing] = useState<Staff | "new" | null>(null);
  const [showLeft, setShowLeft] = useState(false);
  const staff = useQuery({ queryKey: ["staff"], queryFn: () => apiFetch<{ data: Staff[] }>("/api/v1/settings/staff") });
  const list = (staff.data?.data ?? []).filter((s) => showLeft || !s.leftAt);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{t("title")}</h1>
          <p className="text-xs text-slate-500">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Check label={t("show_left")} checked={showLeft} onChange={setShowLeft} />
          <Button size="sm" className="h-8 text-xs" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" /> {t("new_member")}</Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("full_name")}</th>
              <th className="px-3 py-2">{t("cadre")}</th>
              <th className="px-3 py-2">{t("sex")}</th>
              <th className="px-3 py-2">{t("payer")}</th>
              <th className="px-3 py-2">{t("in_post")}</th>
              <th className="px-3 py-2">{t("retirement_date")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.isLoading && <tr><td colSpan={7} className="px-3 py-4 text-center"><Loader2 className="inline h-4 w-4 animate-spin text-slate-400" /></td></tr>}
            {staff.isError && <tr><td colSpan={7} className="px-3 py-4 text-center text-red-600">{(staff.error as Error).message}</td></tr>}
            {staff.data && list.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center italic text-slate-400">{t("empty")}</td></tr>}
            {list.map((s) => (
              <tr key={s.id} className={s.leftAt ? "text-slate-400" : ""}>
                <td className="px-3 py-2">{s.fullName}</td>
                <td className="px-3 py-2">{STAFF_CADRES_BY_CODE.get(s.cadre)?.label ?? s.cadre}</td>
                <td className="px-3 py-2">{s.sex}</td>
                <td className="px-3 py-2">{t(`payer_${s.payer}`)}</td>
                <td className="px-3 py-2">{s.inPost ? t("yes") : t("no")}</td>
                <td className="px-3 py-2">{s.retirementDate ? format.dateTime(new Date(s.retirementDate), { dateStyle: "medium", timeZone: "UTC" }) : "—"}</td>
                <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setEditing(s)}>{t("edit")}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <StaffDialog member={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StaffDialog({ member, onClose }: { member: Staff | null; onClose: () => void }) {
  const t = useTranslations("programs.staff");
  const tp = useTranslations("programs");
  const queryClient = useQueryClient();
  const apiError = useProgramError();
  const [form, setForm] = useState(
    member
      ? { fullName: member.fullName, sex: member.sex, cadre: member.cadre, payer: member.payer, inPost: member.inPost, birthDate: day(member.birthDate), hiredAt: day(member.hiredAt), retirementDate: day(member.retirementDate), leftAt: day(member.leftAt), notes: member.notes ?? "" }
      : EMPTY
  );
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const save = useMutation({
    mutationFn: () => apiFetch(member ? `/api/v1/settings/staff/${member.id}` : "/api/v1/settings/staff", jsonInit(member ? "PATCH" : "POST", form)),
    onSuccess: () => {
      toast.success(tp("saved"));
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      onClose();
    },
    onError: (error) => toast.error(apiError(error)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{member ? t("edit") : t("new_member")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("full_name")} className="col-span-2"><Input value={form.fullName} maxLength={150} onChange={(e) => set({ fullName: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("cadre")} className="col-span-2">
            <select value={form.cadre} onChange={(e) => set({ cadre: e.target.value })} className={selectClass}>
              {STAFF_CADRES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </Field>
          <Field label={t("sex")}>
            <select value={form.sex} onChange={(e) => set({ sex: e.target.value as "M" | "F" })} className={selectClass}>
              <option value="F">F</option>
              <option value="M">M</option>
            </select>
          </Field>
          <Field label={t("payer")}>
            <select value={form.payer} onChange={(e) => set({ payer: e.target.value as "state" | "local" })} className={selectClass}>
              <option value="state">{t("payer_state")}</option>
              <option value="local">{t("payer_local")}</option>
            </select>
          </Field>
          <Field label={t("birth_date")}><Input type="date" value={form.birthDate} onChange={(e) => set({ birthDate: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("hired_at")}><Input type="date" value={form.hiredAt} onChange={(e) => set({ hiredAt: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("retirement_date")}><Input type="date" value={form.retirementDate} onChange={(e) => set({ retirementDate: e.target.value })} className="h-8 text-xs" /></Field>
          <Field label={t("left_at")}><Input type="date" value={form.leftAt} onChange={(e) => set({ leftAt: e.target.value })} className="h-8 text-xs" /></Field>
          <div className="col-span-2"><Check label={t("in_post")} checked={form.inPost} onChange={(v) => set({ inPost: v })} /></div>
          <p className="col-span-2 text-[10px] text-slate-400">{t("hint")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>{tp("cancel")}</Button>
          <Button size="sm" disabled={!form.fullName.trim() || save.isPending} onClick={() => save.mutate()}>{tp("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
