"use client";

import { ReferenceCatalogPage } from "@/components/settings/reference-catalog-page";

export default function AdmissionTypesPage() {
  return <ReferenceCatalogPage catalogType="admission_type" translationNamespace="settings.admissionTypes" showColor />;
}
