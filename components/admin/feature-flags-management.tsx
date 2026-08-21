"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Users } from "lucide-react";

interface ModuleOption {
  id: string;
  code: string;
  name: string;
}

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

interface FeatureFlag {
  id: string;
  key: string;
  description: string | null;
  moduleId: string | null;
  defaultValue: boolean;
  isGlobal: boolean;
  rolloutPct: number;
  module: ModuleOption | null;
  _count: { tenantFeatureFlags: number };
}

interface TenantOverride {
  id: string;
  tenantId: string;
  value: boolean;
  reason: string | null;
  expiresAt: string | null;
  updatedAt: string;
  tenant: TenantOption;
}

const emptyForm = { key: "", description: "", moduleId: "none", defaultValue: false, isGlobal: false, rolloutPct: "0" };

export function FeatureFlagsManagement() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [overridesFlag, setOverridesFlag] = useState<FeatureFlag | null>(null);
  const [overrides, setOverrides] = useState<TenantOverride[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ tenantId: "", value: "true", reason: "" });
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/feature-flags");
      if (response.ok) {
        const data = await response.json();
        setFlags(data.flags);
      }
    } catch (fetchError) {
      console.error("Failed to fetch feature flags:", fetchError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchFlags();
    void (async () => {
      const [modulesRes, tenantsRes] = await Promise.all([fetch("/api/admin/modules"), fetch("/api/admin/tenants")]);
      if (modulesRes.ok) setModules((await modulesRes.json()).modules);
      if (tenantsRes.ok) setTenants((await tenantsRes.json()).tenants);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateSheet = () => {
    setEditingFlag(null);
    setError(null);
    setForm(emptyForm);
    setSheetOpen(true);
  };

  const openEditSheet = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setError(null);
    setForm({
      key: flag.key,
      description: flag.description || "",
      moduleId: flag.moduleId || "none",
      defaultValue: flag.defaultValue,
      isGlobal: flag.isGlobal,
      rolloutPct: String(flag.rolloutPct),
    });
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!editingFlag && !form.key.trim()) {
      setError("Key is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        description: form.description || null,
        moduleId: form.moduleId === "none" ? null : form.moduleId,
        defaultValue: form.defaultValue,
        isGlobal: form.isGlobal,
        rolloutPct: Number(form.rolloutPct) || 0,
      };

      const response = editingFlag
        ? await fetch(`/api/admin/feature-flags/${editingFlag.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/feature-flags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, key: form.key.trim() }),
          });

      const responsePayload = await response.json();
      if (!response.ok) throw new Error(responsePayload?.error || "Failed to save feature flag");

      setSheetOpen(false);
      await fetchFlags();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save feature flag");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (flag: FeatureFlag) => {
    if (!window.confirm(`Delete feature flag "${flag.key}"? This also removes its ${flag._count.tenantFeatureFlags} tenant override(s).`)) return;
    try {
      const response = await fetch(`/api/admin/feature-flags/${flag.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to delete feature flag");
      }
      await fetchFlags();
    } catch (deleteError) {
      window.alert(deleteError instanceof Error ? deleteError.message : "Failed to delete feature flag");
    }
  };

  const openOverrides = async (flag: FeatureFlag) => {
    setOverridesFlag(flag);
    setOverrideForm({ tenantId: "", value: "true", reason: "" });
    setOverrideError(null);
    setOverridesLoading(true);
    try {
      const response = await fetch(`/api/admin/feature-flags/${flag.id}/tenant-overrides`);
      if (response.ok) {
        const data = await response.json();
        setOverrides(data.overrides);
      }
    } finally {
      setOverridesLoading(false);
    }
  };

  const handleAddOverride = async () => {
    if (!overridesFlag || !overrideForm.tenantId) {
      setOverrideError("Select a tenant.");
      return;
    }
    setOverrideSaving(true);
    setOverrideError(null);
    try {
      const response = await fetch(`/api/admin/feature-flags/${overridesFlag.id}/tenant-overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: overrideForm.tenantId,
          value: overrideForm.value === "true",
          reason: overrideForm.reason || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to set override");
      await openOverrides(overridesFlag);
      await fetchFlags();
      setOverrideForm({ tenantId: "", value: "true", reason: "" });
    } catch (overrideSubmitError) {
      setOverrideError(overrideSubmitError instanceof Error ? overrideSubmitError.message : "Failed to set override");
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleRemoveOverride = async (override: TenantOverride) => {
    if (!overridesFlag) return;
    if (!window.confirm(`Remove override for ${override.tenant.name}?`)) return;
    try {
      const response = await fetch(`/api/admin/feature-flags/${overridesFlag.id}/tenant-overrides/${override.tenantId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to remove override");
      }
      await openOverrides(overridesFlag);
      await fetchFlags();
    } catch (removeError) {
      window.alert(removeError instanceof Error ? removeError.message : "Failed to remove override");
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading feature flags...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Feature Flags</h2>
          <p className="text-gray-600 text-sm">
            Toggle features globally or per tenant. Not wired to every feature yet — check the code before assuming a flag has an effect.
          </p>
        </div>
        <Button onClick={openCreateSheet}>
          <Plus className="h-4 w-4 mr-2" />
          New Flag
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Flags</CardTitle>
          <CardDescription>
            {flags.length} flag{flags.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Rollout</TableHead>
                <TableHead>Overrides</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-medium font-mono text-xs">{flag.key}</TableCell>
                  <TableCell>{flag.module?.name ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={flag.defaultValue ? "default" : "secondary"}>{flag.defaultValue ? "on" : "off"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{flag.isGlobal ? "global" : "per-tenant"}</Badge>
                  </TableCell>
                  <TableCell>{flag.rolloutPct}%</TableCell>
                  <TableCell>{flag._count.tenantFeatureFlags}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEditSheet(flag)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => openOverrides(flag)} title="Manage tenant overrides">
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(flag)} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
            <SheetTitle>{editingFlag ? "Update Feature Flag" : "New Feature Flag"}</SheetTitle>
            <SheetDescription>
              {editingFlag ? "Update this flag's default and rollout." : "Define a new feature flag."}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Key</p>
              <Input
                value={form.key}
                disabled={Boolean(editingFlag)}
                placeholder="feature_my_new_thing"
                onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Description</p>
              <Input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Module (optional)</p>
              <Select
                value={form.moduleId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, moduleId: value || "none" }))}
                items={[{ value: "none", label: "None" }, ...modules.map((module) => ({ value: module.id, label: module.name }))]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {modules.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Default value</p>
              <Select
                value={String(form.defaultValue)}
                onValueChange={(value) => setForm((prev) => ({ ...prev, defaultValue: value === "true" }))}
                items={[
                  { value: "false", label: "off" },
                  { value: "true", label: "on" },
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">off</SelectItem>
                  <SelectItem value="true">on</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Scope</p>
              <Select
                value={String(form.isGlobal)}
                onValueChange={(value) => setForm((prev) => ({ ...prev, isGlobal: value === "true" }))}
                items={[
                  { value: "false", label: "per-tenant (tenant overrides decide)" },
                  { value: "true", label: "global (same value for every tenant)" },
                ]}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">per-tenant (tenant overrides decide)</SelectItem>
                  <SelectItem value="true">global (same value for every tenant)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Rollout percentage</p>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.rolloutPct}
                onChange={(e) => setForm((prev) => ({ ...prev, rolloutPct: e.target.value }))}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="w-full" onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : editingFlag ? "Update Flag" : "Create Flag"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(overridesFlag)} onOpenChange={(open) => !open && setOverridesFlag(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tenant overrides — {overridesFlag?.key}</DialogTitle>
            <DialogDescription>Per-tenant values take priority over the flag&apos;s default.</DialogDescription>
          </DialogHeader>
          {overridesLoading ? (
            <div className="flex justify-center p-4">Loading...</div>
          ) : (
            <div className="space-y-4">
              {overrides.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {overrides.map((override) => (
                    <div key={override.id} className="flex items-center justify-between gap-2 rounded border p-2">
                      <div>
                        <p className="text-sm font-medium">{override.tenant.name}</p>
                        {override.reason ? <p className="text-xs text-gray-500">{override.reason}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={override.value ? "default" : "secondary"}>{override.value ? "on" : "off"}</Badge>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleRemoveOverride(override)} title="Remove override">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">Add / update an override</p>
                <div className="space-y-2">
                  <Label>Tenant</Label>
                  <Select
                    value={overrideForm.tenantId}
                    onValueChange={(value) => setOverrideForm((prev) => ({ ...prev, tenantId: value || "" }))}
                    items={tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Select
                    value={overrideForm.value}
                    onValueChange={(value) => setOverrideForm((prev) => ({ ...prev, value: value || "true" }))}
                    items={[
                      { value: "true", label: "on" },
                      { value: "false", label: "off" },
                    ]}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">on</SelectItem>
                      <SelectItem value="false">off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reason (optional)</Label>
                  <Input
                    value={overrideForm.reason}
                    onChange={(e) => setOverrideForm((prev) => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
                {overrideError ? <p className="text-sm text-red-600">{overrideError}</p> : null}
                <Button className="w-full" onClick={handleAddOverride} disabled={overrideSaving}>
                  {overrideSaving ? "Saving..." : "Save override"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
