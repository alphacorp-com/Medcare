"use client";

import { useEffect, useState } from "react";

// Returns `value` once it has stopped changing for `delayMs` — e.g. a search box, so the
// server is queried when the user pauses typing rather than on every keystroke.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
