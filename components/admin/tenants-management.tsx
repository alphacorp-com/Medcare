"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Edit } from "lucide-react";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  contactEmail?: string;
  createdAt: string;
}

export function TenantsManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    type: "hospital",
    status: "trial",
    contactEmail: "",
  });
  const [createAdminUser, setCreateAdminUser] = useState(false);
  const [adminUserForm, setAdminUserForm] = useState({ fullName: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<{ email: string; password: string } | null>(null);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/tenants');
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTenants();
  }, []);

  const openCreateSheet = () => {
    setEditingTenant(null);
    setError(null);
    setGeneratedPassword(null);
    setForm({
      name: "",
      slug: "",
      type: "hospital",
      status: "trial",
      contactEmail: "",
    });
    setCreateAdminUser(false);
    setAdminUserForm({ fullName: "", email: "" });
    setSheetOpen(true);
  };

  const openEditSheet = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setError(null);
    setForm({
      name: tenant.name,
      slug: tenant.slug,
      type: tenant.type,
      status: tenant.status,
      contactEmail: tenant.contactEmail || "",
    });
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.slug || !form.type) {
      setError("Name, slug and type are required.");
      return;
    }

    if (!editingTenant && createAdminUser && (!adminUserForm.fullName || !adminUserForm.email)) {
      setError("Admin user name and email are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const endpoint = editingTenant ? `/api/admin/tenants/${editingTenant.id}` : "/api/admin/tenants";
      const method = editingTenant ? "PUT" : "POST";

      const body: Record<string, unknown> = { ...form };
      if (!editingTenant && createAdminUser) {
        body.adminUser = adminUserForm;
      }

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save tenant");
      }

      await fetchTenants();

      if (payload.adminTemporaryPassword) {
        setGeneratedPassword({ email: adminUserForm.email, password: payload.adminTemporaryPassword });
      } else {
        setSheetOpen(false);
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save tenant";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      trial: "secondary",
      active: "default",
      suspended: "destructive",
      churned: "outline"
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading tenants...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tenants Management</h2>
          <p className="text-gray-600">Manage healthcare facilities and organizations</p>
        </div>
        <Button onClick={openCreateSheet}>
          <Plus className="h-4 w-4 mr-2" />
          Add Tenant
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>
            {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} registered
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>{tenant.slug}</TableCell>
                  <TableCell>{tenant.type}</TableCell>
                  <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                  <TableCell>{tenant.contactEmail || '-'}</TableCell>
                  <TableCell>{new Date(tenant.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditSheet(tenant)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setGeneratedPassword(null);
            setCreateAdminUser(false);
            setAdminUserForm({ fullName: "", email: "" });
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingTenant ? "Update Tenant" : "Create Tenant"}</SheetTitle>
            <SheetDescription>
              {editingTenant
                ? "Update tenant profile and status."
                : "Create a new tenant and configure the initial profile."}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Name</p>
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Slug</p>
              <Input value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Type</p>
              <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value || "" }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hospital">hospital</SelectItem>
                  <SelectItem value="clinic">clinic</SelectItem>
                  <SelectItem value="ehpad">ehpad</SelectItem>
                  <SelectItem value="lab">lab</SelectItem>
                  <SelectItem value="specialized">specialized</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Status</p>
              <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value || "" }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">trial</SelectItem>
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="suspended">suspended</SelectItem>
                  <SelectItem value="churned">churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Contact email</p>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
              />
            </div>

            {!editingTenant && generatedPassword ? (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                <p className="text-sm text-emerald-700">
                  Tenant created. Share these credentials with the tenant admin — this password won&apos;t be shown again.
                </p>
                <p className="text-sm"><span className="text-gray-600">Email:</span> <span className="font-mono">{generatedPassword.email}</span></p>
                <p className="text-sm"><span className="text-gray-600">Password:</span> <span className="font-mono font-semibold">{generatedPassword.password}</span></p>
                <Button className="w-full" onClick={() => setSheetOpen(false)}>Done</Button>
              </div>
            ) : (
              <>
                {!editingTenant && (
                  <div className="space-y-3 border-t pt-4">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createAdminUser}
                        onChange={(e) => setCreateAdminUser(e.target.checked)}
                      />
                      Create an initial admin user for this tenant
                    </label>
                    {createAdminUser && (
                      <div className="space-y-3 pl-1">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Admin full name</p>
                          <Input
                            value={adminUserForm.fullName}
                            onChange={(e) => setAdminUserForm((prev) => ({ ...prev, fullName: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Admin email</p>
                          <Input
                            type="email"
                            value={adminUserForm.email}
                            onChange={(e) => setAdminUserForm((prev) => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        <p className="text-xs text-gray-500">
                          A temporary password will be generated and shown once after the tenant is created.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <Button className="w-full" onClick={handleSubmit} disabled={saving}>
                  {saving ? "Saving..." : editingTenant ? "Update Tenant" : "Create Tenant"}
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}