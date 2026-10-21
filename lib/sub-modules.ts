// Permissions finer than a licensed module: granted per user in the permission matrix, but
// active only while their parent module is active for the tenant (no separate licence).
// MODULE_HIV keeps HIV / PMTCT / hepatitis / STI records (highly sensitive) away from staff
// who only need the other disease programs.
export const SUB_MODULE_PARENT: Readonly<Record<string, string>> = {
  MODULE_HIV: "MODULE_DISEASE_PROGRAMS",
};
