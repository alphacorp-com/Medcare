"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { useStockErrorMessage } from "@/components/shared/use-stock-error-message";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { InventoryRow, OpenVialRow, StockLotRow, StockMovementRow, StorageLocationOption, SupplierOption } from "../types";
import { useConfirm } from "@/components/providers/confirm-provider";

// Receipt, loss and stock detail (lots, inventory count, journal) of one article. Every
// quantity is applied server-side by lib/stock; these sheets only collect the input.

const INVENTORY_KEY = ["pharmacy", "inventory"];
const movementsKey = (itemId: string | undefined) => ["pharmacy", "inventory", itemId, "movements"];

interface MovementsResponse {
  dispensingLocationId: string | null;
  lots: StockLotRow[];
  openVials: OpenVialRow[];
  data: StockMovementRow[];
  total: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const fieldClass = "h-8 text-xs bg-white border-slate-200";
const selectClass =
  "flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-slate-400">{hint}</span>}
    </label>
  );
}

// POSTs one movement and refreshes the inventory and the article's journal.
function useRecordMovement(item: InventoryRow | null, onDone: () => void) {
  const queryClient = useQueryClient();
  const t = useTranslations("stock");
  const stockError = useStockErrorMessage();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/v1/pharmacy/inventory/${item?.id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      toast.success(t("saved"));
      await queryClient.invalidateQueries({ queryKey: INVENTORY_KEY });
      onDone();
    },
    onError: (error) => toast.error(stockError(error instanceof Error ? error.message : null) ?? t("save_error")),
  });
}

function useLotsAndMovements(item: InventoryRow | null, page = 1, pageSize = 10) {
  return useQuery({
    queryKey: [...movementsKey(item?.id), page, pageSize],
    queryFn: () => apiFetch<MovementsResponse>(`/api/v1/pharmacy/inventory/${item?.id}/movements?page=${page}&pageSize=${pageSize}`),
    enabled: Boolean(item),
  });
}

// ── Receipt ─────────────────────────────────────────────────────────────────

export function ReceiptSheet({
  item,
  suppliers,
  locations,
  onOpenChange,
}: {
  item: InventoryRow | null;
  suppliers: SupplierOption[];
  locations: StorageLocationOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("stock");
  const tc = useTranslations("common");
  // locationId "" = the article's dispensing depot (resolved by the server).
  const empty = { locationId: "", lotNumber: "", expiryDate: "", quantity: "", unitCost: "", supplierId: "", occurredAt: today(), reason: "" };
  const [form, setForm] = useState(empty);
  const close = () => {
    setForm(empty);
    onOpenChange(false);
  };
  const mutation = useRecordMovement(item, close);
  const quantity = Number(form.quantity);
  const valid = form.lotNumber.trim() !== "" && Number.isInteger(quantity) && quantity > 0;

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => (open ? null : close())}>
      <SheetContent className="sm:max-w-md w-full p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t("receipt_title")}</SheetTitle>
          <SheetDescription className="text-xs">{t("receipt_desc", { name: item?.name ?? "" })}</SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("lot_number")}>
              <Input value={form.lotNumber} maxLength={60} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} className={cn(fieldClass, "font-mono uppercase")} />
            </Field>
            <Field label={t("expiry_date")}>
              <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={fieldClass} />
            </Field>
            <Field label={t("quantity_received", { unit: item?.unit || t("units") })}>
              <Input type="number" min={1} step={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={cn(fieldClass, "font-mono")} />
            </Field>
            <Field label={t("unit_cost")}>
              <Input type="number" min={0} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} className={cn(fieldClass, "font-mono")} />
            </Field>
            <Field label={t("received_on")}>
              <Input type="date" max={today()} value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} className={fieldClass} />
            </Field>
            <Field label={t("supplier")}>
              <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className={selectClass}>
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t("receiving_location")}>
            <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className={selectClass}>
              <option value="">{t("dispensing_location_default")}</option>
              {locations.filter((l) => l.id !== item?.storageLocationId).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("reference")} hint={t("reference_hint")}>
            <Input value={form.reason} maxLength={255} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={fieldClass} />
          </Field>
          {item && valid && (
            <div className="bg-green-50 p-3 rounded border border-green-200 text-xs flex justify-between">
              <span className="font-bold text-green-700 uppercase">{t("new_total")}</span>
              <span className="font-mono font-bold text-green-800">{item.stock + quantity} {item.unit}</span>
            </div>
          )}
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={close} disabled={mutation.isPending}>{tc("cancel")}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate({ kind: "receipt", ...form })}>
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("record_receipt")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Loss (expired, damaged, lost) ───────────────────────────────────────────

