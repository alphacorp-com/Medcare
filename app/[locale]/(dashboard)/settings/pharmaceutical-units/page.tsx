"use client";

import { ReferenceCatalogPage } from "@/components/settings/reference-catalog-page";

export default function PharmaceuticalUnitsPage() {
  return <ReferenceCatalogPage catalogType="pharmaceutical_unit" translationNamespace="settings.pharmaceuticalUnits" showGroup allowCsvImport />;
}
