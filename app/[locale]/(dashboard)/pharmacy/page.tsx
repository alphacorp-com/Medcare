"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, Pill, AlertTriangle, Filter, Check, X, Printer, 
  PillBottle, FileWarning, PackageSearch, BatteryWarning,
  Plus, Download
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { useTranslations } from "next-intl";

// Stub data
const prescriptions = [
  { id: "RX-001", patientName: "John Doe", prescriber: "Dr. Kelly", date: new Date(), status: "Validated", items: 2, ipp: "100000123" },
  { id: "RX-002", patientName: "Charlie Davis", prescriber: "Dr. Smith", date: new Date(), status: "Pending Queue", items: 5, alert: true, ipp: "100000127" },
  { id: "RX-003", patientName: "Alice Johnson", prescriber: "Dr. Kelly", date: new Date(Date.now() - 3600000), status: "Dispensed", items: 1, ipp: "100000125" },
  { id: "RX-004", patientName: "Bob Brown", prescriber: "Dr. Davis", date: new Date(Date.now() - 7200000), status: "Pending Queue", items: 3, alert: false, ipp: "100000126" }
];

const inventory = [
  { id: "MED-001", name: "Amoxicillin 500mg Capsule", manufacturer: "PharmaCorp", category: "Antibiotic", stock: 1250, threshold: 500, unit: "capsules", status: "In Stock" },
  { id: "MED-002", name: "Ibuprofen 400mg Tablet", manufacturer: "MediLife", category: "NSAID", stock: 4200, threshold: 1000, unit: "tablets", status: "In Stock" },
  { id: "MED-003", name: "Metformin 500mg Tablet", manufacturer: "GlucoCare", category: "Antidiabetic", stock: 240, threshold: 500, unit: "tablets", status: "Low Stock" },
  { id: "MED-004", name: "Salbutamol 100mcg Inhaler", manufacturer: "BreatheEasy", category: "Bronchodilator", stock: 15, threshold: 50, unit: "inhalers", status: "Low Stock" },
  { id: "MED-005", name: "Omeprazole 20mg Capsule", manufacturer: "GastroHealth", category: "PPI", stock: 0, threshold: 200, unit: "capsules", status: "Out of Stock" }
];

