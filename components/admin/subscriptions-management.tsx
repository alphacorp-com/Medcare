"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SubscriptionsManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Subscriptions Management</h2>
        <p className="text-gray-600">Monitor and manage tenant subscriptions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Subscriptions</CardTitle>
          <CardDescription>View and manage subscription status</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-8">Subscriptions management coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}