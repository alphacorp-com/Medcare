"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { PrescriberField } from "@/components/shared/prescriber-field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pill, Plus, Trash2, Loader2, Copy } from "lucide-react";

// One line of the prescription. A drug the pharmacy stocks is picked from the list
// (inventoryId) with the units to dispense; any other drug is free text (inventoryId null)
// and is never dispensed from the stock.
export interface RxItem {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
  inventoryId: string | null;
  quantity: string;
}

export const EMPTY_RX_ITEM: RxItem = { drug: "", dosage: "", frequency: "", duration: "", inventoryId: null, quantity: "" };

// Body lines for POST /api/v1/stays/:id/prescriptions (empty lines dropped).
export function prescriptionPayloadItems(items: RxItem[]) {
  return items
    .filter((item) => item.inventoryId || item.drug.trim() !== "")
    .map(({ quantity, inventoryId, ...item }) => ({ ...item, inventoryId, quantity: inventoryId ? Number(quantity) : null }));
}

const PRESCRIPTION_ERROR_CODES = ["not_a_list", "too_many_lines", "invalid_line", "invalid_drug", "invalid_quantity", "quantity_required", "unknown_article"] as const;

// Translates the 400 of the prescription route ({ code, line }); null for other errors.
export function usePrescriptionErrorMessage() {
  const t = useTranslations("stock.prescription_errors");
  return (body: unknown): string | null => {
    if (!body || typeof body !== "object") return null;
    const { code, line } = body as { code?: unknown; line?: unknown };
    if (typeof code !== "string" || !(PRESCRIPTION_ERROR_CODES as readonly string[]).includes(code)) return null;
    return t(code, { line: typeof line === "number" ? line + 1 : 1 });
  };
}

interface PrescribableArticle {
  id: string;
  name: string;
  unit: string | null;
  dispensable: number;
}

const FREE_TEXT = "__free__";

