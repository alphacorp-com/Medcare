"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminAccountsManagement } from "@/components/admin/admin-accounts-management";
import { TenantUsersManagement } from "@/components/admin/tenant-users-management";
import { FeatureFlagsManagement } from "@/components/admin/feature-flags-management";
import { AuditLogViewer } from "@/components/admin/audit-log-viewer";

export function SettingsManagement() {
  const { data: session } = useSession();
  // The other AdminRole values (sales/support/devops/finance) share the same session.user.role
  // ("admin") but don't get settings access — every sub-tab here (feature flags, audit log,
  // admin accounts, tenant users) calls a requireSuperAdmin-gated API route, so there's nothing
  // to show them. Gating the whole screen client-side avoids a UI full of 403 errors; the real
  // boundary is still requireSuperAdmin on each route.
  const isSuperAdmin = session?.user?.adminRole === "superadmin";

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-gray-600">Platform configuration and account management</p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            Settings are managed by super admins. Contact one if you need something changed here.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-gray-600">Platform configuration and account management</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="admin-accounts">Admin Accounts</TabsTrigger>
          <TabsTrigger value="tenant-users">Tenant Users</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Tabs defaultValue="feature-flags" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="feature-flags">Feature Flags</TabsTrigger>
              <TabsTrigger value="audit-log">Audit Log</TabsTrigger>
            </TabsList>
            <TabsContent value="feature-flags">
              <FeatureFlagsManagement />
            </TabsContent>
            <TabsContent value="audit-log">
              <AuditLogViewer />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="admin-accounts">
          <AdminAccountsManagement />
        </TabsContent>

        <TabsContent value="tenant-users">
          <TenantUsersManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
