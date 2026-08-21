"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Stethoscope, Loader2, Plus, Trash2 } from "lucide-react";
import { Doctor, CatalogOption, MedicalActOption, OrderItem, OrderSource } from "../types";

interface MedicalOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  labCatalog: CatalogOption[];
  radiologyCatalog: CatalogOption[];
  medicalActs: MedicalActOption[];
  orderItems: OrderItem[];
  setOrderItems: (items: OrderItem[]) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

const EMPTY_ORDER_ITEM: OrderItem = { source: "laboratory", code: "", urgency: "routine" };

function formatOption(option: CatalogOption) {
  return option.price != null ? `${option.label} — ${option.price} FCFA` : option.label;
}

export function MedicalOrderSheet({
  open,
  onOpenChange,
  doctors,
  labCatalog,
  radiologyCatalog,
  medicalActs,
  orderItems,
  setOrderItems,
  submitting,
  onSubmit,
}: MedicalOrderSheetProps) {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');

  const catalogForSource = (source: OrderSource): CatalogOption[] => {
    if (source === "laboratory") return labCatalog;
    if (source === "radiology") return radiologyCatalog;
    return medicalActs;
  };

  const addItem = () => setOrderItems([...orderItems, { ...EMPTY_ORDER_ITEM }]);
  const removeItem = (index: number) => setOrderItems(orderItems.filter((_, i) => i !== index));
  const updateItem = (index: number, patch: Partial<OrderItem>) =>
    setOrderItems(orderItems.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] p-0 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-8 pb-32">
            <SheetHeader className="mb-8">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4 border border-indigo-100 shadow-sm">
                <Stethoscope className="h-6 w-6 text-indigo-600" />
              </div>
              <SheetTitle className="text-2xl font-bold tracking-tight">{t('new_order')}</SheetTitle>
              <SheetDescription className="text-slate-500 leading-relaxed">{t('new_order_desc')}</SheetDescription>
            </SheetHeader>

            <form id="order-form" onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('prescriber_id')}</Label>
                <Select
                  name="prescriberId"
                  items={doctors.map((doc) => ({ value: doc.id, label: `Dr. ${doc.fullName}` }))}
                >
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-slate-900 transition-all">
                    <SelectValue placeholder={t('prescriber_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>Dr. {doc.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest">{t('orders')}</Label>
                  <span className="text-[10px] text-slate-400 font-medium">{orderItems.length} item(s)</span>
                </div>

                <div className="space-y-4">
                  {orderItems.map((item, index) => {
                    const options = catalogForSource(item.source);
                    return (
                      <div key={index} className="p-5 bg-slate-50/50 rounded-2xl border border-slate-200 relative group transition-all hover:bg-slate-50">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">{t('order_category')}</Label>
                            <Select
                              value={item.source}
                              onValueChange={(value) =>
                                updateItem(index, { source: (value || "laboratory") as OrderSource, code: "" })
                              }
                              items={[
                                { value: "laboratory", label: t('order_category_laboratory') },
                                { value: "radiology", label: t('order_category_radiology') },
                                { value: "medical_act", label: t('order_category_medical_act') },
                              ]}
                            >
                              <SelectTrigger className="w-full h-10 rounded-lg border-slate-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="laboratory">{t('order_category_laboratory')}</SelectItem>
                                <SelectItem value="radiology">{t('order_category_radiology')}</SelectItem>
                                <SelectItem value="medical_act">{t('order_category_medical_act')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">{t('exam_label')}</Label>
                            <Select
                              value={item.code}
                              onValueChange={(value) => updateItem(index, { code: value || "" })}
                              items={options.map((option) => ({ value: option.code, label: formatOption(option) }))}
                            >
                              <SelectTrigger className="w-full h-10 rounded-lg border-slate-200">
                                <SelectValue placeholder={t('order_item_placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                {options.length === 0 ? (
                                  <div className="px-3 py-2 text-xs text-slate-400">{t('order_item_none_configured')}</div>
                                ) : (
                                  options.map((option) => (
                                    <SelectItem key={option.code} value={option.code}>
                                      {formatOption(option)}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">{t('urgency')}</Label>
                            <Select
                              value={item.urgency}
                              onValueChange={(value) => updateItem(index, { urgency: (value || "routine") as OrderItem["urgency"] })}
                              items={[
                                { value: "routine", label: t('urgency_routine') },
                                { value: "urgent", label: t('urgency_urgent') },
                                { value: "stat", label: t('urgency_stat') },
                              ]}
                            >
                              <SelectTrigger className="w-full h-10 rounded-lg border-slate-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="routine">{t('urgency_routine')}</SelectItem>
                                <SelectItem value="urgent">{t('urgency_urgent')}</SelectItem>
                                <SelectItem value="stat">{t('urgency_stat')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {index > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-red-100 text-red-600 hover:bg-red-200 shadow-sm transition-all"
                            onClick={() => removeItem(index)}
                            title={tc('delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-10 rounded-xl border-dashed border-slate-300 text-slate-500 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50 transition-all"
                  onClick={addItem}
                >
                  <Plus className="h-4 w-4 mr-2" /> {t('add_order_item')}
                </Button>
              </div>

              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('order_notes')}</Label>
                <textarea
                  id="notes"
                  name="notes"
                  className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 transition-all"
                  placeholder={t('order_notes_placeholder')}
                />
              </div>
            </form>
          </div>
        </ScrollArea>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
          <Button form="order-form" type="submit" size="lg" className="h-12 w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-sm font-bold shadow-lg shadow-slate-100 transition-all active:scale-95 text-white" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" /> : null}
            {t('save_order')}
          </Button>
          <Button variant="ghost" className="h-11 w-full rounded-xl text-slate-500 font-medium" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
