"use client";

import { ReferenceCatalogPage } from "@/components/settings/reference-catalog-page";

export default function VaccineAntigensPage() {
  return <ReferenceCatalogPage catalogType="vaccine_antigen" translationNamespace="settings.vaccineAntigens" showGroup />;
}
