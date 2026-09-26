"use client";

import { useEffect } from "react";

// On phones, globals.css turns every <table> into a stack of cards and hides its header row.
// To keep each value identifiable, this copies the column headers onto the body cells as
// `data-label`, which the CSS prints above the value. A single observer covers every
// table in the app, including rows rendered after data loads or inside sheets.
function labelTables() {
  document.querySelectorAll("table").forEach((table) => {
    const headers = Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? "");
    if (headers.length === 0) return;

    table.querySelectorAll("tbody tr").forEach((row) => {
      let column = 0;
      for (const cell of Array.from(row.children)) {
        const span = Number(cell.getAttribute("colspan")) || 1;
        const label = span === 1 ? headers[column] : "";
        if (label) {
          if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
        } else {
          cell.removeAttribute("data-label");
        }
        column += span;
      }
    });
  });
}

export function TableCardLabels() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(labelTables);
    };

    schedule();
    // Only structural changes are observed, so setting data-label never re-triggers it.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
