import { KpiCards } from "@/components/dashboard/KpiCards";
import { PatientQueue } from "@/components/dashboard/PatientQueue";
import { AuditActivity } from "@/components/dashboard/AuditActivity";
import { StockAlerts } from "@/components/dashboard/StockAlerts";
import { SubscriptionStatus } from "@/components/dashboard/SubscriptionStatus";
import { DashboardFooter } from "@/components/dashboard/DashboardFooter";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Left: KPIs */}
        <div className="col-span-12 lg:col-span-3 h-full min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <KpiCards />
          </div>
        </div>

        {/* Middle: Patient Queue Table */}
        <div className="col-span-12 lg:col-span-6 h-full min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <PatientQueue />
          </div>
        </div>

        {/* Right: Subscription Status, Audit Logs & Stock Alerts */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 h-full min-h-0 overflow-hidden">
          <div className="shrink-0 overflow-hidden">
            <SubscriptionStatus />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <AuditActivity />
            </div>
          </div>
          <div className="shrink-0 overflow-hidden">
            <StockAlerts />
          </div>
        </div>
      </div>

      <DashboardFooter />
    </div>
  );
}
