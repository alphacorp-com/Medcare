"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface ModuleItem {
  id: string;
  code: string;
  name: string;
  category: string;
  tier: string;
  isPublished: boolean;
}

interface TenantModuleItem {
  id: string;
  tenantId: string;
  moduleId: string;
  status: "active" | "suspended" | "trial" | "pending";
  activatedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
}

export function ModulesManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [tenantModules, setTenantModules] = useState<TenantModuleItem[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [draftStatuses, setDraftStatuses] = useState<Record<string, TenantModuleItem["status"]>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/modules", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to fetch modules");
      setTenants(payload.tenants || []);
      setModules(payload.modules || []);
      setTenantModules(payload.tenantModules || []);
      if (!selectedTenantId && payload.tenants?.length) {
        setSelectedTenantId(payload.tenants[0].id);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch modules");
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const selectedTenantName = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId)?.name || "Selected tenant",
    [tenants, selectedTenantId]
  );

  const getModuleStatus = (moduleId: string): TenantModuleItem["status"] => {
    const draft = draftStatuses[moduleId];
    if (draft) return draft;
    const existing = tenantModules.find((item) => item.tenantId === selectedTenantId && item.moduleId === moduleId);
    return existing?.status || "pending";
  };

  const openTenantConfig = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setDraftStatuses({});
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!selectedTenantId) return;
    setSaving(true);
    setError(null);
    try {
      const modulesPayload = modules.map((module) => ({
        moduleId: module.id,
        status: getModuleStatus(module.id),
      }));

      const response = await fetch(`/api/admin/modules/tenant/${selectedTenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: modulesPayload }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to update tenant modules");
      setSheetOpen(false);
      await fetchData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update tenant modules");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading module configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Modules Management</h2>
        <p className="text-gray-600">Configure modules per tenant and control activation statuses</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenant Module Configuration</CardTitle>
          <CardDescription>Only platform administrators can activate or deactivate tenant modules. Tenant admins can only view active modules in their subscription.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="max-w-sm">
              <Select value={selectedTenantId} onValueChange={(value) => setSelectedTenantId(value || "")}>
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

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((module) => (
                  <TableRow key={module.id}>
                    <TableCell className="font-medium">{module.name}</TableCell>
                    <TableCell className="font-mono">{module.code}</TableCell>
                    <TableCell>{module.category}</TableCell>
                    <TableCell>
                      <Badge variant={getModuleStatus(module.id) === "active" ? "default" : "secondary"}>
                        {getModuleStatus(module.id)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={module.isPublished ? "default" : "outline"}>
                        {module.isPublished ? "yes" : "no"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button onClick={() => openTenantConfig(selectedTenantId)} disabled={!selectedTenantId}>
              <Settings className="h-4 w-4 mr-2" />
              Configure Selected Tenant
            </Button>
          </div>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Tenant Module Status</SheetTitle>
            <SheetDescription>{selectedTenantName}: activate, suspend or keep modules pending.</SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-3 overflow-y-auto">
            {modules.map((module) => (
              <div key={module.id} className="border rounded p-3 space-y-2">
                <div>
                  <p className="font-medium text-sm">{module.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{module.code}</p>
                </div>
                <Select
                  value={getModuleStatus(module.id)}
                  onValueChange={(value) =>
                    setDraftStatuses((prev) => ({
                      ...prev,
                      [module.id]: value as TenantModuleItem["status"],
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="suspended">suspended</SelectItem>
                    <SelectItem value="trial">trial</SelectItem>
                    <SelectItem value="pending">pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Tenant Module Configuration"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}