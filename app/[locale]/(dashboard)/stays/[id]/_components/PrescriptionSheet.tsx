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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pill, Plus, Trash2, Loader2 } from "lucide-react";
import { Doctor, InventoryItem } from "../types";

interface RxItem {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface PrescriptionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  inventory: InventoryItem[];
  rxItems: RxItem[];
  setRxItems: (items: RxItem[]) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function PrescriptionSheet({
  open,
  onOpenChange,
  doctors,
  inventory,
  rxItems,
  setRxItems,
  submitting,
  onSubmit,
}: PrescriptionSheetProps) {
  const t = useTranslations('admissions');
  const tc = useTranslations('common');

  const addItem = () => {
    setRxItems([...rxItems, { drug: "", dosage: "", frequency: "", duration: "" }]);
  };

  const removeItem = (index: number) => {
    setRxItems(rxItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof RxItem, value: string) => {
    const newItems = rxItems.map((item, i) => i === index ? { ...item, [field]: value } : item);
    setRxItems(newItems);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[540px] p-0 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-8 pb-32">
            <SheetHeader className="mb-8">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
                <Pill className="h-6 w-6 text-blue-600" />
              </div>
              <SheetTitle className="text-2xl font-bold tracking-tight">{t('new_prescription')}</SheetTitle>
              <SheetDescription className="text-slate-500 leading-relaxed">{t('new_prescription_desc')}</SheetDescription>
            </SheetHeader>
            
            <form id="rx-form" onSubmit={onSubmit} className="space-y-8">
              <div className="space-y-2.5">
                <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t('prescriber_id')}</Label>
                <Select name="prescriberId">
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
                  <Label className="text-xs font-bold uppercase text-slate-500 tracking-widest">{t('medications')}</Label>
                  <span className="text-[10px] text-slate-400 font-medium">{rxItems.length} item(s)</span>
                </div>
                <div className="space-y-4">
                  {rxItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-2 gap-3 p-5 bg-slate-50/50 rounded-2xl border border-slate-200 relative group transition-all hover:bg-slate-50">
                      <div className="col-span-2 space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">{t('drug_name')}</Label>
                        <Input 
                          list="inventory-suggestions"
                          placeholder={t('drug_placeholder')} 
                          value={item.drug} 
                          onChange={(e) => updateItem(index, 'drug', e.target.value)}
                          className="h-10 rounded-lg border-slate-200 focus:ring-blue-500 transition-all"
                          required={index === 0}
                        />
                      </div>
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
                      {index > 0 && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-red-100 text-red-600 hover:bg-red-200 shadow-sm transition-all"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <datalist id="inventory-suggestions">
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.name} />
                    ))}
                  </datalist>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-10 rounded-xl border-dashed border-slate-300 text-slate-500 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50 transition-all"
                  onClick={addItem}
                >
                  <Plus className="h-4 w-4 mr-2" /> {t('add_drug_item')}
                </Button>
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
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
          <Button form="rx-form" type="submit" size="lg" className="h-12 w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-sm font-bold shadow-lg shadow-slate-100 transition-all active:scale-95" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" /> : null}
            {t('save_prescription')}
          </Button>
          <Button variant="ghost" className="h-11 w-full rounded-xl text-slate-500 font-medium" onClick={() => onOpenChange(false)}>
            {tc('cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
