"use client";

import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminAccountsManagement } from "@/components/admin/admin-accounts-management";
import { TenantUsersManagement } from "@/components/admin/tenant-users-management";

export function SettingsManagement() {
  const { data: session } = useSession();
  // The other AdminRole values (sales/support/devops/finance) share the same session.user.role
  // ("admin") but don't get account-management access — only enforced client-side here for UX;
  // the real boundary is requireSuperAdmin on each API route.
  const isSuperAdmin = session?.user?.adminRole === "superadmin";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-gray-600">Platform configuration and account management</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className={isSuperAdmin ? "grid w-full grid-cols-3" : "grid w-full grid-cols-1"}>
          <TabsTrigger value="general">General</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="admin-accounts">Admin Accounts</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="tenant-users">Tenant Users</TabsTrigger>}
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Global Configuration</CardTitle>
              <CardDescription>Platform-wide settings and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-500 py-8">Settings management coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="admin-accounts">
            <AdminAccountsManagement />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="tenant-users">
            <TenantUsersManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
