// Prints only `element`: while the browser print dialog is open, the print-region rules in
// app/globals.css hide everything except that element (and lift its scroll/height limits so
// every row prints). Mark controls inside it with `print-hide` to leave them off the paper.
// Browser-only — call it from an event handler.
export function printRegion(element: HTMLElement | null): void {
  if (!element) return;
  const cleanup = () => {
    element.classList.remove("print-region");
    document.body.classList.remove("printing-region");
    window.removeEventListener("afterprint", cleanup);
  };
  element.classList.add("print-region");
  document.body.classList.add("printing-region");
  window.addEventListener("afterprint", cleanup);
  window.print();
}
