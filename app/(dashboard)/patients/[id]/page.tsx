"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, FileText, Pill, Activity, MapPin, Phone, User, Calendar, ShieldAlert, Image as ImageIcon, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";

// Extended stub data simulating a fetched patient
const patientData = {
  id: "PAT-001", 
  ipp: "100000123", 
  nss: "1 80 05 75 123 045 67",
  firstName: "John",
  lastName: "Doe",
  gender: "Male", 
  dob: "1980-05-15 (45 y.o.)", 
  status: "Active",
  bloodGroup: "O+",
  address: "123 Main St, Springfield, IL",
  phone: "+1 (555) 123-4567",
  email: "john.doe@example.com",
  emergencyContact: { name: "Jane Doe", relation: "Wife", phone: "+1 (555) 987-6543" },
  allergies: ["Penicillin", "Peanuts"],
  chronic: ["Type 2 Diabetes", "Hypertension"],
  admissions: [
    { stayId: "ADM-2025-001", date: "Oct 12, 2025 10:30 AM", type: "Emergency", status: "In Progress", department: "ICU", bed: "ICU-04", doctor: "Dr. S. Chen" },
    { stayId: "ADM-2024-088", date: "Jan 03, 2024 09:15 AM", type: "Scheduled", status: "Discharged", department: "Surgery", bed: "--", doctor: "Dr. A. Thorne" },
  ],
  records: [
    { id: "REC-892", date: "Oct 12, 2025 11:20 AM", type: "Observation", author: "Dr. S. Chen", title: "Initial ER Assessment" },
    { id: "REC-850", date: "Oct 12, 2025 10:45 AM", type: "Nursing Note", author: "Nurse G. Lee", title: "Vitals on Admission" },
    { id: "REC-512", date: "Jan 05, 2024 02:00 PM", type: "Discharge Letter", author: "Dr. A. Thorne", title: "Post-op Discharge Summary" },
  ],
  prescriptions: [
    { id: "RX-001", date: "Oct 13, 2025", status: "Validated", desc: "Metformin 500mg - 2x daily", prescriber: "Dr. S. Chen", dispensedDate: undefined },
    { id: "RX-000", date: "Jan 04, 2024", status: "Dispensed", desc: "Amoxicillin 250mg - 3x daily", prescriber: "Dr. A. Thorne", dispensedDate: "Jan 04, 2024" },
  ]
};

