import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Details if needed */}
      <div className="grid grid-cols-12 gap-4 flex-1">
        {/* Left: KPIs */}
        <div className="col-span-3 flex flex-col gap-4">
          <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Active Consultations</div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-slate-900">42</span>
              <span className="text-xs text-green-600 font-medium mb-1">+12% vs yesterday</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">ER Wait Time</div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-slate-900">14<span className="text-sm text-slate-400">m</span></span>
              <span className="text-xs text-red-600 font-medium mb-1">Increasing</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Lab Processing</div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold text-slate-900">186</span>
              <span className="text-xs text-blue-600 font-medium mb-1">8 urgent pending</span>
            </div>
          </div>
          <div className="flex-1 bg-white p-4 rounded border border-slate-200 shadow-sm flex flex-col">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b pb-2">Module Health Monitor</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span>API Gateway</span>
                <span className="text-green-600">Healthy</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>Patient DB (RW)</span>
                <span className="text-green-600">99.9%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>Storage Service</span>
                <span className="text-yellow-600">Latency Peak</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>RBAC Engine</span>
                <span className="text-green-600">Healthy</span>
              </div>
            </div>
            <div className="mt-auto">
              <button className="w-full py-2 bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded uppercase tracking-wide">Open System Logs</button>
            </div>
          </div>
        </div>

        {/* Middle: Patient Queue Table */}
        <div className="col-span-6 flex flex-col bg-white rounded border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800">Current Consultation Queue <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-normal italic">Updated 1m ago</span></h2>
            <div className="flex gap-2">
              <button className="p-1.5 hover:bg-slate-100 rounded border border-slate-200 text-xs">Filter</button>
              <button className="p-1.5 bg-blue-600 text-white rounded text-xs px-3">+ Add Admission</button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Patient Name</th>
                  <th className="px-4 py-2">Priority</th>
                  <th className="px-4 py-2">Room</th>
                  <th className="px-4 py-2">Doctor</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                <tr className="hover:bg-blue-50/50">
                  <td className="px-4 py-3 font-mono">#8821</td>
                  <td className="px-4 py-3 font-medium">Marcus Valerius</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">Emergency</span></td>
                  <td className="px-4 py-3">ICU-04</td>
                  <td className="px-4 py-3">Dr. S. Chen</td>
                  <td className="px-4 py-3 text-slate-600">Initial Triage</td>
                </tr>
                <tr className="hover:bg-blue-50/50">
                  <td className="px-4 py-3 font-mono">#8822</td>
                  <td className="px-4 py-3 font-medium">Isabella Santiago</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">High</span></td>
                  <td className="px-4 py-3">201-B</td>
                  <td className="px-4 py-3">Dr. K. Patel</td>
                  <td className="px-4 py-3 text-slate-600">Pending Lab</td>
                </tr>
                <tr className="hover:bg-blue-50/50">
                  <td className="px-4 py-3 font-mono">#8824</td>
                  <td className="px-4 py-3 font-medium">Jean-Pierre Bernard</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Standard</span></td>
                  <td className="px-4 py-3">OPD-09</td>
                  <td className="px-4 py-3">Dr. A. Thorne</td>
                  <td className="px-4 py-3 text-slate-600">Consulting</td>
                </tr>
                <tr className="hover:bg-blue-50/50">
                  <td className="px-4 py-3 font-mono">#8825</td>
                  <td className="px-4 py-3 font-medium">Elena Rodriguez</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Standard</span></td>
                  <td className="px-4 py-3">OPD-12</td>
                  <td className="px-4 py-3">Dr. S. Chen</td>
                  <td className="px-4 py-3 text-slate-600">Awaiting Exam</td>
                </tr>
                <tr className="hover:bg-blue-50/50">
                  <td className="px-4 py-3 font-mono">#8827</td>
                  <td className="px-4 py-3 font-medium">Samuel Osei</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">Follow-up</span></td>
                  <td className="px-4 py-3">OPD-01</td>
                  <td className="px-4 py-3">Dr. K. Patel</td>
                  <td className="px-4 py-3 text-slate-600">Discharging</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 mt-auto">
            <span>Showing 5 of 42 patients in active queue</span>
            <div className="flex gap-4">
              <a href="#" className="text-blue-600 font-semibold cursor-pointer">View All Queue</a>
              <a href="#" className="text-blue-600 font-semibold cursor-pointer">Print List</a>
            </div>
          </div>
        </div>

        {/* Right: Audit Logs & Stock Alerts */}
        <div className="col-span-3 flex flex-col gap-4">
          <div className="bg-white rounded border border-slate-200 shadow-sm flex flex-col flex-1">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Audit Activity</h2>
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="border-l-2 border-blue-500 pl-3 relative">
                <div className="text-[11px] font-bold">Patient Record Accessed</div>
                <div className="text-[10px] text-slate-500">User ID: #772 (Nurse G. Lee)</div>
                <div className="text-[9px] text-slate-400 mt-1">2 mins ago</div>
              </div>
              <div className="border-l-2 border-slate-300 pl-3 relative opacity-70">
                <div className="text-[11px] font-bold">Module Updated: Labs</div>
                <div className="text-[10px] text-slate-500">Schema migration v2.4.1</div>
                <div className="text-[9px] text-slate-400 mt-1">14 mins ago</div>
              </div>
              <div className="border-l-2 border-red-500 pl-3 relative">
                <div className="text-[11px] font-bold">Billing Rejection</div>
                <div className="text-[10px] text-slate-500">Invoice #PX-2938 (Ins. Error)</div>
                <div className="text-[9px] text-slate-400 mt-1">1 hr ago</div>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 text-white rounded border border-slate-700 shadow-lg p-4">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Inventory Alerts</div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="text-[11px]">
                  <div className="font-medium">IV Fluids 0.9%</div>
                  <div className="text-slate-500 text-[10px]">Critically Low</div>
                </div>
                <div className="text-red-400 text-xs font-bold">12 units</div>
              </div>
              <div className="flex justify-between items-center">
                <div className="text-[11px]">
                  <div className="font-medium">Adrenaline 1mg</div>
                  <div className="text-slate-500 text-[10px]">Below Threshold</div>
                </div>
                <div className="text-yellow-400 text-xs font-bold">45 units</div>
              </div>
              <button className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded uppercase tracking-widest transition-colors cursor-pointer">Create Purchase Order</button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer / Status Bar included here so it sticks to bottom of page seamlessly */}
      <footer className="h-6 bg-slate-800 text-slate-400 text-[10px] flex items-center justify-between px-4 shrink-0 rounded">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span>Production Cluster Primary (US-EAST-1)</span>
          </div>
          <span>|</span>
          <span>Latency: 24ms</span>
        </div>
        <div className="flex items-center gap-4 uppercase font-bold">
          <span>v4.12.0-stable</span>
          <span className="text-slate-500">Support ID: HMS-7722-X</span>
        </div>
      </footer>
    </div>
  );
}
