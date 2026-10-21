// ART regimens (RMA3 IV.1.4: people on ART per protocol), by treatment line.
//
// TO BE VALIDATED against the current national HIV guidelines (MINSANTE / CNLS): the list
// follows the usual adult and paediatric protocols; "OTHER-n" keeps a regimen not listed
// countable in its line. Codes are stored on each ART visit, so renaming a label is safe
// but changing a code splits the history.

export interface ArtRegimen {
  code: string;
  label: string;
  line: 1 | 2 | 3;
  paediatric?: boolean;
}

export const ART_REGIMENS: readonly ArtRegimen[] = [
  // 1st line, adults and adolescents
  { code: "TDF-3TC-DTG", label: "TDF + 3TC + DTG (TLD)", line: 1 },
  { code: "TDF-3TC-EFV400", label: "TDF + 3TC + EFV 400", line: 1 },
  { code: "TDF-3TC-EFV600", label: "TDF + 3TC + EFV 600", line: 1 },
  { code: "TDF-FTC-EFV", label: "TDF + FTC + EFV", line: 1 },
  { code: "TDF-3TC-NVP", label: "TDF + 3TC + NVP", line: 1 },
  { code: "AZT-3TC-NVP", label: "AZT + 3TC + NVP", line: 1 },
  { code: "AZT-3TC-EFV", label: "AZT + 3TC + EFV", line: 1 },
  { code: "AZT-3TC-DTG", label: "AZT + 3TC + DTG", line: 1 },
  { code: "ABC-3TC-DTG", label: "ABC + 3TC + DTG", line: 1 },
  { code: "ABC-3TC-EFV", label: "ABC + 3TC + EFV", line: 1 },
  // 1st line, children
  { code: "P-ABC-3TC-DTG", label: "ABC + 3TC + DTG (enfant)", line: 1, paediatric: true },
  { code: "P-ABC-3TC-LPVr", label: "ABC + 3TC + LPV/r (enfant)", line: 1, paediatric: true },
  { code: "P-AZT-3TC-LPVr", label: "AZT + 3TC + LPV/r (enfant)", line: 1, paediatric: true },
  { code: "P-AZT-3TC-NVP", label: "AZT + 3TC + NVP (enfant)", line: 1, paediatric: true },
  { code: "P-ABC-3TC-EFV", label: "ABC + 3TC + EFV (enfant)", line: 1, paediatric: true },
  { code: "OTHER-1", label: "Autre protocole de 1re ligne", line: 1 },
  // 2nd line
  { code: "AZT-3TC-ATVr", label: "AZT + 3TC + ATV/r", line: 2 },
  { code: "AZT-3TC-LPVr", label: "AZT + 3TC + LPV/r", line: 2 },
  { code: "TDF-3TC-ATVr", label: "TDF + 3TC + ATV/r", line: 2 },
  { code: "TDF-3TC-LPVr", label: "TDF + 3TC + LPV/r", line: 2 },
  { code: "ABC-3TC-ATVr", label: "ABC + 3TC + ATV/r", line: 2 },
  { code: "ABC-3TC-LPVr", label: "ABC + 3TC + LPV/r", line: 2 },
  { code: "TDF-3TC-DTG-2", label: "TDF + 3TC + DTG (2e ligne)", line: 2 },
  { code: "AZT-3TC-DTG-2", label: "AZT + 3TC + DTG (2e ligne)", line: 2 },
  { code: "P-AZT-3TC-DTG-2", label: "AZT + 3TC + DTG (enfant, 2e ligne)", line: 2, paediatric: true },
  { code: "P-ABC-3TC-DTG-2", label: "ABC + 3TC + DTG (enfant, 2e ligne)", line: 2, paediatric: true },
  { code: "OTHER-2", label: "Autre protocole de 2e ligne", line: 2 },
  // 3rd line
  { code: "DRVr-DTG-NRTI", label: "DRV/r + DTG ± INTI", line: 3 },
  { code: "DRVr-RAL-NRTI", label: "DRV/r + RAL ± INTI", line: 3 },
  { code: "OTHER-3", label: "Autre protocole de 3e ligne", line: 3 },
];

const BY_CODE = new Map(ART_REGIMENS.map((r) => [r.code, r]));

export function findRegimen(code: string): ArtRegimen | undefined {
  return BY_CODE.get(code);
}