interface PrescriptionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rxItems: RxItem[];
  setRxItems: (items: RxItem[]) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function PrescriptionSheet({
  open,
  onOpenChange,
  rxItems,
  setRxItems,
  submitting,
  onSubmit,
}: PrescriptionSheetProps) {
  const t = useTranslations('admissions');
  const ts = useTranslations('stock');
  const tc = useTranslations('common');

  // The closed list of stocked articles, with what can be dispensed now.
  const articlesQuery = useQuery({
    queryKey: ["stock", "prescribable"],
    queryFn: () => apiFetch<{ data: PrescribableArticle[] }>("/api/v1/stock/prescribable"),
    enabled: open,
  });
  const articles = articlesQuery.data?.data ?? [];
  const articleById = new Map(articles.map((a) => [a.id, a]));

  const addItem = () => {
    setRxItems([...rxItems, { ...EMPTY_RX_ITEM }]);
  };

  const addMultipleItems = (count: number) => {
    const newItems = Array.from({ length: count }, () => ({ ...EMPTY_RX_ITEM }));
    setRxItems([...rxItems, ...newItems]);
  };

  const duplicateItem = (index: number) => {
    const itemToDuplicate = rxItems[index];
    setRxItems([...rxItems, { ...itemToDuplicate }]);
  };

  const removeItem = (index: number) => {
    setRxItems(rxItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof RxItem, value: string) => {
    const newItems = rxItems.map((item, i) => i === index ? { ...item, [field]: value } : item);
    setRxItems(newItems);
  };

  // Picking a stocked article sets its name; "free text" clears the link.
  const chooseArticle = (index: number, value: string) => {
    const article = articleById.get(value);
    setRxItems(rxItems.map((item, i) => {
      if (i !== index) return item;
      if (article) return { ...item, inventoryId: article.id, drug: article.name };
      return { ...item, inventoryId: null, quantity: "", drug: item.inventoryId ? "" : item.drug };
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px] p-0 flex flex-col h-full max-h-screen">
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-8 pb-6">
            <SheetHeader className="mb-8">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
                <Pill className="h-6 w-6 text-blue-600" />
              </div>
              <SheetTitle className="text-2xl font-bold tracking-tight">{t('new_prescription')}</SheetTitle>
              <SheetDescription className="text-slate-500 leading-relaxed">{t('new_prescription_desc')}</SheetDescription>
            </SheetHeader>

            <form id="rx-form" onSubmit={onSubmit} className="space-y-8">
              <PrescriberField />

              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest">{t('medications')}</Label>
                  <span className="text-[10px] text-slate-400 font-medium">{rxItems.length} item(s)</span>
                </div>
                <div className="space-y-4">
                  {rxItems.map((item, index) => (
                    <div key={index} className="p-5 bg-slate-50/50 rounded-2xl border border-slate-200 relative group transition-all hover:bg-slate-50">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">{t('drug_name')}</Label>
                          <select
                            value={item.inventoryId ?? FREE_TEXT}
                            onChange={(e) => chooseArticle(index, e.target.value)}
                            aria-label={t('drug_name')}
                            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value={FREE_TEXT}>{ts('rx_free_text_option')}</option>
                            {articles.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} — {ts('rx_available', { quantity: a.dispensable, unit: a.unit || ts('units') })}
                              </option>
                            ))}
                          </select>
                          {item.inventoryId ? (
                            <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                inputMode="numeric"
                                placeholder={ts('rx_quantity')}
                                value={item.quantity}
                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                aria-label={ts('rx_quantity')}
                                className="h-10 rounded-lg border-slate-200 focus:ring-blue-500 transition-all"
                                required
                              />
                              <span className="text-xs text-slate-500">{articleById.get(item.inventoryId)?.unit || ts('units')}</span>
                              {Number(item.quantity) > (articleById.get(item.inventoryId)?.dispensable ?? 0) && (
                                <p className="col-span-2 text-[11px] text-orange-700">{ts('rx_quantity_exceeds', { quantity: articleById.get(item.inventoryId)?.dispensable ?? 0 })}</p>
                              )}
                            </div>
                          ) : (
                            <>
                              <Input
                                placeholder={t('drug_placeholder')}
                                value={item.drug}
                                maxLength={255}
                                onChange={(e) => updateItem(index, 'drug', e.target.value)}
                                className="h-10 rounded-lg border-slate-200 focus:ring-blue-500 transition-all"
                                required={index === 0}
                              />
                              <p className="text-[11px] text-slate-400">{ts('rx_free_text_hint')}</p>
                            </>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">{t('dosage')}</Label>
                            <Input
                              placeholder={t('dosage_placeholder')}
                              value={item.dosage}
                              onChange={(e) => updateItem(index, 'dosage', e.target.value)}
                              className="h-10 rounded-lg border-slate-200 focus:ring-blue-500 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">{t('frequency')}</Label>
                            <Input
                              placeholder={t('frequency_placeholder')}
                              value={item.frequency}
                              onChange={(e) => updateItem(index, 'frequency', e.target.value)}
                              className="h-10 rounded-lg border-slate-200 focus:ring-blue-500 transition-all"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">{t('duration')}</Label>
                            <Input
                              placeholder={t('duration_placeholder')}
                              value={item.duration}
                              onChange={(e) => updateItem(index, 'duration', e.target.value)}
                              className="h-10 rounded-lg border-slate-200 focus:ring-blue-500 transition-all"
                            />
                          </div>
                        </div>
                      </div>
                      {index > 0 && (
                        <div className="absolute -right-2 -top-2 flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 shadow-sm transition-all"
                            onClick={() => duplicateItem(index)}
                            title="Duplicate item"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-red-100 text-red-600 hover:bg-red-200 shadow-sm transition-all"
                            onClick={() => removeItem(index)}
                            title="Remove item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10 rounded-xl border-dashed border-slate-300 text-slate-500 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50 transition-all"
                    onClick={addItem}
                  >
                    <Plus className="h-4 w-4 mr-2" /> {t('add_drug_item')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-xl border-dashed border-slate-300 text-slate-500 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50 transition-all"
                    onClick={() => addMultipleItems(3)}
                    title="Add 3 items at once"
                  >
                    <Plus className="h-4 w-4 mr-1" />3
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-xl border-dashed border-slate-300 text-slate-500 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50 transition-all"
                    onClick={() => addMultipleItems(5)}
                    title="Add 5 items at once"
                  >
                    <Plus className="h-4 w-4 mr-1" />5
                  </Button>
                </div>
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('prescription_notes')}</Label>
                <textarea
                  id="notes"
                  name="notes"
                  className="min-h-[100px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 transition-all"
                  placeholder={t('prescription_notes_placeholder')}
                />
              </div>
            </form>
          </div>
        </ScrollArea>
        <div className="flex-shrink-0 p-6 bg-white border-t border-slate-100">
          <div className="flex flex-col gap-3">
            <Button form="rx-form" type="submit" size="lg" className="h-12 w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-sm font-bold shadow-lg shadow-slate-100 transition-all active:scale-95" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" /> : null}
              {t('save_prescription')}
            </Button>
            <Button variant="ghost" className="h-11 w-full rounded-xl text-slate-500 font-medium" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
