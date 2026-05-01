"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Users,
  CreditCard,
  FileText,
  Settings,
  BarChart3,
  Shield,
  Database
} from "lucide-react";

// Import admin components
import { TenantsManagement } from "@/components/admin/tenants-management";
import { PlansManagement } from "@/components/admin/plans-management";
import { SubscriptionsManagement } from "@/components/admin/subscriptions-management";
import { InvoicesManagement } from "@/components/admin/invoices-management";
import { ModulesManagement } from "@/components/admin/modules-management";
import { SettingsManagement } from "@/components/admin/settings-management";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("tenants");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">MedCare Admin</h1>
                <p className="text-sm text-gray-500">Platform Management</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              Back to App
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="tenants" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Tenants
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="modules" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Modules
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tenants">
            <TenantsManagement />
          </TabsContent>

          <TabsContent value="plans">
            <PlansManagement />
          </TabsContent>

          <TabsContent value="subscriptions">
            <SubscriptionsManagement />
          </TabsContent>

          <TabsContent value="invoices">
            <InvoicesManagement />
          </TabsContent>

          <TabsContent value="modules">
            <ModulesManagement />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}