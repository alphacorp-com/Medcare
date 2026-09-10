"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ExamCatalogDomain = "laboratory" | "radiology";
type ExamType = { id: string; domain: ExamCatalogDomain; code: string; nameFr: string; nameEn: string | null; order: number; isActive: boolean; _count: { entries: number } };
type ExamEntry = {
  id: string; code: string; nameFr: string; nameEn: string | null; price: string | number | null;
  parameters: { name: string; unit: string; referenceRange: string }[];
  imagingCatalogItemId: string | null; anatomicalZoneId: string | null; requiresContrast: boolean | null; isActive: boolean;
};
type RefItem = { id: string; code: string; nameFr: string };

export default function ExamTypesPage() {
  const t = useTranslations("settings.examTypes");
  const tc = useTranslations("common");

  const [domain, setDomain] = useState<ExamCatalogDomain>("laboratory");
  const [types, setTypes] = useState<ExamType[]>([]);
  const [selectedType, setSelectedType] = useState<ExamType | null>(null);
  const [entries, setEntries] = useState<ExamEntry[]>([]);
  const [imagingItems, setImagingItems] = useState<RefItem[]>([]);
  const [zoneItems, setZoneItems] = useState<RefItem[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  const [isTypeFormOpen, setIsTypeFormOpen] = useState(false);
  const [typeCode, setTypeCode] = useState("");
  const [typeNameFr, setTypeNameFr] = useState("");
  const [typeNameEn, setTypeNameEn] = useState("");
  const [typeError, setTypeError] = useState<string | null>(null);
  const [isSavingType, setIsSavingType] = useState(false);

  const [isEntryFormOpen, setIsEntryFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExamEntry | null>(null);
  const [entryCode, setEntryCode] = useState("");
  const [entryNameFr, setEntryNameFr] = useState("");
  const [entryNameEn, setEntryNameEn] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [entryImagingId, setEntryImagingId] = useState("");
  const [entryZoneId, setEntryZoneId] = useState("");
  const [entryContrast, setEntryContrast] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  const fetchTypes = async (d: ExamCatalogDomain) => {
    setIsLoadingTypes(true);
    try {
      const res = await fetch(`/api/v1/settings/exam-types?domain=${d}`);
      const json = await res.json();
      const list: ExamType[] = Array.isArray(json) ? json : [];
      setTypes(list);
      setSelectedType(list[0] ?? null);
    } finally {
      setIsLoadingTypes(false);
    }
  };

  const fetchEntries = async (typeId: string) => {
    setIsLoadingEntries(true);
    try {
      const res = await fetch(`/api/v1/settings/exam-types/${typeId}/entries`);
      const json = await res.json();
      setEntries(Array.isArray(json) ? json : []);
    } finally {
      setIsLoadingEntries(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchTypes(domain);
      const [imagingRes, zoneRes] = await Promise.all([
        fetch("/api/v1/settings/reference-data/imaging_type"),
        fetch("/api/v1/settings/reference-data/anatomical_zone"),
      ]);
      setImagingItems(await imagingRes.json().catch(() => []));
      setZoneItems(await zoneRes.json().catch(() => []));
    })();
  }, [domain]);

  // entries is only ever rendered when selectedType is set (see the ternary below),
  // so there's no need to reset it when selectedType becomes null.
  useEffect(() => {
    if (!selectedType) return;
    (async () => {
      await fetchEntries(selectedType.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType?.id]);

  const openCreateType = () => {
    setTypeCode(""); setTypeNameFr(""); setTypeNameEn(""); setTypeError(null); setIsTypeFormOpen(true);
  };

  const handleSaveType = async () => {
    if (!typeCode.trim() || !typeNameFr.trim()) {
      setTypeError(t("required_fields"));
      return;
    }
    setIsSavingType(true);
    setTypeError(null);
    try {
      const res = await fetch("/api/v1/settings/exam-types", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, code: typeCode.trim(), nameFr: typeNameFr.trim(), nameEn: typeNameEn.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setTypeError(body?.error || t("save_error"));
        return;
      }
      setIsTypeFormOpen(false);
      fetchTypes(domain);
    } catch {
      setTypeError(t("save_error"));
    } finally {
      setIsSavingType(false);
    }
  };

  const openCreateEntry = () => {
    setEditingEntry(null);
    setEntryCode(""); setEntryNameFr(""); setEntryNameEn(""); setEntryPrice("");
    setEntryImagingId(""); setEntryZoneId(""); setEntryContrast(false);
    setEntryError(null); setIsEntryFormOpen(true);
  };

  const openEditEntry = (entry: ExamEntry) => {
    setEditingEntry(entry);
    setEntryCode(entry.code); setEntryNameFr(entry.nameFr); setEntryNameEn(entry.nameEn ?? "");
    setEntryPrice(entry.price !== null ? String(entry.price) : "");
    setEntryImagingId(entry.imagingCatalogItemId ?? ""); setEntryZoneId(entry.anatomicalZoneId ?? "");
    setEntryContrast(entry.requiresContrast ?? false);
    setEntryError(null); setIsEntryFormOpen(true);
  };

  const handleSaveEntry = async () => {
    if (!selectedType || !entryCode.trim() || !entryNameFr.trim()) {
      setEntryError(t("required_fields"));
      return;
    }
    setIsSavingEntry(true);
    setEntryError(null);
    try {
      const payload = {
        code: entryCode.trim(),
        nameFr: entryNameFr.trim(),
        nameEn: entryNameEn.trim() || undefined,
        price: entryPrice || undefined,
        imagingCatalogItemId: domain === "radiology" ? entryImagingId || undefined : undefined,
        anatomicalZoneId: domain === "radiology" ? entryZoneId || undefined : undefined,
        requiresContrast: domain === "radiology" ? entryContrast : undefined,
      };
      const res = editingEntry
        ? await fetch(`/api/v1/settings/exam-entries/${editingEntry.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          })
        : await fetch(`/api/v1/settings/exam-types/${selectedType.id}/entries`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setEntryError(body?.error || t("save_error"));
        return;
      }
      setIsEntryFormOpen(false);
      fetchEntries(selectedType.id);
    } catch {
      setEntryError(t("save_error"));
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleDeleteEntry = async (entry: ExamEntry) => {
    if (!selectedType || !window.confirm(t("confirm_delete", { name: entry.nameFr }))) return;
    await fetch(`/api/v1/settings/exam-entries/${entry.id}`, { method: "DELETE" });
    fetchEntries(selectedType.id);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">{t("title")}</h1>
        <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
      </div>

      <div className="flex bg-slate-200/50 p-1 rounded-md w-fit">
        {(["laboratory", "radiology"] as ExamCatalogDomain[]).map((d) => (
          <button
            key={d}
            onClick={() => setDomain(d)}
            className={cn("px-3 py-1.5 rounded text-xs font-bold uppercase", domain === d ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}
          >
            {t(`domain_${d}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase">{t("exam_types")}</span>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-blue-600" onClick={openCreateType}>
              <Plus className="h-3 w-3 mr-1" /> {t("new_type")}
            </Button>
          </div>
          {isLoadingTypes ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {types.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type)}
                  className={cn("w-full text-left px-3 py-2 text-xs hover:bg-blue-50/50", selectedType?.id === type.id && "bg-blue-50")}
                >
                  <div className="font-semibold text-slate-800">{type.nameFr}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{type.code} — {t("entries_count", { count: type._count.entries })}</div>
                </button>
              ))}
              {types.length === 0 && <div className="text-center py-8 text-slate-400 italic text-xs">{t("no_types")}</div>}
            </div>
          )}
        </div>

        <div className="col-span-8 bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              {selectedType ? t("exams_in_type", { name: selectedType.nameFr }) : t("select_type")}
            </span>
            {selectedType && (
              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-blue-600" onClick={openCreateEntry}>
                <Plus className="h-3 w-3 mr-1" /> {t("new_exam")}
              </Button>
            )}
          </div>
          {!selectedType ? (
            <div className="text-center py-14 text-slate-400 italic text-xs">{t("select_type")}</div>
          ) : isLoadingEntries ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <div>
                    <div className="font-semibold text-slate-800">{entry.nameFr}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{entry.code}{entry.price ? ` — ${Number(entry.price).toLocaleString()} XAF` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditEntry(entry)} className="text-slate-400 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDeleteEntry(entry)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
              {entries.length === 0 && <div className="text-center py-10 text-slate-400 italic text-xs">{t("no_exams")}</div>}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isTypeFormOpen} onOpenChange={setIsTypeFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("new_type")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {typeError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{typeError}</div>}
            <div className="space-y-1"><Label>{t("code")}</Label><Input value={typeCode} onChange={(e) => setTypeCode(e.target.value)} className="h-9 text-xs font-mono uppercase" /></div>
            <div className="space-y-1"><Label>{t("name_fr")}</Label><Input value={typeNameFr} onChange={(e) => setTypeNameFr(e.target.value)} className="h-9 text-xs" /></div>
            <div className="space-y-1"><Label>{t("name_en")}</Label><Input value={typeNameEn} onChange={(e) => setTypeNameEn(e.target.value)} className="h-9 text-xs" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTypeFormOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={isSavingType} onClick={handleSaveType} className="bg-blue-600 text-white hover:bg-blue-700">
              {isSavingType ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEntryFormOpen} onOpenChange={setIsEntryFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editingEntry ? t("edit_exam") : t("new_exam")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {entryError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{entryError}</div>}
            <div className="space-y-1"><Label>{t("code")}</Label><Input value={entryCode} onChange={(e) => setEntryCode(e.target.value)} className="h-9 text-xs font-mono uppercase" /></div>
            <div className="space-y-1"><Label>{t("name_fr")}</Label><Input value={entryNameFr} onChange={(e) => setEntryNameFr(e.target.value)} className="h-9 text-xs" /></div>
            <div className="space-y-1"><Label>{t("name_en")}</Label><Input value={entryNameEn} onChange={(e) => setEntryNameEn(e.target.value)} className="h-9 text-xs" /></div>
            <div className="space-y-1"><Label>{t("price")} (XAF)</Label><Input type="number" min="0" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} className="h-9 text-xs" /></div>

            {domain === "radiology" && (
              <>
                <div className="space-y-1">
                  <Label>{t("imaging_modality")}</Label>
                  <select value={entryImagingId} onChange={(e) => setEntryImagingId(e.target.value)} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs">
                    <option value="">—</option>
                    {imagingItems.map((i) => <option key={i.id} value={i.id}>{i.nameFr}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>{t("anatomical_zone")}</Label>
                  <select value={entryZoneId} onChange={(e) => setEntryZoneId(e.target.value)} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs">
                    <option value="">—</option>
                    {zoneItems.map((z) => <option key={z.id} value={z.id}>{z.nameFr}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={entryContrast} onChange={(e) => setEntryContrast(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  {t("requires_contrast")}
                </label>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEntryFormOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={isSavingEntry} onClick={handleSaveEntry} className="bg-blue-600 text-white hover:bg-blue-700">
              {isSavingEntry ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
