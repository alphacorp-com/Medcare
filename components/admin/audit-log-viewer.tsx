"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ACTIONS = [
  { value: "all", label: "All actions" },
  { value: "admin.login", label: "Admin login" },
  { value: "admin.login_failed", label: "Admin login failed" },
  { value: "admin_account.create", label: "Admin account created" },
  { value: "admin_account.update", label: "Admin account updated" },
  { value: "admin_account.delete", label: "Admin account deleted" },
  { value: "admin_account.password_reset", label: "Admin password reset" },
  { value: "admin_account.password_change", label: "Admin password changed (self)" },
  { value: "admin_account.profile_update", label: "Admin profile updated" },
  { value: "user.login", label: "Tenant user login" },
  { value: "user.login_failed", label: "Tenant user login failed" },
  { value: "user.create", label: "Tenant user created" },
  { value: "user.update", label: "Tenant user updated" },
  { value: "user.delete", label: "Tenant user deleted" },
  { value: "user.password_reset", label: "Tenant user password reset" },
  { value: "feature_flag", label: "Feature flag changes" },
];

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

interface AuditEvent {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { email: string; fullName: string } | null;
  tenant: TenantOption | null;
}

const LIMIT = 50;

export function AuditLogViewer() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [actionFilter, setActionFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [actorEmail, setActorEmail] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (tenantFilter !== "all") params.set("tenantId", tenantFilter);
      if (actorEmail.trim()) params.set("actorEmail", actorEmail.trim());
      if (dateFrom) params.set("dateFrom", new Date(dateFrom).toISOString());
      if (dateTo) params.set("dateTo", new Date(dateTo).toISOString());

      const response = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch audit log:", error);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, tenantFilter, actorEmail, dateFrom, dateTo]);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/admin/tenants");
      if (response.ok) setTenants((await response.json()).tenants);
    })();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [actionFilter, tenantFilter, actorEmail, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Audit Log</h2>
        <p className="text-gray-600 text-sm">
          Logins and account-management events. Tenant/plan/subscription edits aren&apos;t audited yet.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label>Action</Label>
            <Select value={actionFilter} onValueChange={(value) => setActionFilter(value || "all")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((action) => (
                  <SelectItem key={action.value} value={action.value}>
                    {action.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tenant</Label>
            <Select value={tenantFilter} onValueChange={(value) => setTenantFilter(value || "all")}>
              <SelectTrigger className="w-full">
                <SelectValue />
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
          <div className="space-y-1">
            <Label>Actor email</Label>
            <Input value={actorEmail} onChange={(e) => setActorEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>
            {total} event{total !== 1 ? "s" : ""} — page {page} of {totalPages}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">Loading...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap text-xs">{new Date(event.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">
                        {event.actor ? (
                          <>
                            <div className="font-medium">{event.actor.fullName}</div>
                            <div className="text-gray-500">{event.actor.email}</div>
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{event.action}</TableCell>
                      <TableCell className="text-xs">{event.resourceType ?? "-"}</TableCell>
                      <TableCell className="text-xs">{event.tenant?.name ?? "-"}</TableCell>
                      <TableCell className="text-xs">{event.ipAddress ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-end gap-2 pt-4">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
