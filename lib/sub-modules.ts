// Permissions finer than a licensed module: granted per user in the permission matrix, but
// active only while their parent module is active for the tenant (no separate licence).
// MODULE_HIV keeps HIV / PMTCT / hepatitis / STI records (highly sensitive) away from staff
// who only need the other disease programs.
// MODULE_RMA3 is the RMA3 monthly form (read / update to enter, validate to lock a month):
// a reporting duty of every facility, hence attached to the core patient module.
export const SUB_MODULE_PARENT: Readonly<Record<string, string>> = {
  MODULE_HIV: "MODULE_DISEASE_PROGRAMS",
  MODULE_RMA3: "MODULE_CORE_PATIENT",
};
