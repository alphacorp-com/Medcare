"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, KeyRound, Trash2, Copy, Check } from "lucide-react";

const TENANT_USER_ROLES = [
  "tenant_admin",
  "doctor",
  "nurse",
  "pharmacist",
  "lab_tech",
  "radiologist",
  "billing",
  "hr",
  "viewer",
] as const;

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

interface TenantUserRow {
  id: string;
  email: string;
  fullName: string;
  role: string;
  tenantId: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  tenant: TenantOption | null;
}

export function TenantUsersManagement() {
  const [users, setUsers] = useState<TenantUserRow[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUserRow | null>(null);
  const [form, setForm] = useState({ fullName: "", role: "viewer", status: "active" });
  const [error, setError] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<TenantUserRow | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchUsers = useCallback(async (tenantId: string) => {
    try {
      setLoading(true);
      const query = tenantId !== "all" ? `?tenantId=${tenantId}` : "";
      const response = await fetch(`/api/admin/tenant-users${query}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (fetchError) {
      console.error("Failed to fetch tenant users:", fetchError);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTenants = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/tenants");
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants);
      }
    } catch (fetchError) {
      console.error("Failed to fetch tenants:", fetchError);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTenants();
  }, [fetchTenants]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchUsers(tenantFilter);
  }, [tenantFilter, fetchUsers]);

  const openEditSheet = (user: TenantUserRow) => {
    setEditingUser(user);
    setError(null);
    setForm({ fullName: user.fullName, role: user.role, status: user.isActive ? "active" : "inactive" });
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!editingUser) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tenant-users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          role: form.role,
          isActive: form.status === "active",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to update user");
      setSheetOpen(false);
      await fetchUsers(tenantFilter);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to update user";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: TenantUserRow) => {
    if (!window.confirm(`Remove user ${user.fullName} (${user.email})?`)) return;
    try {
      const response = await fetch(`/api/admin/tenant-users/${user.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to delete user");
      }
      await fetchUsers(tenantFilter);
    } catch (deleteError) {
      window.alert(deleteError instanceof Error ? deleteError.message : "Failed to delete user");
    }
  };

  const openResetDialog = (user: TenantUserRow) => {
    setResetTarget(user);
    setResetPassword(null);
    setCopied(false);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const response = await fetch(`/api/admin/tenant-users/${resetTarget.id}/reset-password`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to reset password");
      setResetPassword(payload.temporaryPassword);
    } catch (resetError) {
      window.alert(resetError instanceof Error ? resetError.message : "Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (clipboardError) {
      console.error("Failed to copy to clipboard:", clipboardError);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Tenant Users</h2>
          <p className="text-gray-600 text-sm">Browse and manage admins &amp; users across all tenants</p>
        </div>
        <Select value={tenantFilter} onValueChange={(value) => setTenantFilter(value || "all")}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="All tenants" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tenants</SelectItem>
            {tenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {users.length} user{users.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">Loading users...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.tenant?.name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "destructive"}>
                        {user.isActive ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEditSheet(user)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => openResetDialog(user)} title="Reset password">
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(user)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Update User</SheetTitle>
            <SheetDescription>Update this user&apos;s name, role, and status.</SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Full name</p>
              <Input value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Role</p>
              <Select value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value || "" }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TENANT_USER_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
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
                  <SelectItem value="active">active</SelectItem>
                  <SelectItem value="inactive">inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="w-full" onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : "Update User"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {resetTarget && `Generate a new temporary password for ${resetTarget.fullName} (${resetTarget.email}).`}
            </DialogDescription>
          </DialogHeader>
          {resetPassword ? (
            <div className="rounded border border-emerald-200 bg-emerald-50 p-3 space-y-2">
              <p className="text-sm text-emerald-700">
                This password won&apos;t be shown again — copy it and share it with the account holder.
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-sm">{resetPassword}</span>
                <Button variant="outline" size="icon-sm" onClick={() => copyToClipboard(resetPassword)}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleResetPassword} disabled={resetting}>
                {resetting ? "Generating..." : "Generate new password"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
