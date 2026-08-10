"use client";

import { ReferenceCatalogPage } from "@/components/settings/reference-catalog-page";

export default function ImagingTypesPage() {
  return <ReferenceCatalogPage catalogType="imaging_type" translationNamespace="settings.imagingTypes" showColor />;
}