export default function PatientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  // In a real app we'd fetch the patient using `id`
  const patient = patientData;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/patients" className="p-1.5 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 text-slate-500 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900">{patient.firstName} {patient.lastName}</h1>
              <span className={cn(
                  "px-2 py-0.5 text-[10px] rounded uppercase font-semibold",
                  patient.status === 'Active' ? "bg-green-100 text-green-700" :
                  "bg-slate-100 text-slate-600"
              )}>
                {patient.status}
              </span>
              {patient.allergies.length > 0 && (
                 <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] rounded uppercase font-semibold flex items-center gap-1">
                   <ShieldAlert className="h-3 w-3" /> Allergies
                 </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
              <span className="font-mono">IPP: {patient.ipp}</span>
              <span>&bull;</span>
              <span>NSS: <span className="font-mono">{patient.nss}</span></span>
              <span>&bull;</span>
              <span>{patient.dob}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="sm" className="text-xs h-8 text-slate-600">
             <Edit className="mr-2 h-3 w-3" />
             Edit Profile
           </Button>
           <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs">
             New Admission
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
        {/* Left Column: Quick Profile */}
        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto">
          <div className="bg-white rounded border border-slate-200 shadow-sm p-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Demographics</div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><User className="h-3 w-3" /> Gender & Blood</div>
                <div className="text-xs font-semibold text-slate-900">{patient.gender}, {patient.bloodGroup}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</div>
                <div className="text-xs font-semibold text-slate-900">{patient.address}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><Phone className="h-3 w-3" /> Contact</div>
                <div className="text-xs font-semibold text-slate-900">{patient.phone}</div>
                <div className="text-xs text-slate-600">{patient.email}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded border border-slate-200 shadow-sm p-4">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Emergency Contact</div>
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-900">{patient.emergencyContact.name} ({patient.emergencyContact.relation})</div>
                <div className="text-xs text-blue-600 mt-0.5">{patient.emergencyContact.phone}</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded border border-slate-800 shadow-sm p-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Clinical Alerts</div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-slate-500 mb-1">ALLERGIES</div>
                <div className="flex flex-wrap gap-1">
                  {patient.allergies.map(a => (
                    <span key={a} className="px-2 py-0.5 bg-red-900/50 text-red-400 border border-red-800 rounded text-[10px] font-semibold">{a}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-1">CHRONIC CONDITIONS</div>
                <div className="flex flex-wrap gap-1">
                  {patient.chronic.map(c => (
                    <span key={c} className="px-2 py-0.5 bg-blue-900/50 text-blue-400 border border-blue-800 rounded text-[10px] font-semibold">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-tab content */}
        <div className="col-span-9 flex flex-col bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
          <Tabs defaultValue="admissions" className="w-full flex-1 flex flex-col">
            <div className="px-2 pt-2 border-b border-slate-200 bg-slate-50 shrink-0">
              <TabsList className="h-9 bg-transparent p-0 flex justify-start gap-4">
                <TabsTrigger 
                  value="admissions" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Calendar className="h-3.5 w-3.5 mr-2" /> Admissions & Stays
                </TabsTrigger>
                <TabsTrigger 
                  value="records" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <FileText className="h-3.5 w-3.5 mr-2" /> Medical Records
                </TabsTrigger>
                <TabsTrigger 
                  value="prescriptions" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Pill className="h-3.5 w-3.5 mr-2" /> Prescriptions
                </TabsTrigger>
                <TabsTrigger 
                  value="labs" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <Activity className="h-3.5 w-3.5 mr-2" /> Laboratory
                </TabsTrigger>
                <TabsTrigger 
                  value="imaging" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <ImageIcon className="h-3.5 w-3.5 mr-2" /> Imaging
                </TabsTrigger>
                <TabsTrigger 
                  value="billing" 
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200 data-[state=active]:border-b-transparent rounded-t-md rounded-b-none h-full text-xs"
                >
                  <CreditCard className="h-3.5 w-3.5 mr-2" /> Billing
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-auto bg-white p-0">
              <TabsContent value="admissions" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">Stay ID</th>
                      <th className="px-4 py-2">Admission Date</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Dept / Bed</th>
                      <th className="px-4 py-2">Doctor</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {patient.admissions.map(adm => (
                      <tr key={adm.stayId} className="hover:bg-slate-50 cursor-pointer">
                        <td className="px-4 py-3 font-mono text-slate-600">{adm.stayId}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{adm.date}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold", 
                            adm.type === 'Emergency' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700")}>
                            {adm.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">{adm.department} <span className="text-slate-500 block text-[10px]">{adm.bed}</span></td>
                        <td className="px-4 py-3">{adm.doctor}</td>
                        <td className="px-4 py-3">
                           <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold", 
                            adm.status === 'In Progress' ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700")}>
                            {adm.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="records" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Title</th>
                      <th className="px-4 py-2">Author</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {patient.records.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">{rec.date}</td>
                        <td className="px-4 py-3 font-medium">{rec.type}</td>
                        <td className="px-4 py-3 text-slate-900">{rec.title}</td>
                        <td className="px-4 py-3 text-slate-600">{rec.author}</td>
                        <td className="px-4 py-3 text-right">
                          <button className="text-blue-600 hover:underline">Read</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="prescriptions" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">Date Prescribed</th>
                      <th className="px-4 py-2">Medication (Dosage & Route)</th>
                      <th className="px-4 py-2">Prescriber</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Dispense History</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {patient.prescriptions.map(rx => (
                      <tr key={rx.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">
                          <div>{rx.date}</div>
                          <div className="font-mono text-[10px] text-slate-400 mt-0.5">{rx.id}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-900 font-medium">{rx.desc}</td>
                        <td className="px-4 py-3 text-slate-600">{rx.prescriber || "Dr. S. Chen"}</td>
                        <td className="px-4 py-3">
                           <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-semibold", 
                            rx.status === 'Validated' ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")}>
                            {rx.status}
                           </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                           {rx.status === "Dispensed" ? (
                             <div className="text-[10px] text-slate-500">
                               <span className="text-green-600 font-semibold mb-0.5 block">Dispensed on {rx.dispensedDate || rx.date}</span>
                               <span className="underline cursor-pointer hover:text-slate-800">View Log</span>
                             </div>
                           ) : (
                             <span className="text-slate-400 text-[10px] italic">Awaiting Dispense</span>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="labs" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">Test ID</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Panel / Assay</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-600">LAB-992</td>
                      <td className="px-4 py-3 text-slate-600">Oct 12, 2025</td>
                      <td className="px-4 py-3 text-slate-900">Comprehensive Metabolic Panel</td>
                      <td className="px-4 py-3"><span className="text-green-700 bg-green-100 px-2 py-0.5 rounded text-[10px] uppercase font-semibold">Final</span></td>
                      <td className="px-4 py-3 text-right"><button className="text-blue-600 hover:underline">View PDF</button></td>
                    </tr>
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="imaging" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">Scan ID</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Modality</th>
                      <th className="px-4 py-2">Region</th>
                      <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-600">IMG-404</td>
                      <td className="px-4 py-3 text-slate-600">Jan 03, 2024</td>
                      <td className="px-4 py-3 font-semibold">MRI</td>
                      <td className="px-4 py-3 text-slate-900">Abdomen / Pelvis</td>
                      <td className="px-4 py-3 text-right"><button className="text-blue-600 hover:underline">Open Viewer</button></td>
                    </tr>
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="billing" className="m-0 border-none outline-none">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="px-4 py-2">Invoice #</th>
                      <th className="px-4 py-2">Date generated</th>
                      <th className="px-4 py-2">Amount</th>
                      <th className="px-4 py-2">Coverage</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-600">INV-2024-088</td>
                      <td className="px-4 py-3 text-slate-600">Jan 06, 2024</td>
                      <td className="px-4 py-3 font-medium">$4,250.00</td>
                      <td className="px-4 py-3 text-slate-600">BlueCross PPO</td>
                      <td className="px-4 py-3"><span className="text-green-700 bg-green-100 px-2 py-0.5 rounded text-[10px] uppercase font-semibold">Paid</span></td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-600">INV-2025-001</td>
                      <td className="px-4 py-3 text-slate-600">Oct 12, 2025</td>
                      <td className="px-4 py-3 font-medium">$850.00</td>
                      <td className="px-4 py-3 text-slate-600">BlueCross PPO</td>
                      <td className="px-4 py-3"><span className="text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded text-[10px] uppercase font-semibold">Pending Claim</span></td>
                    </tr>
                  </tbody>
                </table>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
