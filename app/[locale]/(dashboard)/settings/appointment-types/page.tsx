"use client";

import { ReferenceCatalogPage } from "@/components/settings/reference-catalog-page";

export default function AppointmentTypesPage() {
  return <ReferenceCatalogPage catalogType="appointment_type" translationNamespace="settings.appointmentTypes" showColor />;
}
