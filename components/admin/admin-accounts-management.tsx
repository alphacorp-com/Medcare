"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, KeyRound, Trash2, Copy, Check } from "lucide-react";

const ADMIN_ROLES = ["superadmin", "sales", "support", "devops", "finance"] as const;

interface AdminAccount {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export function AdminAccountsManagement() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [form, setForm] = useState({ email: "", fullName: "", role: "support", status: "active" });
  const [error, setError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<{ email: string; password: string } | null>(null);

  const [resetTarget, setResetTarget] = useState<AdminAccount | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/admin-accounts");
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.adminUsers);
      }
    } catch (fetchError) {
      console.error("Failed to fetch admin accounts:", fetchError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAccounts();
  }, []);

  const openCreateSheet = () => {
    setEditingAccount(null);
    setError(null);
    setGeneratedPassword(null);
    setForm({ email: "", fullName: "", role: "support", status: "active" });
    setSheetOpen(true);
  };

  const openEditSheet = (account: AdminAccount) => {
    setEditingAccount(account);
    setError(null);
    setGeneratedPassword(null);
    setForm({
      email: account.email,
      fullName: account.fullName,
      role: account.role,
      status: account.isActive ? "active" : "inactive",
    });
    setSheetOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.fullName || !form.role || (!editingAccount && !form.email)) {
      setError("Full name, email, and role are required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingAccount) {
        const response = await fetch(`/api/admin/admin-accounts/${editingAccount.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName,
            role: form.role,
            isActive: form.status === "active",
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Failed to update admin account");
        setSheetOpen(false);
      } else {
        const response = await fetch("/api/admin/admin-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, fullName: form.fullName, role: form.role }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Failed to create admin account");
        setGeneratedPassword({ email: form.email, password: payload.temporaryPassword });
      }
      await fetchAccounts();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save admin account";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account: AdminAccount) => {
    if (!window.confirm(`Remove admin account ${account.fullName} (${account.email})?`)) return;
    try {
      const response = await fetch(`/api/admin/admin-accounts/${account.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to delete admin account");
      }
      await fetchAccounts();
    } catch (deleteError) {
      window.alert(deleteError instanceof Error ? deleteError.message : "Failed to delete admin account");
    }
  };

  const openResetDialog = (account: AdminAccount) => {
    setResetTarget(account);
    setResetPassword(null);
    setCopied(false);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const response = await fetch(`/api/admin/admin-accounts/${resetTarget.id}/reset-password`, { method: "POST" });
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

  if (loading) {
    return <div className="flex justify-center p-8">Loading admin accounts...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Admin Accounts</h2>
          <p className="text-gray-600 text-sm">Manage MedCare staff accounts and their platform role</p>
        </div>
        <Button onClick={openCreateSheet}>
          <Plus className="h-4 w-4 mr-2" />
          Add Admin
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Admin Accounts</CardTitle>
          <CardDescription>
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.fullName}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>
                    <Badge variant={account.role === "superadmin" ? "default" : "secondary"}>{account.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={account.isActive ? "default" : "destructive"}>
                      {account.isActive ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleDateString() : "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEditSheet(account)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => openResetDialog(account)} title="Reset password">
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(account)}
                        disabled={account.role === "superadmin"}
                        title={account.role === "superadmin" ? "Super admin accounts cannot be deleted" : "Delete"}
                      >
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

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setGeneratedPassword(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingAccount ? "Update Admin Account" : "Create Admin Account"}</SheetTitle>
            <SheetDescription>
              {editingAccount ? "Update this admin's name, role, and status." : "Create a new MedCare admin account."}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Full name</p>
              <Input value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Email</p>
              <Input
                type="email"
                value={form.email}
                disabled={Boolean(editingAccount)}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Role</p>
              <Select
                value={form.role}
                onValueChange={(value) => setForm((prev) => ({ ...prev, role: value || "" }))}
                items={ADMIN_ROLES.map((role) => ({ value: role, label: role }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingAccount && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Status</p>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value || "" }))}
                  items={[
                    { value: "active", label: "active" },
                    { value: "inactive", label: "inactive" },
                  ]}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="inactive">inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!editingAccount && generatedPassword ? (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                <p className="text-sm text-emerald-700">
                  Account created. Share these credentials with the new admin — this password won&apos;t be shown again.
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Email:</span> <span className="font-mono">{generatedPassword.email}</span>
                </p>
                <p className="text-sm">
                  <span className="text-gray-600">Password:</span>{" "}
                  <span className="font-mono font-semibold">{generatedPassword.password}</span>
                </p>
                <Button className="w-full" onClick={() => setSheetOpen(false)}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <Button className="w-full" onClick={handleSubmit} disabled={saving}>
                  {saving ? "Saving..." : editingAccount ? "Update Account" : "Create Account"}
                </Button>
              </>
            )}
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
