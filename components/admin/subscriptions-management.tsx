"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Edit, Plus } from "lucide-react";

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface PlanOption {
  id: string;
  name: string;
  billingCycle: "monthly" | "annual" | "perpetual";
  basePrice: string;
  currency: string;
}

interface LicenseRow {
  id: string;
  keyPreview: string;
  status: string;
  period: string;
  createdAt: string;
  redeemedAt: string | null;
  validUntil: string | null;
  tenant: { name: string };
  plan: { name: string };
}

interface SubscriptionRow {
  id: string;
  tenantId: string;
  planId: string;
  status: "trial" | "active" | "past_due" | "cancelled";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelReason: string | null;
  tenant: { id: string; name: string; slug: string; status: string };
  plan: { id: string; name: string; billingCycle: string };
}

export function SubscriptionsManagement() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingSubscription, setSavingSubscription] = useState(false);
  const [subscriptionSheetOpen, setSubscriptionSheetOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionRow | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState({
    tenantId: "",
    planId: "",
    status: "active",
    currentPeriodStart: "",
    currentPeriodEnd: "",
    cancelReason: "",
  });

  const fetchLicensingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/licenses", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to fetch licensing data.");
      }

      setTenants(payload.tenants || []);
      setPlans(payload.plans || []);
      setLicenses(payload.licenses || []);

      const subsResponse = await fetch("/api/admin/subscriptions", { cache: "no-store" });
      const subsPayload = await subsResponse.json();
      if (!subsResponse.ok) throw new Error(subsPayload?.error || "Failed to fetch subscriptions");
      setSubscriptions(subsPayload.subscriptions || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch licensing data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLicensingData();
  }, []);

  const handleGenerate = async () => {
    if (!selectedTenant || !selectedPlan || !period) {
      setError("Please select a tenant, plan and period.");
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedKey(null);
    try {
      const response = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: selectedTenant,
          planId: selectedPlan,
          period,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to generate license key.");
      }

      setGeneratedKey(payload.key);
      await fetchLicensingData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate license key.";
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const openCreateSubscriptionSheet = () => {
    setEditingSubscription(null);
    setSubscriptionForm({
      tenantId: tenants[0]?.id || "",
      planId: plans[0]?.id || "",
      status: "active",
      currentPeriodStart: new Date().toISOString().slice(0, 10),
      currentPeriodEnd: new Date().toISOString().slice(0, 10),
      cancelReason: "",
    });
    setSubscriptionSheetOpen(true);
  };

  const openEditSubscriptionSheet = (subscription: SubscriptionRow) => {
    setEditingSubscription(subscription);
    setSubscriptionForm({
      tenantId: subscription.tenantId,
      planId: subscription.planId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart.slice(0, 10),
      currentPeriodEnd: subscription.currentPeriodEnd.slice(0, 10),
      cancelReason: subscription.cancelReason || "",
    });
    setSubscriptionSheetOpen(true);
  };

  const handleSaveSubscription = async () => {
    if (!subscriptionForm.tenantId || !subscriptionForm.planId || !subscriptionForm.currentPeriodStart || !subscriptionForm.currentPeriodEnd) {
      setError("Please fill all required subscription fields.");
      return;
    }

    setSavingSubscription(true);
    setError(null);
    try {
      const endpoint = editingSubscription
        ? `/api/admin/subscriptions/${editingSubscription.id}`
        : "/api/admin/subscriptions";
      const method = editingSubscription ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscriptionForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to save subscription");
      setSubscriptionSheetOpen(false);
      await fetchLicensingData();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save subscription";
      setError(message);
    } finally {
      setSavingSubscription(false);
    }
  };

  const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "redeemed") return "default";
    if (status === "generated") return "secondary";
    if (status === "revoked") return "destructive";
    return "outline";
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading subscriptions and licenses...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Subscriptions Management</h2>
        <p className="text-gray-600">Generate tenant license keys and monitor activation lifecycle</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tenant Subscriptions</CardTitle>
              <CardDescription>Create and update tenant subscriptions</CardDescription>
            </div>
            <Button onClick={openCreateSubscriptionSheet}>
              <Plus className="h-4 w-4 mr-2" />
              New Subscription
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Period Start</TableHead>
                <TableHead>Period End</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell>{subscription.tenant.name}</TableCell>
                  <TableCell>{subscription.plan.name}</TableCell>
                  <TableCell>
                    <Badge variant={subscription.status === "active" ? "default" : subscription.status === "cancelled" ? "destructive" : "secondary"}>
                      {subscription.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(subscription.currentPeriodStart).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEditSubscriptionSheet(subscription)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generate License Key</CardTitle>
          <CardDescription>
            Create a key for a tenant and period (monthly or yearly). The tenant becomes active after redeeming the key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Tenant</p>
              <Select value={selectedTenant} onValueChange={(value) => setSelectedTenant(value || "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Plan</p>
              <Select value={selectedPlan} onValueChange={(value) => setSelectedPlan(value || "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.billingCycle})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Period</p>
              <Select value={period} onValueChange={(value) => setPeriod(value as "monthly" | "annual")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {generatedKey ? (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm text-emerald-700">Generated key</p>
              <p className="font-mono text-lg font-semibold tracking-wide text-emerald-900">{generatedKey}</p>
            </div>
          ) : null}

          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating..." : "Generate License Key"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent License Keys</CardTitle>
          <CardDescription>Latest generated and redeemed tenant license keys</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Key Preview</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Valid Until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licenses.map((license) => (
                <TableRow key={license.id}>
                  <TableCell>{license.tenant.name}</TableCell>
                  <TableCell>{license.plan.name}</TableCell>
                  <TableCell className="font-mono">{license.keyPreview}</TableCell>
                  <TableCell>{license.period === "annual" ? "Yearly" : "Monthly"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(license.status)}>{license.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(license.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {license.validUntil ? new Date(license.validUntil).toLocaleDateString() : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {licenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                    No license keys generated yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={subscriptionSheetOpen} onOpenChange={setSubscriptionSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingSubscription ? "Update Subscription" : "Create Subscription"}</SheetTitle>
            <SheetDescription>
              Assign a plan and a period to a tenant.
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Tenant</p>
              <Select
                value={subscriptionForm.tenantId}
                onValueChange={(value) => setSubscriptionForm((prev) => ({ ...prev, tenantId: value || "" }))}
                disabled={Boolean(editingSubscription)}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Plan</p>
              <Select value={subscriptionForm.planId} onValueChange={(value) => setSubscriptionForm((prev) => ({ ...prev, planId: value || "" }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>{plan.name} ({plan.billingCycle})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Status</p>
              <Select value={subscriptionForm.status} onValueChange={(value) => setSubscriptionForm((prev) => ({ ...prev, status: value || "" }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">trial</SelectItem>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="past_due">past_due</SelectItem>
                  <SelectItem value="cancelled">cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Period Start</p>
                <Input
                  type="date"
                  value={subscriptionForm.currentPeriodStart}
                  onChange={(e) => setSubscriptionForm((prev) => ({ ...prev, currentPeriodStart: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Period End</p>
                <Input
                  type="date"
                  value={subscriptionForm.currentPeriodEnd}
                  onChange={(e) => setSubscriptionForm((prev) => ({ ...prev, currentPeriodEnd: e.target.value }))}
                />
              </div>
            </div>
            {subscriptionForm.status === "cancelled" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Cancel Reason</p>
                <Input
                  value={subscriptionForm.cancelReason}
                  onChange={(e) => setSubscriptionForm((prev) => ({ ...prev, cancelReason: e.target.value }))}
                />
              </div>
            ) : null}
            <Button className="w-full" onClick={handleSaveSubscription} disabled={savingSubscription}>
              {savingSubscription ? "Saving..." : editingSubscription ? "Update Subscription" : "Create Subscription"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}