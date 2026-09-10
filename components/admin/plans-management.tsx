"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Edit, Plus } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  tier: string;
  billingCycle: string;
  basePrice: string;
  currency: string;
  maxUsers: number | null;
  maxBeds: number | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
}

export function PlansManagement() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    tier: "core",
    billingCycle: "monthly",
    basePrice: "0",
    currency: "XAF",
    maxUsers: "",
    maxBeds: "",
    sortOrder: "0",
    isActive: true,
    isPublic: true,
  });

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/plans", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to fetch plans");
      setPlans(payload.plans || []);
    } catch (fetchError) {
      console.error(fetchError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPlans();
  }, []);

  const openCreateSheet = () => {
    setEditingPlan(null);
    setError(null);
    setForm({
      name: "",
      tier: "core",
      billingCycle: "monthly",
      basePrice: "0",
      currency: "XAF",
      maxUsers: "",
      maxBeds: "",
      sortOrder: "0",
      isActive: true,
      isPublic: true,
    });
    setSheetOpen(true);
  };

  const openEditSheet = (plan: Plan) => {
    setEditingPlan(plan);
    setError(null);
    setForm({
      name: plan.name,
      tier: plan.tier,
      billingCycle: plan.billingCycle,
      basePrice: String(plan.basePrice),
      currency: plan.currency,
      maxUsers: plan.maxUsers ? String(plan.maxUsers) : "",
      maxBeds: plan.maxBeds ? String(plan.maxBeds) : "",
      sortOrder: String(plan.sortOrder),
      isActive: plan.isActive,
      isPublic: plan.isPublic,
    });
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name) {
      setError("Plan name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const endpoint = editingPlan ? `/api/admin/plans/${editingPlan.id}` : "/api/admin/plans";
      const method = editingPlan ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          maxUsers: form.maxUsers || null,
          maxBeds: form.maxBeds || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to save plan");
      setSheetOpen(false);
      await fetchPlans();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading plans...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
        <h2 className="text-2xl font-bold">Plans Management</h2>
        <p className="text-gray-600">Configure subscription plans and pricing</p>
        </div>
        <Button onClick={openCreateSheet}>
          <Plus className="h-4 w-4 mr-2" />
          Add Plan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscription Plans</CardTitle>
          <CardDescription>{plans.length} plan(s) configured</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{plan.tier}</TableCell>
                  <TableCell>{plan.billingCycle}</TableCell>
                  <TableCell>{plan.basePrice} {plan.currency}</TableCell>
                  <TableCell>
                    {plan.maxUsers ?? "-"} users / {plan.maxBeds ?? "-"} beds
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.isActive ? "default" : "outline"}>
                      {plan.isActive ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEditSheet(plan)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingPlan ? "Update Plan" : "Create Plan"}</SheetTitle>
            <SheetDescription>
              Configure billing cycle, pricing, limits and visibility.
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Name</p>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Tier</p>
                <Select value={form.tier} onValueChange={(value) => setForm((prev) => ({ ...prev, tier: value || "" }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="core">core</SelectItem>
                    <SelectItem value="clinical">clinical</SelectItem>
                    <SelectItem value="advanced">advanced</SelectItem>
                    <SelectItem value="enterprise">enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Billing Cycle</p>
                <Select value={form.billingCycle} onValueChange={(value) => setForm((prev) => ({ ...prev, billingCycle: value || "" }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">monthly</SelectItem>
                    <SelectItem value="annual">annual</SelectItem>
                    <SelectItem value="perpetual">perpetual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Base Price</p>
                <Input type="number" value={form.basePrice} onChange={(e) => setForm((prev) => ({ ...prev, basePrice: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Currency</p>
                <Input value={form.currency} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Max Users</p>
                <Input type="number" value={form.maxUsers} onChange={(e) => setForm((prev) => ({ ...prev, maxUsers: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Max Beds</p>
                <Input type="number" value={form.maxBeds} onChange={(e) => setForm((prev) => ({ ...prev, maxBeds: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Sort Order</p>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={form.isActive ? "default" : "outline"}
                onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
              >
                Active: {form.isActive ? "yes" : "no"}
              </Button>
              <Button
                variant={form.isPublic ? "default" : "outline"}
                onClick={() => setForm((prev) => ({ ...prev, isPublic: !prev.isPublic }))}
              >
                Public: {form.isPublic ? "yes" : "no"}
              </Button>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="w-full" onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}