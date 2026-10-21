"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

// Opens the item named by a URL parameter (e.g. /laboratory?exam=<id>, used by the
// dashboard panels) once the page's list has loaded. The match is derived during render
// rather than copied into state from an effect; `dismiss` stops it from reopening after
// the user closes it. An id that isn't in the list is ignored, so the parameter can only
// open something the page already fetched with the user's own permissions.
//
// useSearchParams requires the calling page to be wrapped in <Suspense>.
export function useDeepLinkedItem<T extends { id: string }>(param: string, items: readonly T[]) {
  const linkedId = useSearchParams().get(param);
  const [dismissed, setDismissed] = useState(false);

  const linked = !dismissed && linkedId ? (items.find((item) => item.id === linkedId) ?? null) : null;
  return { linked, dismiss: () => setDismissed(true) };
}

// Same idea for a plain value such as a tab name, restricted to the allowed values.
export function useDeepLinkedValue<T extends string>(param: string, allowed: readonly T[]): T | null {
  const value = useSearchParams().get(param);
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}
