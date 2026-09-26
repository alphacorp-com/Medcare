import { KpiCards } from "@/components/dashboard/KpiCards";
import { PatientQueue } from "@/components/dashboard/PatientQueue";
import { AuditActivity } from "@/components/dashboard/AuditActivity";
import { StockAlerts } from "@/components/dashboard/StockAlerts";
import { SubscriptionStatus } from "@/components/dashboard/SubscriptionStatus";
import { DashboardFooter } from "@/components/dashboard/DashboardFooter";

// Large screens: three fixed-height columns that scroll independently. Below lg the
// columns stack and the page scrolls as a whole, so every height/overflow constraint
// is lg-only.
export default function DashboardPage() {
  return (
    <div className="flex flex-col lg:h-full lg:overflow-hidden">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:flex-1 lg:min-h-0">
        {/* Left: KPIs */}
        <div className="lg:col-span-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
          <div className="lg:h-full lg:overflow-y-auto">
            <KpiCards />
          </div>
        </div>

        {/* Middle: Patient Queue Table */}
        <div className="lg:col-span-6 lg:h-full lg:min-h-0 lg:overflow-hidden">
          <div className="lg:h-full lg:overflow-y-auto">
            <PatientQueue />
          </div>
        </div>

        {/* Right: Subscription Status, Audit Logs & Stock Alerts */}
        <div className="lg:col-span-3 flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-hidden">
          <div className="shrink-0 overflow-hidden">
            <SubscriptionStatus />
          </div>
          <div className="lg:flex-1 lg:min-h-0 lg:overflow-hidden">
            <div className="lg:h-full lg:overflow-y-auto">
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