export function LossSheet({ item, onOpenChange }: { item: InventoryRow | null; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("stock");
  const tc = useTranslations("common");
  const format = useFormatter();
  const empty = { type: "expired", lotId: "", quantity: "", reason: "", occurredAt: today() };
  const [form, setForm] = useState(empty);
  const close = () => {
    setForm(empty);
    onOpenChange(false);
  };
  const mutation = useRecordMovement(item, close);
  const lotsQuery = useLotsAndMovements(item, 1, 1);
  const lots = lotsQuery.data?.lots ?? [];
  const selectedLot = lots.find((l) => l.id === form.lotId);
  const quantity = Number(form.quantity);
  // Without a lot, the loss is taken FEFO from the dispensing depot's lots.
  const dispensingLots = lots.filter((l) => l.locationId === lotsQuery.data?.dispensingLocationId);
  const max = selectedLot ? selectedLot.quantity : dispensingLots.reduce((sum, l) => sum + l.quantity, 0);
  const valid = Number.isInteger(quantity) && quantity > 0 && quantity <= max && form.reason.trim() !== "";

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => (open ? null : close())}>
      <SheetContent className="sm:max-w-md w-full p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t("loss_title")}</SheetTitle>
          <SheetDescription className="text-xs">{t("loss_desc", { name: item?.name ?? "" })}</SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <Field label={t("loss_type")}>
            <div className="grid grid-cols-3 gap-1 rounded-md bg-slate-200/50 p-1" role="radiogroup">
              {(["expired", "damaged", "lost"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={form.type === type}
                  onClick={() => setForm({ ...form, type })}
                  className={cn("rounded px-2 py-1 text-[11px] font-semibold", form.type === type ? "bg-white shadow-sm text-slate-800" : "text-slate-500")}
                >
                  {t(`movement_${type}`)}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("lot")} hint={form.lotId ? undefined : t("lot_fefo_hint")}>
            <select value={form.lotId} onChange={(e) => setForm({ ...form, lotId: e.target.value })} className={selectClass}>
              <option value="">{t("lot_auto")}</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber} · {lot.locationName} — {lot.quantity} · {lot.expiryDate ? format.dateTime(new Date(lot.expiryDate), { dateStyle: "short", timeZone: "UTC" }) : t("no_expiry")}
                  {lot.isExpired ? ` (${t("expired_badge")})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("quantity_lost", { max })}>
              <Input type="number" min={1} max={max} step={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={cn(fieldClass, "font-mono")} />
            </Field>
            <Field label={t("occurred_on")}>
              <Input type="date" max={today()} value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} className={fieldClass} />
            </Field>
          </div>
          <Field label={t("reason_required_label")}>
            <Input value={form.reason} maxLength={255} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={fieldClass} />
          </Field>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={close} disabled={mutation.isPending}>{tc("cancel")}</Button>
          <Button className="text-xs h-8 bg-red-600 hover:bg-red-700" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate({ kind: "loss", ...form, lotId: form.lotId || null })}>
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("record_loss")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── Transfer between depots ─────────────────────────────────────────────────

export function TransferSheet({
  item,
  locations,
  onOpenChange,
}: {
  item: InventoryRow | null;
  locations: StorageLocationOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("stock");
  const tc = useTranslations("common");
  const format = useFormatter();
  const empty = { lotId: "", toLocationId: "", quantity: "", reason: "", occurredAt: today() };
  const [form, setForm] = useState(empty);
  const close = () => {
    setForm(empty);
    onOpenChange(false);
  };
  const mutation = useRecordMovement(item, close);
  const lotsQuery = useLotsAndMovements(item, 1, 1);
  const lots = lotsQuery.data?.lots ?? [];
  const lot = lots.find((l) => l.id === form.lotId);
  const quantity = Number(form.quantity);
  const valid = Boolean(lot) && form.toLocationId !== "" && form.toLocationId !== lot?.locationId && Number.isInteger(quantity) && quantity > 0 && quantity <= (lot?.quantity ?? 0);

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => (open ? null : close())}>
      <SheetContent className="sm:max-w-md w-full p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{t("transfer_title")}</SheetTitle>
          <SheetDescription className="text-xs">{t("transfer_desc", { name: item?.name ?? "" })}</SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <Field label={t("lot")}>
            <select value={form.lotId} onChange={(e) => setForm({ ...form, lotId: e.target.value, toLocationId: "" })} className={selectClass}>
              <option value="">{tc("select_placeholder")}</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lotNumber} · {l.locationName} — {l.quantity} · {l.expiryDate ? format.dateTime(new Date(l.expiryDate), { dateStyle: "short", timeZone: "UTC" }) : t("no_expiry")}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("destination")}>
            <select value={form.toLocationId} onChange={(e) => setForm({ ...form, toLocationId: e.target.value })} className={selectClass} disabled={!lot}>
              <option value="">{tc("select_placeholder")}</option>
              {locations.filter((l) => l.id !== lot?.locationId).map((l) => (
                <option key={l.id} value={l.id}>{l.name}{l.id === item?.storageLocationId ? ` (${t("dispensing_badge")})` : ""}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("quantity_lost", { max: lot?.quantity ?? 0 })}>
              <Input type="number" min={1} max={lot?.quantity ?? 0} step={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={cn(fieldClass, "font-mono")} />
            </Field>
            <Field label={t("occurred_on")}>
              <Input type="date" max={today()} value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} className={fieldClass} />
            </Field>
          </div>
          <Field label={t("reference")}>
            <Input value={form.reason} maxLength={255} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={fieldClass} />
          </Field>
        </div>
        <SheetFooter className="p-4 border-t border-slate-200 bg-white shrink-0">
          <Button variant="outline" className="text-xs h-8" onClick={close} disabled={mutation.isPending}>{tc("cancel")}</Button>
          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate({ kind: "transfer", ...form })}>
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("record_transfer")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Open multi-dose vials of the article, with a discard action (doses left = wastage).
function OpenVials({ vials }: { vials: OpenVialRow[] }) {
  const t = useTranslations("stock");
  const confirm = useConfirm();
  const format = useFormatter();
  const queryClient = useQueryClient();
  const stockError = useStockErrorMessage();
  const discard = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/v1/stock/open-vials/${id}/discard`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVENTORY_KEY }),
    onError: (error) => toast.error(stockError(error instanceof Error ? error.message : null) ?? t("save_error")),
  });
  if (vials.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t("open_vials_title")}</h3>
      <ul className="space-y-1">
        {vials.map((vial) => (
          <li key={vial.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-xs">
            <span>
              <span className="font-mono font-semibold">{vial.lotNumber}</span> — {t("open_vial_doses", { left: vial.dosesLeft, total: vial.dosesPerVial })} ·{" "}
              {t("open_vial_until", { at: format.dateTime(new Date(vial.discardAt), { dateStyle: "short", timeStyle: "short" }) })}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-red-600"
              disabled={discard.isPending}
              onClick={async () => {
                if ((await confirm({ message: t("open_vial_discard_confirm", { left: vial.dosesLeft }), tone: "danger" }))) discard.mutate(vial.id);
              }}
            >
              {t("open_vial_discard")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Detail: lots (with inventory count) and journal ─────────────────────────

function CountRow({ item, lot }: { item: InventoryRow; lot: StockLotRow }) {
  const t = useTranslations("stock");
  const [counting, setCounting] = useState(false);
  const [counted, setCounted] = useState(String(lot.quantity));
  const [reason, setReason] = useState("");
  const mutation = useRecordMovement(item, () => setCounting(false));
  const countedNumber = Number(counted);
  const valid = Number.isInteger(countedNumber) && countedNumber >= 0 && countedNumber !== lot.quantity && reason.trim() !== "";

  if (!counting) {
    return (
      <button type="button" className="text-[11px] font-semibold text-blue-600 hover:underline" onClick={() => setCounting(true)}>
        {t("count_action")}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Input type="number" min={0} step={1} value={counted} onChange={(e) => setCounted(e.target.value)} aria-label={t("counted_quantity")} className="h-7 w-20 text-xs font-mono" />
      <Input value={reason} maxLength={255} placeholder={t("count_reason_placeholder")} onChange={(e) => setReason(e.target.value)} aria-label={t("reason_required_label")} className="h-7 w-40 text-xs" />
      <Button size="sm" className="h-7 px-2 text-[11px] bg-blue-600 hover:bg-blue-700" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate({ kind: "count", lotId: lot.id, countedQuantity: countedNumber, reason })}>
        {t("count_save")}
      </Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setCounting(false)}>✕</Button>
    </div>
  );
}

export function StockDetailSheet({ item, onOpenChange }: { item: InventoryRow | null; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("stock");
  const format = useFormatter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const query = useLotsAndMovements(item, page, pageSize);
  const lots = query.data?.lots ?? [];
  const movements = query.data?.data ?? [];
  const date = (iso: string | null, withTime = false) =>
    iso ? format.dateTime(new Date(iso), withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short", timeZone: "UTC" }) : "—";

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => { if (!open) { setPage(1); onOpenChange(false); } }}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col bg-slate-50">
        <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
          <SheetTitle className="text-lg">{item?.name}</SheetTitle>
          <SheetDescription className="text-xs">
            {t("detail_desc", { stock: item?.stock ?? 0, unit: item?.unit || t("units") })}
          </SheetDescription>
        </SheetHeader>
        <div className="p-4 flex-1 overflow-y-auto space-y-5">
          {query.isPending ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : query.isError ? (
            <p className="text-xs text-red-600">{t("load_error")}</p>
          ) : (
            <>
              <section className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t("lots_title")}</h3>
                {lots.length === 0 ? (
                  <p className="text-xs text-slate-400">{t("no_lots")}</p>
                ) : (
                  <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">{t("lot_number")}</th>
                          <th className="px-3 py-2">{t("location")}</th>
                          <th className="px-3 py-2">{t("expiry_date")}</th>
                          <th className="px-3 py-2 text-right">{t("quantity")}</th>
                          <th className="px-3 py-2 text-right">{t("count_column")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lots.map((lot) => (
                          <tr key={lot.id} className={cn(lot.isExpired && "bg-red-50/60")}>
                            <td className="px-3 py-2 font-mono">{lot.lotNumber}</td>
                            <td className="px-3 py-2">
                              {lot.locationName}
                              {lot.locationId === query.data?.dispensingLocationId && (
                                <span className="ml-1 rounded bg-blue-50 px-1 py-0.5 text-[10px] font-semibold text-blue-700">{t("dispensing_badge")}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {lot.expiryDate ? date(lot.expiryDate) : t("no_expiry")}
                              {lot.isExpired && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{t("expired_badge")}</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold">{lot.quantity}</td>
                            <td className="px-3 py-2 text-right">{item && <CountRow key={`${lot.id}:${lot.quantity}`} item={item} lot={lot} />}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <OpenVials vials={query.data?.openVials ?? []} />

              <section className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t("journal_title")}</h3>
                {movements.length === 0 ? (
                  <p className="text-xs text-slate-400">{t("no_movements")}</p>
                ) : (
                  <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">{t("date")}</th>
                          <th className="px-3 py-2">{t("movement")}</th>
                          <th className="px-3 py-2">{t("lot")}</th>
                          <th className="px-3 py-2 text-right">{t("quantity")}</th>
                          <th className="px-3 py-2 text-right">{t("balance")}</th>
                          <th className="px-3 py-2">{t("by")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {movements.map((m) => (
                          <tr key={m.id}>
                            <td className="px-3 py-2 whitespace-nowrap">{date(m.occurredAt, true)}</td>
                            <td className="px-3 py-2">
                              <span className="font-semibold text-slate-700">{t(`movement_${m.type}`)}</span>
                              {m.reason && <span className="block text-[10px] text-slate-400">{m.reason}</span>}
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-mono">{m.lotNumber ?? "—"}</span>
                              <span className="block text-[10px] text-slate-400">{m.locationName}</span>
                            </td>
                            <td className={cn("px-3 py-2 text-right font-mono font-semibold", m.quantity > 0 ? "text-green-700" : "text-red-700")}>
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{m.balanceAfter}</td>
                            <td className="px-3 py-2 text-slate-500">{m.recordedByName ?? t("system")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <PaginationBar
                  page={page}
                  pageSize={pageSize}
                  total={query.data?.total ?? 0}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                />
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
