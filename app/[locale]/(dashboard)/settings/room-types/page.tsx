"use client";

import { ReferenceCatalogPage } from "@/components/settings/reference-catalog-page";

export default function RoomTypesPage() {
  return <ReferenceCatalogPage catalogType="room_type" translationNamespace="settings.roomTypes" showColor showIcon />;
}