export default function PharmacyPage() {
  const hasModule = useAppStore((state) => state.hasModule);
  const t = useTranslations('pharmacy');
  const tc = useTranslations('common');
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [invSearch, setInvSearch] = useState("");
  const [selectedRx, setSelectedRx] = useState<any>(null);

  if (!hasModule('MODULE_PHARMACY')) {
    return (
      <div className="flex h-full items-center justify-center">
         <div className="text-center p-8 bg-white border border-slate-200 rounded-lg max-w-md shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{tc('restricted_access')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('module_desc')}</p>
            <p className="mt-4 text-xs font-medium text-blue-600 bg-blue-50 p-3 rounded border border-blue-100">
               {tc('contact_admin')}
            </p>
         </div>
      </div>
    );
  }

  const filteredPrescriptions = prescriptions.filter(rx => {
    if (filter !== "All" && rx.status !== filter) return false;
    if (search && !rx.patientName.toLowerCase().includes(search.toLowerCase()) && !rx.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredInventory = inventory.filter(item => {
    if (invSearch && !item.name.toLowerCase().includes(invSearch.toLowerCase()) && !item.id.toLowerCase().includes(invSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('description')}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="h-8 text-xs">{tc('print')}</Button>
           <Button variant="outline" size="sm" className="h-8 text-xs">{tc('export')}</Button>
           <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs">
             <Plus className="mr-2 h-3 w-3" />
             {t('add_medication')}
           </Button>
        </div>
      </div>

      <Tabs defaultValue="queue" className="flex-1 flex flex-col gap-4 overflow-hidden">
        <TabsList className="bg-transparent p-0 flex justify-start gap-6 border-b border-slate-200 rounded-none h-10 w-full shrink-0 px-2">
          <TabsTrigger 
            value="queue" 
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none data-[state=active]:text-blue-700 h-full text-sm font-semibold tracking-wide"
          >
            <PillBottle className="h-4 w-4 mr-2" /> {t('queue_tab')}
          </TabsTrigger>
          <TabsTrigger 
            value="inventory" 
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none data-[state=active]:text-blue-700 h-full text-sm font-semibold tracking-wide"
          >
            <PackageSearch className="h-4 w-4 mr-2" /> {t('inventory_tab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="m-0 border-none outline-none flex-1 flex flex-col overflow-hidden gap-4">
          <div className="grid gap-4 md:grid-cols-3 shrink-0">
            <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("Pending Queue")}>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('to_validate')}</div>
                <div className="text-3xl font-bold text-slate-900">{prescriptions.filter(r => r.status === 'Pending Queue').length}</div>
              </div>
            </div>
            <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex items-end justify-between hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setFilter("Validated")}>
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('to_dispense')}</div>
                <div className="text-3xl font-bold text-slate-900">{prescriptions.filter(r => r.status === 'Validated').length}</div>
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded border border-red-200 shadow-sm flex items-end justify-between">
              <div>
                 <div className="text-xs font-semibold text-red-800 uppercase tracking-wider mb-1">{t('interaction_alerts')}</div>
                 <div className="text-3xl font-bold text-red-700">{prescriptions.filter(r => r.alert).length}</div>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-200" />
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
               <div className="relative w-96 flex-1">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    type="search"
                    placeholder={t('search_rx')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 max-w-sm"
                  />
                </div>
                <div className="flex bg-slate-200/50 p-1 rounded-md ml-4">
                  <button onClick={() => setFilter("All")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "All" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{tc('all')}</button>
                  <button onClick={() => setFilter("Pending Queue")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "Pending Queue" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('to_validate')}</button>
                  <button onClick={() => setFilter("Validated")} className={cn("px-3 py-1 rounded text-[10px] uppercase font-bold", filter === "Validated" ? "bg-white shadow-sm text-slate-700" : "text-slate-500 hover:text-slate-700")}>{t('to_dispense')}</button>
                </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                    <th className="px-4 py-2">{t('rx_id')}</th>
                    <th className="px-4 py-2">{t('patient')}</th>
                    <th className="px-4 py-2">{t('prescriber')}</th>
                    <th className="px-4 py-2">{t('items')}</th>
                    <th className="px-4 py-2">{t('prescribed_at')}</th>
                    <th className="px-4 py-2">{tc('status')}</th>
                    <th className="px-4 py-2 text-right">{tc('actions')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  {filteredPrescriptions.map((rx) => (
                    <tr key={rx.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => setSelectedRx(rx)}>
                      <td className="px-4 py-2 font-mono text-slate-600">{rx.id}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {rx.patientName}
                          <span className="text-[10px] font-mono text-slate-400">({rx.ipp})</span>
                          {rx.alert && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{rx.prescriber}</td>
                      <td className="px-4 py-2">{rx.items} {t('medications')}</td>
                      <td className="px-4 py-2 text-slate-500">{format(rx.date, "MMM dd, yyyy HH:mm")}</td>
                      <td className="px-4 py-2">
                        <span className={cn(
                           "px-2 py-0.5 rounded text-[10px] uppercase font-semibold",
                           rx.status === 'Pending Queue' ? "bg-yellow-100 text-yellow-700" :
                           rx.status === 'Validated' ? "bg-blue-100 text-blue-700" :
                           "bg-green-100 text-green-700"
                        )}>
                          {rx.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button 
                           className={cn(
                              "font-semibold px-3 py-1 rounded",
                              rx.status === 'Pending Queue' ? "bg-blue-600 text-white hover:bg-blue-700" :
                              rx.status === 'Validated' ? "bg-green-600 text-white hover:bg-green-700" :
                              "text-blue-600 hover:bg-blue-50"
                           )}
                           onClick={(e) => { e.stopPropagation(); setSelectedRx(rx); }}
                        >
                          {rx.status === 'Pending Queue' ? t('validate') : rx.status === 'Validated' ? t('dispense') : tc('view')}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPrescriptions.length === 0 && (
                    <tr>
                       <td colSpan={7} className="text-center py-8 text-slate-500 text-xs">{tc('no_data')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="m-0 border-none outline-none flex-1 flex flex-col overflow-hidden gap-4">
          <div className="grid gap-4 md:grid-cols-4 shrink-0">
            <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
               <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('total_skus')}</div>
               <div className="text-3xl font-bold text-slate-900">{inventory.length}</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded border border-yellow-200 shadow-sm flex items-end justify-between">
              <div>
                 <div className="text-xs font-semibold text-yellow-800 uppercase tracking-wider mb-1">{t('low_stock_alerts')}</div>
                 <div className="text-3xl font-bold text-yellow-700">{inventory.filter(i => i.stock < i.threshold).length}</div>
              </div>
              <BatteryWarning className="h-8 w-8 text-yellow-300" />
            </div>
            <div className="bg-red-50 p-4 rounded border border-red-200 shadow-sm flex items-end justify-between">
              <div>
                 <div className="text-xs font-semibold text-red-800 uppercase tracking-wider mb-1">{t('out_of_stock')}</div>
                 <div className="text-3xl font-bold text-red-700">{inventory.filter(i => i.stock === 0).length}</div>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-300" />
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
               <div className="relative w-96 flex-1">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    type="search"
                    placeholder={t('search_inventory')}
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400 max-w-sm"
                  />
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="outline" size="sm" className="h-8 text-xs text-slate-700">
                    <Filter className="mr-2 h-3 w-3" /> {t('advanced_filters')}
                  </Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs text-white">
                    <Plus className="mr-2 h-3 w-3" /> {t('add_medication')}
                  </Button>
                </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0 z-10">
                    <th className="px-4 py-2">{tc('ipp')}</th>
                    <th className="px-4 py-2">{tc('name')}</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Current Stock</th>
                    <th className="px-4 py-2">{t('threshold')}</th>
                    <th className="px-4 py-2">{tc('status')}</th>
                    <th className="px-4 py-2 text-right">{tc('actions')}</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100">
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-600">{item.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[10px] text-slate-500">{item.manufacturer}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.category}</td>
                      <td className="px-4 py-3 font-mono font-medium">
                        {item.stock} <span className="text-slate-400 text-[10px] ml-1">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {item.threshold}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                           "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                           item.stock > item.threshold ? "bg-green-100 text-green-700" :
                           item.stock > 0 ? "bg-yellow-100 text-yellow-700" :
                           "bg-red-100 text-red-700"
                        )}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button className="text-blue-600 hover:underline font-medium">{t('restock')}</button>
                        <button className="text-slate-500 hover:text-slate-800 hover:underline font-medium">{tc('edit')}</button>
                      </td>
                    </tr>
                  ))}
                  {filteredInventory.length === 0 && (
                    <tr>
                       <td colSpan={7} className="text-center py-8 text-slate-500 text-xs">{tc('no_data')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={!!selectedRx} onOpenChange={(open) => !open && setSelectedRx(null)}>
        {selectedRx && (
           <SheetContent className="sm:max-w-xl w-full right-0 p-0 flex flex-col bg-slate-50 border-l border-slate-200">
             <SheetHeader className="p-4 border-b border-slate-200 bg-white shrink-0">
               <div className="flex items-start justify-between">
                 <div>
                   <SheetTitle className="text-lg flex items-center gap-2">
                     {t('rx_id')} {selectedRx.id}
                     <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                          selectedRx.status === 'Pending Queue' ? "bg-yellow-100 text-yellow-700" :
                          selectedRx.status === 'Validated' ? "bg-blue-100 text-blue-700" :
                          "bg-green-100 text-green-700"
                       )}>
                        {selectedRx.status}
                      </span>
                   </SheetTitle>
                   <SheetDescription className="text-xs mt-1">
                      {selectedRx.prescriber} - {format(selectedRx.date, "PPP 'at' p")}
                   </SheetDescription>
                 </div>
                 {selectedRx.alert && (
                   <div className="bg-red-50 text-red-700 px-3 py-1.5 rounded border border-red-200 flex items-center gap-2 text-xs font-bold shrink-0">
                     <AlertTriangle className="h-4 w-4" /> Priority Alert
                   </div>
                 )}
               </div>
             </SheetHeader>
             
             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                       {selectedRx.patientName.charAt(0)}
                     </div>
                     <div>
                       <div className="text-sm font-bold text-slate-900">{selectedRx.patientName}</div>
                       <div className="text-[10px] font-mono text-slate-500">{tc('ipp')}: {selectedRx.ipp}</div>
                     </div>
                   </div>
                   <Button variant="outline" size="sm" className="text-xs h-7">{tc('view')}</Button>
                </div>

                {selectedRx.alert && (
                   <div className="bg-red-50 p-3 rounded border border-red-200 shadow-sm flex flex-col gap-2">
                     <div className="flex items-center gap-2 text-xs font-bold text-red-800 uppercase tracking-widest">
                        <FileWarning className="w-3.5 h-3.5" /> High Risk Interaction
                     </div>
                   </div>
                )}
                
                <div>
                   <h4 className="text-[10px] font-bold text-slate-900 uppercase border-b border-slate-200 pb-1 mb-2 tracking-widest">Order Details</h4>
                   <div className="space-y-2">
                      {Array.from({ length: selectedRx.items }).map((_, i) => (
                         <div key={i} className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start">
                               <div>
                                  <div className="text-xs font-bold text-slate-900">Amoxicillin 500mg Capsule</div>
                               </div>
                               <div className="text-right">
                                  <div className="text-[10px] font-bold text-slate-500 uppercase">Qty</div>
                                  <div className="text-sm font-mono font-semibold">21</div>
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
             
             <SheetFooter className="p-4 border-t border-slate-200 bg-slate-100 shrink-0 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] justify-between items-center sm:justify-between flex-row">
                  <Button variant="ghost" size="sm" className="text-xs text-slate-600 hover:text-slate-900">
                     <Printer className="mr-2 h-4 w-4" /> {tc('print')}
                  </Button>
                  
                  <div className="flex gap-2">
                     {selectedRx.status === 'Pending Queue' && (
                        <>
                          <Button variant="outline" className="text-xs h-8 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
                            <X className="mr-2 h-3.5 w-3.5" /> {tc('cancel')}
                          </Button>
                          <Button className="text-xs h-8 bg-blue-600 hover:bg-blue-700" onClick={() => { setSelectedRx({...selectedRx, status: 'Validated'}); }}>
                            <Check className="mr-2 h-3.5 w-3.5" /> {t('validate')}
                          </Button>
                        </>
                     )}
                     {selectedRx.status === 'Validated' && (
                        <Button className="text-xs h-8 bg-green-600 hover:bg-green-700 text-white" onClick={() => { setSelectedRx({...selectedRx, status: 'Dispensed'}); }}>
                          <PillBottle className="mr-2 h-3.5 w-3.5" /> {t('dispense')}
                        </Button>
                     )}
                     {selectedRx.status === 'Dispensed' && (
                        <span className="text-xs font-bold uppercase tracking-wider text-green-700 flex items-center px-4 py-1.5 bg-green-100 rounded">
                           <Check className="mr-2 h-4 w-4" /> {t('fulfilled')}
                        </span>
                     )}
                  </div>
             </SheetFooter>
           </SheetContent>
        )}
      </Sheet>
    </div>
  );
}
