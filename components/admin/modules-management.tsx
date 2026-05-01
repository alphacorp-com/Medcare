"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ModulesManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Modules Management</h2>
        <p className="text-gray-600">Configure available modules and features</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Modules</CardTitle>
          <CardDescription>Enable/disable modules across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-8">Modules management coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}