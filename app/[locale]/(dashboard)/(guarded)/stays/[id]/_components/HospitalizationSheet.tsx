"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BedDouble, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { notifyBillingGenerated } from "@/lib/billing/client";
import type { Bed, Department } from "../types";

type RoomType = { id: string; nameFr: string; isActive: boolean; dailyPrice: number | null };

const NO_ROOM_TYPE = "__none__";

const selectClass =
  "flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400";

// Department → room (salle, i.e. the bed's room type) → free bed, plus the planned length of
// stay. A deposit (room's daily price × planned days) is sent to the cashier and the bed is
// held as "reserved" until it's paid. The amount shown here is informative only — the
// server recomputes it from the configured room price.
export function HospitalizationSheet({
  open,
  onOpenChange,
  stayId,
  departments,
  beds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stayId: string;
  departments: Department[];
  beds: (Bed & { roomTypeId?: string | null })[];
  onDone: () => void;
}) {
  const t = useTranslations("admissions");
  const tc = useTranslations("common");

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [bedId, setBedId] = useState("");
  const [days, setDays] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/v1/settings/reference-data/room_type")
      .then((res) => res.json())
      .then((json) => Array.isArray(json) && setRoomTypes(json.filter((item: RoomType) => item.isActive)))
      .catch(() => {});
  }, [open]);

  const freeBeds = useMemo(
    () => beds.filter((bed) => bed.departmentId === departmentId && bed.status === "available"),
    [beds, departmentId]
  );
  // Only offer rooms that actually have a free bed in the chosen department.
  const roomOptions = useMemo(() => {
    const ids = new Set(freeBeds.map((bed) => bed.roomTypeId ?? NO_ROOM_TYPE));
    const options = roomTypes
      .filter((room) => ids.has(room.id))
      .map((room) => ({
        id: room.id,
        label: room.dailyPrice != null
          ? `${room.nameFr} — ${t("room_daily_price", { amount: room.dailyPrice.toLocaleString() })}`
          : `${room.nameFr} — ${t("room_price_missing")}`,
      }));
    if (ids.has(NO_ROOM_TYPE)) options.push({ id: NO_ROOM_TYPE, label: t("room_unspecified") });
    return options;
  }, [freeBeds, roomTypes, t]);
  const bedOptions = freeBeds.filter((bed) => !roomTypeId || (bed.roomTypeId ?? NO_ROOM_TYPE) === roomTypeId);

  // The deposit preview follows the selected bed's room.
  const selectedBed = beds.find((bed) => bed.id === bedId);
  const selectedRoom = roomTypes.find((room) => room.id === selectedBed?.roomTypeId);
  const dayCount = Number(days);
  const validDays = Number.isInteger(dayCount) && dayCount >= 1 && dayCount <= 365;
  const dailyPrice = selectedRoom?.dailyPrice ?? null;
  const deposit = dailyPrice != null && validDays ? dailyPrice * dayCount : null;
  const priceMissing = Boolean(selectedBed) && dailyPrice == null;

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/stays/${stayId}/hospitalization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId, bedId, days: dayCount }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? t("error_save"));
      toast.success(json.data?.hospitalizationStatus === "admitted" ? t("hospitalization_admitted") : t("hospitalization_sent_to_billing"));
      notifyBillingGenerated(json.billing, tc("invoice_generated"));
      onOpenChange(false);
      setDepartmentId("");
      setRoomTypeId("");
      setBedId("");
      setDays("1");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-blue-600" /> {t("hospitalize")}
          </SheetTitle>
          <SheetDescription className="text-xs">{t("hospitalize_desc")}</SheetDescription>
        </SheetHeader>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t("assigned_department")}</label>
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setRoomTypeId("");
                setBedId("");
              }}
              className={selectClass}
            >
              <option value="">{t("select_department")}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name} ({department.code})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t("room")}</label>
            <select
              value={roomTypeId}
              onChange={(e) => {
                setRoomTypeId(e.target.value);
                setBedId("");
              }}
              disabled={!departmentId}
              className={selectClass}
            >
              <option value="">{departmentId ? t("all_rooms") : t("select_department_first")}</option>
              {roomOptions.map((room) => (
                <option key={room.id} value={room.id}>{room.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t("bed")}</label>
            <select value={bedId} onChange={(e) => setBedId(e.target.value)} disabled={!departmentId} className={selectClass}>
              <option value="">
                {!departmentId ? t("select_department_first") : bedOptions.length === 0 ? t("no_free_bed") : t("select_bed")}
              </option>
              {bedOptions.map((bed) => (
                <option key={bed.id} value={bed.id}>{bed.label} ({bed.code})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">{t("planned_days")}</label>
            <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} className="h-9 text-xs bg-white" />
          </div>

          {deposit !== null && dailyPrice !== null && (
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800 space-y-1">
              <div className="font-semibold">
                {t("hospitalization_deposit", { amount: deposit.toLocaleString(), price: dailyPrice.toLocaleString(), days: dayCount })}
              </div>
              <div className="text-[11px] text-blue-700">{t("hospitalization_deposit_hint")}</div>
            </div>
          )}
          {priceMissing && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {t("room_price_missing_hint")}
            </div>
          )}
        </div>

        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-9" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button
            className="text-xs h-9 bg-blue-600 hover:bg-blue-700"
            onClick={handleSubmit}
            disabled={saving || !departmentId || !bedId || !validDays}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
            {t("confirm_hospitalization")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
