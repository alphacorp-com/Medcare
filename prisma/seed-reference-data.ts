import { PrismaClient, ReferenceCatalogType, ExamCatalogDomain } from '@prisma/client';

// Seeds every new tenant-configurable reference-data catalog introduced alongside the
// Settings "reference data" pages: the 7 generic ReferenceCatalogItem lists, Medical Act
// Categories/Acts, the Exam catalog (replacing lib/laboratory/panels.ts and
// lib/radiology/catalog.ts), ICD-10 codes, and Storage Locations/Suppliers.
// Called once from prisma/seed.ts's main() for the default tenant — intentionally kept
// in its own file (per request) rather than folded into the already-large seed.ts.

type GenericCatalogSeed = {
  catalogType: ReferenceCatalogType;
  code: string;
  nameFr: string;
  nameEn?: string;
  color?: string;
  icon?: string;
  group?: string;
  order?: number;
};

const ADMISSION_TYPES: GenericCatalogSeed[] = [
  { catalogType: 'admission_type', code: 'WALK_IN', nameFr: 'Consultation directe', nameEn: 'Walk-in', color: '#1565c0', order: 1 },
  { catalogType: 'admission_type', code: 'EMERGENCY', nameFr: 'Urgence', nameEn: 'Emergency', color: '#c62828', order: 2 },
  { catalogType: 'admission_type', code: 'REFERRAL', nameFr: 'Référé', nameEn: 'Referral', color: '#ef6c00', order: 3 },
  { catalogType: 'admission_type', code: 'TRANSFER', nameFr: 'Transfert', nameEn: 'Transfer', color: '#6a1b9a', order: 4 },
  { catalogType: 'admission_type', code: 'ELECTIVE', nameFr: 'Hospitalisation programmée', nameEn: 'Elective', color: '#2e7d32', order: 5 },
  { catalogType: 'admission_type', code: 'MATERNITY', nameFr: 'Maternité', nameEn: 'Maternity', color: '#ad1457', order: 6 },
  { catalogType: 'admission_type', code: 'DAY_SURGERY', nameFr: 'Chirurgie ambulatoire', nameEn: 'Day surgery', color: '#283593', order: 7 },
];

const APPOINTMENT_TYPES: GenericCatalogSeed[] = [
  { catalogType: 'appointment_type', code: 'CONSULTATION', nameFr: 'Consultation', nameEn: 'Consultation', color: '#1565c0', order: 1 },
  { catalogType: 'appointment_type', code: 'FOLLOWUP', nameFr: 'Suivi', nameEn: 'Follow-up', color: '#2e7d32', order: 2 },
  { catalogType: 'appointment_type', code: 'CHECKUP', nameFr: 'Contrôle', nameEn: 'Check-up', color: '#00838f', order: 3 },
  { catalogType: 'appointment_type', code: 'VACCINATION', nameFr: 'Vaccination', nameEn: 'Vaccination', color: '#6a1b9a', order: 4 },
  { catalogType: 'appointment_type', code: 'PROCEDURE', nameFr: 'Acte technique', nameEn: 'Procedure', color: '#ef6c00', order: 5 },
  { catalogType: 'appointment_type', code: 'ANC', nameFr: 'Consultation prénatale', nameEn: 'Antenatal visit', color: '#ad1457', order: 6 },
];

const ROOM_TYPES: GenericCatalogSeed[] = [
  { catalogType: 'room_type', code: 'GENERAL', nameFr: 'Médecine Générale', nameEn: 'General Medicine', color: '#1565c0', icon: 'BedDouble', order: 1 },
  { catalogType: 'room_type', code: 'ICU', nameFr: 'Soins Intensifs (USI)', nameEn: 'Intensive Care (ICU)', color: '#c62828', icon: 'HeartPulse', order: 2 },
  { catalogType: 'room_type', code: 'MATERNITY', nameFr: 'Maternité', nameEn: 'Maternity', color: '#d81b60', icon: 'Baby', order: 3 },
  { catalogType: 'room_type', code: 'PEDIATRIC', nameFr: 'Pédiatrie', nameEn: 'Pediatrics', color: '#1e88e5', icon: 'Users', order: 4 },
  { catalogType: 'room_type', code: 'EMERGENCY', nameFr: 'Urgences', nameEn: 'Emergency', color: '#e64a19', icon: 'Siren', order: 5 },
  { catalogType: 'room_type', code: 'SURGICAL', nameFr: 'Chirurgie', nameEn: 'Surgery', color: '#4527a0', icon: 'Scissors', order: 6 },
  { catalogType: 'room_type', code: 'ISOLATION', nameFr: 'Isolement', nameEn: 'Isolation', color: '#37474f', icon: 'Ban', order: 7 },
  { catalogType: 'room_type', code: 'NEONATAL', nameFr: 'Néonatologie', nameEn: 'Neonatal', color: '#2e7d32', icon: 'Baby', order: 8 },
];

const INSURANCE_TYPES: GenericCatalogSeed[] = [
  { catalogType: 'insurance_type', code: 'CNPS', nameFr: 'CNPS', nameEn: 'National Social Security', color: '#1565c0', order: 1 },
  { catalogType: 'insurance_type', code: 'PRIVATE', nameFr: 'Assurance privée', nameEn: 'Private insurance', color: '#2e7d32', order: 2 },
  { catalogType: 'insurance_type', code: 'MUTUAL', nameFr: 'Mutuelle de santé', nameEn: 'Health mutual', color: '#00838f', order: 3 },
  { catalogType: 'insurance_type', code: 'EMPLOYER', nameFr: 'Assurance employeur', nameEn: 'Employer insurance', color: '#6a1b9a', order: 4 },
  { catalogType: 'insurance_type', code: 'SELF_PAY', nameFr: 'Paiement direct (sans assurance)', nameEn: 'Self-pay', color: '#757575', order: 5 },
];

const IMAGING_TYPES: GenericCatalogSeed[] = [
  { catalogType: 'imaging_type', code: 'XRAY', nameFr: 'Radiographie (RX)', nameEn: 'X-Ray', color: '#1565c0', order: 1 },
  { catalogType: 'imaging_type', code: 'ECHO', nameFr: 'Échographie', nameEn: 'Ultrasound', color: '#2e7d32', order: 2 },
  { catalogType: 'imaging_type', code: 'CT_SCAN', nameFr: 'Scanner (TDM)', nameEn: 'CT Scan', color: '#4527a0', order: 3 },
  { catalogType: 'imaging_type', code: 'MRI', nameFr: 'IRM', nameEn: 'MRI', color: '#6a1b9a', order: 4 },
  { catalogType: 'imaging_type', code: 'ECG', nameFr: 'ECG', nameEn: 'ECG', color: '#c62828', order: 5 },
  { catalogType: 'imaging_type', code: 'ECHO_CARDIAC', nameFr: 'Échocardiographie', nameEn: 'Echocardiography', color: '#ad1457', order: 6 },
  { catalogType: 'imaging_type', code: 'MAMMOGRAPHY', nameFr: 'Mammographie', nameEn: 'Mammography', color: '#ef6c00', order: 7 },
  { catalogType: 'imaging_type', code: 'BONE_DENSITY', nameFr: 'Ostéodensitométrie', nameEn: 'Bone densitometry', color: '#00838f', order: 8 },
];

const ANATOMICAL_ZONES: GenericCatalogSeed[] = [
  { catalogType: 'anatomical_zone', code: 'HEAD', nameFr: 'Tête', nameEn: 'Head', order: 1 },
  { catalogType: 'anatomical_zone', code: 'NECK', nameFr: 'Cou', nameEn: 'Neck', order: 2 },
  { catalogType: 'anatomical_zone', code: 'CHEST', nameFr: 'Thorax', nameEn: 'Chest', order: 3 },
  { catalogType: 'anatomical_zone', code: 'ABDOMEN', nameFr: 'Abdomen', nameEn: 'Abdomen', order: 4 },
  { catalogType: 'anatomical_zone', code: 'PELVIS', nameFr: 'Bassin', nameEn: 'Pelvis', order: 5 },
  { catalogType: 'anatomical_zone', code: 'SPINE', nameFr: 'Colonne vertébrale', nameEn: 'Spine', order: 6 },
  { catalogType: 'anatomical_zone', code: 'UPPER_LIMB', nameFr: 'Membre supérieur', nameEn: 'Upper limb', order: 7 },
  { catalogType: 'anatomical_zone', code: 'LOWER_LIMB', nameFr: 'Membre inférieur', nameEn: 'Lower limb', order: 8 },
  { catalogType: 'anatomical_zone', code: 'SKULL', nameFr: 'Crâne', nameEn: 'Skull', order: 9 },
  { catalogType: 'anatomical_zone', code: 'BREAST', nameFr: 'Sein', nameEn: 'Breast', order: 10 },
];

const PHARMACEUTICAL_UNITS: GenericCatalogSeed[] = [
  { catalogType: 'pharmaceutical_unit', code: 'TABLET', nameFr: 'comprimé', nameEn: 'tablet', group: 'Formes solides orales' },
  { catalogType: 'pharmaceutical_unit', code: 'CAPSULE', nameFr: 'gélule', nameEn: 'capsule', group: 'Formes solides orales' },
  { catalogType: 'pharmaceutical_unit', code: 'POWDER_SACHET', nameFr: 'sachet de poudre', nameEn: 'powder sachet', group: 'Formes solides orales' },
  { catalogType: 'pharmaceutical_unit', code: 'EFFERVESCENT', nameFr: 'comprimé effervescent', nameEn: 'effervescent tablet', group: 'Formes solides orales' },
  { catalogType: 'pharmaceutical_unit', code: 'SYRUP', nameFr: 'sirop', nameEn: 'syrup', group: 'Formes liquides orales' },
  { catalogType: 'pharmaceutical_unit', code: 'ORAL_SOLUTION', nameFr: 'solution buvable', nameEn: 'oral solution', group: 'Formes liquides orales' },
  { catalogType: 'pharmaceutical_unit', code: 'ORAL_SUSPENSION', nameFr: 'suspension buvable', nameEn: 'oral suspension', group: 'Formes liquides orales' },
  { catalogType: 'pharmaceutical_unit', code: 'DROPS_ORAL', nameFr: 'gouttes buvables', nameEn: 'oral drops', group: 'Formes liquides orales' },
  { catalogType: 'pharmaceutical_unit', code: 'INJECTION_VIAL', nameFr: 'flacon injectable', nameEn: 'injection vial', group: 'Injectables' },
  { catalogType: 'pharmaceutical_unit', code: 'AMPOULE', nameFr: 'ampoule injectable', nameEn: 'ampoule', group: 'Injectables' },
  { catalogType: 'pharmaceutical_unit', code: 'PREFILLED_SYRINGE', nameFr: 'seringue préremplie', nameEn: 'prefilled syringe', group: 'Injectables' },
  { catalogType: 'pharmaceutical_unit', code: 'IV_BAG', nameFr: 'poche pour perfusion', nameEn: 'IV bag', group: 'Injectables' },
  { catalogType: 'pharmaceutical_unit', code: 'CREAM', nameFr: 'crème', nameEn: 'cream', group: 'Formes topiques' },
  { catalogType: 'pharmaceutical_unit', code: 'OINTMENT', nameFr: 'pommade', nameEn: 'ointment', group: 'Formes topiques' },
  { catalogType: 'pharmaceutical_unit', code: 'GEL', nameFr: 'gel', nameEn: 'gel', group: 'Formes topiques' },
  { catalogType: 'pharmaceutical_unit', code: 'LOTION', nameFr: 'lotion', nameEn: 'lotion', group: 'Formes topiques' },
  { catalogType: 'pharmaceutical_unit', code: 'PATCH', nameFr: 'patch transdermique', nameEn: 'transdermal patch', group: 'Formes topiques' },
  { catalogType: 'pharmaceutical_unit', code: 'EYE_DROPS', nameFr: 'collyre', nameEn: 'eye drops', group: 'Ophtalmiques / Otiques' },
  { catalogType: 'pharmaceutical_unit', code: 'EYE_OINTMENT', nameFr: 'pommade ophtalmique', nameEn: 'eye ointment', group: 'Ophtalmiques / Otiques' },
  { catalogType: 'pharmaceutical_unit', code: 'EYE_GEL', nameFr: 'gel ophtalmique', nameEn: 'eye gel', group: 'Ophtalmiques / Otiques' },
  { catalogType: 'pharmaceutical_unit', code: 'EAR_DROPS', nameFr: 'gouttes auriculaires', nameEn: 'ear drops', group: 'Ophtalmiques / Otiques' },
  { catalogType: 'pharmaceutical_unit', code: 'NASAL_DROPS', nameFr: 'gouttes nasales', nameEn: 'nasal drops', group: 'Ophtalmiques / Otiques' },
  { catalogType: 'pharmaceutical_unit', code: 'NASAL_SPRAY', nameFr: 'spray nasal', nameEn: 'nasal spray', group: 'Ophtalmiques / Otiques' },
  { catalogType: 'pharmaceutical_unit', code: 'INHALER', nameFr: 'inhalateur', nameEn: 'inhaler', group: 'Inhalation' },
  { catalogType: 'pharmaceutical_unit', code: 'NEBULIZER_SOLUTION', nameFr: 'solution pour nébulisation', nameEn: 'nebulizer solution', group: 'Inhalation' },
  { catalogType: 'pharmaceutical_unit', code: 'SUPPOSITORY', nameFr: 'suppositoire', nameEn: 'suppository', group: 'Rectales / Vaginales' },
  { catalogType: 'pharmaceutical_unit', code: 'VAGINAL_OVULE', nameFr: 'ovule vaginal', nameEn: 'vaginal ovule', group: 'Rectales / Vaginales' },
  { catalogType: 'pharmaceutical_unit', code: 'ENEMA', nameFr: 'lavement', nameEn: 'enema', group: 'Rectales / Vaginales' },
];

// Antigens/doses tracked by the EPV (Programme Élargi de Vaccination) registry —
// mirrors the RMA3 III.2/III.3 line items. TPIn (malaria prevention) and MILDA
// (bed nets) are deliberately excluded: they're distinct program indicators,
// not vaccine doses (see prisma/schema.prisma Section 8 scope notes).
const VACCINE_ANTIGENS: GenericCatalogSeed[] = [
  { catalogType: 'vaccine_antigen', code: 'BCG', nameFr: 'BCG', nameEn: 'BCG', group: 'BCG', order: 1 },
  { catalogType: 'vaccine_antigen', code: 'HEPB0', nameFr: 'Hépatite B (naissance)', nameEn: 'Hepatitis B (birth dose)', group: 'HepB0', order: 2 },
  { catalogType: 'vaccine_antigen', code: 'OPV0', nameFr: 'VPO0', nameEn: 'OPV0', group: 'OPV', order: 3 },
  { catalogType: 'vaccine_antigen', code: 'OPV1', nameFr: 'VPO1', nameEn: 'OPV1', group: 'OPV', order: 4 },
  { catalogType: 'vaccine_antigen', code: 'OPV2', nameFr: 'VPO2', nameEn: 'OPV2', group: 'OPV', order: 5 },
  { catalogType: 'vaccine_antigen', code: 'OPV3', nameFr: 'VPO3', nameEn: 'OPV3', group: 'OPV', order: 6 },
  { catalogType: 'vaccine_antigen', code: 'IPV1', nameFr: 'VPI 1', nameEn: 'IPV1', group: 'VPI', order: 7 },
  { catalogType: 'vaccine_antigen', code: 'IPV2', nameFr: 'VPI 2', nameEn: 'IPV2', group: 'VPI', order: 8 },
  { catalogType: 'vaccine_antigen', code: 'PENTA1', nameFr: 'Penta 1 (DTC+HepB+Hib)', nameEn: 'Penta 1', group: 'PENTA', order: 9 },
  { catalogType: 'vaccine_antigen', code: 'PENTA2', nameFr: 'Penta 2 (DTC+HepB+Hib)', nameEn: 'Penta 2', group: 'PENTA', order: 10 },
  { catalogType: 'vaccine_antigen', code: 'PENTA3', nameFr: 'Penta 3 (DTC+HepB+Hib)', nameEn: 'Penta 3', group: 'PENTA', order: 11 },
  { catalogType: 'vaccine_antigen', code: 'PCV1', nameFr: 'Pneumocoque (PCV-13) 1', nameEn: 'PCV13 dose 1', group: 'PCV', order: 12 },
  { catalogType: 'vaccine_antigen', code: 'PCV2', nameFr: 'Pneumocoque (PCV-13) 2', nameEn: 'PCV13 dose 2', group: 'PCV', order: 13 },
  { catalogType: 'vaccine_antigen', code: 'PCV3', nameFr: 'Pneumocoque (PCV-13) 3', nameEn: 'PCV13 dose 3', group: 'PCV', order: 14 },
  { catalogType: 'vaccine_antigen', code: 'ROTA1', nameFr: 'Rotavirus 1', nameEn: 'Rotavirus 1', group: 'ROTA', order: 15 },
  { catalogType: 'vaccine_antigen', code: 'ROTA2', nameFr: 'Rotavirus 2', nameEn: 'Rotavirus 2', group: 'ROTA', order: 16 },
  { catalogType: 'vaccine_antigen', code: 'ROTA3', nameFr: 'Rotavirus 3', nameEn: 'Rotavirus 3', group: 'ROTA', order: 17 },
  { catalogType: 'vaccine_antigen', code: 'RR1', nameFr: 'Rougeole-Rubéole 1ère dose', nameEn: 'Measles-Rubella dose 1', group: 'RR', order: 18 },
  { catalogType: 'vaccine_antigen', code: 'RR2', nameFr: 'Rougeole-Rubéole 2ème dose', nameEn: 'Measles-Rubella dose 2', group: 'RR', order: 19 },
  { catalogType: 'vaccine_antigen', code: 'VAA', nameFr: 'Fièvre jaune', nameEn: 'Yellow fever', group: 'VAA', order: 20 },
  { catalogType: 'vaccine_antigen', code: 'MENA', nameFr: 'Méningite A (MenA)', nameEn: 'Meningitis A', group: 'MENA', order: 21 },
  { catalogType: 'vaccine_antigen', code: 'HPV1', nameFr: 'VPH 1ère dose', nameEn: 'HPV dose 1', group: 'HPV', order: 22 },
  { catalogType: 'vaccine_antigen', code: 'HPV2', nameFr: 'VPH 2ème dose', nameEn: 'HPV dose 2', group: 'HPV', order: 23 },
  { catalogType: 'vaccine_antigen', code: 'VITA', nameFr: 'Vitamine A', nameEn: 'Vitamin A', group: 'VITA', order: 24 },
];

async function seedGenericCatalogs(prisma: PrismaClient, tenantId: string) {
  const all = [
    ...ADMISSION_TYPES,
    ...APPOINTMENT_TYPES,
    ...ROOM_TYPES,
    ...INSURANCE_TYPES,
    ...IMAGING_TYPES,
    ...ANATOMICAL_ZONES,
    ...PHARMACEUTICAL_UNITS,
    ...VACCINE_ANTIGENS,
  ];
  for (const item of all) {
    await prisma.referenceCatalogItem.upsert({
      where: { tenantId_catalogType_code: { tenantId, catalogType: item.catalogType, code: item.code } },
      update: {
        nameFr: item.nameFr,
        nameEn: item.nameEn ?? null,
        color: item.color ?? null,
        icon: item.icon ?? null,
        group: item.group ?? null,
        order: item.order ?? 0,
      },
      create: {
        tenantId,
        catalogType: item.catalogType,
        code: item.code,
        nameFr: item.nameFr,
        nameEn: item.nameEn ?? null,
        color: item.color ?? null,
        icon: item.icon ?? null,
        group: item.group ?? null,
        order: item.order ?? 0,
      },
    });
  }
  console.log(`Reference catalogs seeded (${all.length} items across 8 catalog types)`);
}

const MEDICAL_ACT_CATEGORIES = [
  { code: 'CONSULTATION_GEN', nameFr: 'Consultation générale', nameEn: 'General consultation', color: '#1565c0', order: 1 },
  { code: 'CONSULTATION_SPEC', nameFr: 'Consultations spécialisées', nameEn: 'Specialist consultations', color: '#00838f', order: 2 },
  { code: 'MINOR_SURGERY', nameFr: 'Actes de chirurgie mineure', nameEn: 'Minor surgery procedures', color: '#4527a0', order: 3 },
  { code: 'NURSING_CARE', nameFr: 'Soins infirmiers', nameEn: 'Nursing care', color: '#2e7d32', order: 4 },
  { code: 'FUNCTIONAL_EXPLORATION', nameFr: 'Explorations fonctionnelles', nameEn: 'Functional explorations', color: '#ef6c00', order: 5 },
  { code: 'MATERNITY_CARE', nameFr: "Actes de maternité", nameEn: 'Maternity procedures', color: '#ad1457', order: 6 },
];

const MEDICAL_ACTS: { code: string; categoryCode: string; nameFr: string; nameEn?: string; basePrice: number; unit?: string; defaultPecCoveragePercent?: number; allowsUrgencySurcharge?: boolean; requiresLabValidation?: boolean }[] = [
  { code: 'CONS_GEN', categoryCode: 'CONSULTATION_GEN', nameFr: 'Consultation générale', basePrice: 5000, unit: 'acte', allowsUrgencySurcharge: true },
  { code: 'CONS_GEN_URG', categoryCode: 'CONSULTATION_GEN', nameFr: "Consultation générale d'urgence", basePrice: 8000, unit: 'acte', allowsUrgencySurcharge: false },
  { code: 'CONS_SUIVI', categoryCode: 'CONSULTATION_GEN', nameFr: 'Consultation de suivi', basePrice: 3000, unit: 'acte' },
  { code: 'CONS_PEDIATRIE', categoryCode: 'CONSULTATION_SPEC', nameFr: 'Consultation pédiatrique', basePrice: 8000, unit: 'acte', allowsUrgencySurcharge: true },
  { code: 'CONS_GYNECO', categoryCode: 'CONSULTATION_SPEC', nameFr: 'Consultation gynécologique', basePrice: 10000, unit: 'acte' },
  { code: 'CONS_CARDIO', categoryCode: 'CONSULTATION_SPEC', nameFr: 'Consultation cardiologique', basePrice: 15000, unit: 'acte' },
  { code: 'CONS_CHIRURGIE', categoryCode: 'CONSULTATION_SPEC', nameFr: 'Consultation chirurgicale', basePrice: 12000, unit: 'acte' },
  { code: 'PANSEMENT_SIMPLE', categoryCode: 'MINOR_SURGERY', nameFr: 'Pansement simple', basePrice: 2000, unit: 'acte' },
  { code: 'SUTURE_PLAIE', categoryCode: 'MINOR_SURGERY', nameFr: 'Suture de plaie', basePrice: 7000, unit: 'acte', allowsUrgencySurcharge: true },
  { code: 'INCISION_ABCES', categoryCode: 'MINOR_SURGERY', nameFr: "Incision et drainage d'abcès", basePrice: 9000, unit: 'acte', allowsUrgencySurcharge: true },
  { code: 'INJECTION_IM', categoryCode: 'NURSING_CARE', nameFr: 'Injection intramusculaire', basePrice: 1000, unit: 'acte' },
  { code: 'PERFUSION', categoryCode: 'NURSING_CARE', nameFr: 'Pose de perfusion', basePrice: 2500, unit: 'acte' },
  { code: 'PRISE_CONSTANTES', categoryCode: 'NURSING_CARE', nameFr: 'Prise de constantes', basePrice: 500, unit: 'acte' },
  { code: 'ECG_ACTE', categoryCode: 'FUNCTIONAL_EXPLORATION', nameFr: 'Électrocardiogramme', basePrice: 6000, unit: 'acte', requiresLabValidation: false },
  { code: 'SPIROMETRIE', categoryCode: 'FUNCTIONAL_EXPLORATION', nameFr: 'Spirométrie', basePrice: 8000, unit: 'acte' },
  { code: 'CPN_ACTE', categoryCode: 'MATERNITY_CARE', nameFr: 'Consultation prénatale (CPN)', basePrice: 3000, unit: 'acte' },
  { code: 'ACCOUCHEMENT_VOIE_BASSE', categoryCode: 'MATERNITY_CARE', nameFr: 'Accouchement par voie basse', basePrice: 30000, unit: 'acte', requiresLabValidation: true },
  { code: 'ACCOUCHEMENT_CESARIENNE', categoryCode: 'MATERNITY_CARE', nameFr: 'Accouchement par césarienne', basePrice: 150000, unit: 'acte', requiresLabValidation: true, allowsUrgencySurcharge: true },
];

async function seedMedicalActs(prisma: PrismaClient, tenantId: string) {
  const categoryIds: Record<string, string> = {};
  for (const cat of MEDICAL_ACT_CATEGORIES) {
    const record = await prisma.medicalActCategory.upsert({
      where: { tenantId_code: { tenantId, code: cat.code } },
      update: { nameFr: cat.nameFr, nameEn: cat.nameEn ?? null, color: cat.color, order: cat.order },
      create: { tenantId, code: cat.code, nameFr: cat.nameFr, nameEn: cat.nameEn ?? null, color: cat.color, order: cat.order },
    });
    categoryIds[cat.code] = record.id;
  }

  for (const act of MEDICAL_ACTS) {
    await prisma.medicalAct.upsert({
      where: { tenantId_code: { tenantId, code: act.code } },
      update: {
        categoryId: categoryIds[act.categoryCode],
        nameFr: act.nameFr,
        nameEn: act.nameEn ?? null,
        basePrice: act.basePrice,
        unit: act.unit ?? null,
        defaultPecCoveragePercent: act.defaultPecCoveragePercent ?? 0,
        allowsUrgencySurcharge: act.allowsUrgencySurcharge ?? false,
        requiresLabValidation: act.requiresLabValidation ?? false,
      },
      create: {
        tenantId,
        categoryId: categoryIds[act.categoryCode],
        code: act.code,
        nameFr: act.nameFr,
        nameEn: act.nameEn ?? null,
        basePrice: act.basePrice,
        unit: act.unit ?? null,
        defaultPecCoveragePercent: act.defaultPecCoveragePercent ?? 0,
        allowsUrgencySurcharge: act.allowsUrgencySurcharge ?? false,
        requiresLabValidation: act.requiresLabValidation ?? false,
      },
    });
  }
  console.log(`Medical act categories (${MEDICAL_ACT_CATEGORIES.length}) and acts (${MEDICAL_ACTS.length}) seeded`);
}

// Migrated verbatim from the previously hardcoded lib/laboratory/panels.ts (LAB_PANELS)
// and lib/radiology/catalog.ts (RADIOLOGY_CATALOG) so nothing is lost when those files
// are retired in favor of DB-backed catalogs.
const LAB_EXAM_TYPES = [
  { code: 'HEMATOLOGY', nameFr: 'Hématologie', nameEn: 'Hematology', order: 1 },
  { code: 'BIOCHEMISTRY', nameFr: 'Biochimie', nameEn: 'Biochemistry', order: 2 },
  { code: 'CARDIOLOGY_BIO', nameFr: 'Marqueurs cardiaques', nameEn: 'Cardiac markers', order: 3 },
  { code: 'UROLOGY_BIO', nameFr: "Analyses d'urine", nameEn: 'Urinalysis', order: 4 },
  { code: 'SEROLOGY', nameFr: 'Sérologie', nameEn: 'Serology', order: 5 },
  { code: 'PARASITOLOGY', nameFr: 'Parasitologie', nameEn: 'Parasitology', order: 6 },
  { code: 'BACTERIOLOGY', nameFr: 'Bactériologie', nameEn: 'Bacteriology', order: 7 },
];

const LAB_EXAMS: { code: string; typeCode: string; nameFr: string; nameEn: string; parameters: { name: string; unit: string; referenceRange: string }[] }[] = [
  {
    code: 'CBC', typeCode: 'HEMATOLOGY', nameFr: 'Numération formule sanguine (NFS)', nameEn: 'Complete Blood Count (CBC)',
    parameters: [
      { name: 'WBC', unit: '10^9/L', referenceRange: '4.0-11.0' },
      { name: 'RBC', unit: '10^12/L', referenceRange: '4.2-5.9' },
      { name: 'Hemoglobin', unit: 'g/dL', referenceRange: '13.0-17.0' },
      { name: 'Hematocrit', unit: '%', referenceRange: '38-50' },
      { name: 'Platelets', unit: '10^9/L', referenceRange: '150-400' },
    ],
  },
  {
    code: 'CMP', typeCode: 'BIOCHEMISTRY', nameFr: 'Bilan métabolique complet', nameEn: 'Comprehensive Metabolic Panel (CMP)',
    parameters: [
      { name: 'Glucose', unit: 'mg/dL', referenceRange: '70-100' },
      { name: 'Sodium', unit: 'mmol/L', referenceRange: '135-145' },
      { name: 'Potassium', unit: 'mmol/L', referenceRange: '3.5-5.0' },
      { name: 'Creatinine', unit: 'mg/dL', referenceRange: '0.6-1.2' },
      { name: 'BUN', unit: 'mg/dL', referenceRange: '7-20' },
    ],
  },
  {
    code: 'LIPID', typeCode: 'BIOCHEMISTRY', nameFr: 'Bilan lipidique', nameEn: 'Lipid Panel',
    parameters: [
      { name: 'Total Cholesterol', unit: 'mg/dL', referenceRange: '< 200' },
      { name: 'LDL', unit: 'mg/dL', referenceRange: '< 100' },
      { name: 'HDL', unit: 'mg/dL', referenceRange: '> 40' },
      { name: 'Triglycerides', unit: 'mg/dL', referenceRange: '< 150' },
    ],
  },
  {
    code: 'TROP-I', typeCode: 'CARDIOLOGY_BIO', nameFr: 'Troponine I', nameEn: 'Troponin I',
    parameters: [{ name: 'Troponin I', unit: 'ng/mL', referenceRange: '< 0.04' }],
  },
  {
    code: 'UA', typeCode: 'UROLOGY_BIO', nameFr: "Analyse d'urine (ECBU)", nameEn: 'Urinalysis',
    parameters: [
      { name: 'pH', unit: '', referenceRange: '4.5-8' },
      { name: 'Protein', unit: 'mg/dL', referenceRange: 'Negative' },
      { name: 'Glucose', unit: 'mg/dL', referenceRange: 'Negative' },
      { name: 'Leukocytes', unit: '', referenceRange: 'Negative' },
    ],
  },
  {
    code: 'HIV', typeCode: 'SEROLOGY', nameFr: 'Test rapide VIH', nameEn: 'HIV Rapid Test',
    parameters: [{ name: 'HIV', unit: '', referenceRange: 'Non-reactive' }],
  },
  {
    code: 'SYPH', typeCode: 'SEROLOGY', nameFr: 'Syphilis (RPR/TPHA)', nameEn: 'Syphilis (RPR/TPHA)',
    parameters: [{ name: 'Syphilis', unit: '', referenceRange: 'Non-reactive' }],
  },
  {
    code: 'MALARIA-TDR', typeCode: 'PARASITOLOGY', nameFr: 'Paludisme (TDR)', nameEn: 'Malaria (RDT)',
    parameters: [{ name: 'Paludisme (TDR)', unit: '', referenceRange: 'Négatif' }],
  },
  {
    code: 'MALARIA-GE', typeCode: 'PARASITOLOGY', nameFr: 'Paludisme (Goutte Épaisse)', nameEn: 'Malaria (thick blood smear)',
    parameters: [{ name: 'Goutte Épaisse', unit: 'parasites/µL', referenceRange: 'Négatif' }],
  },
  {
    code: 'TB-GENEXPERT', typeCode: 'BACTERIOLOGY', nameFr: 'Tuberculose (GeneXpert MTB/RIF)', nameEn: 'TB (GeneXpert MTB/RIF)',
    parameters: [{ name: 'MTB détecté', unit: '', referenceRange: 'Non détecté' }, { name: 'Résistance Rifampicine', unit: '', referenceRange: 'Non détectée' }],
  },
  {
    code: 'TB-MICROSCOPY', typeCode: 'BACTERIOLOGY', nameFr: 'Tuberculose (Microscopie BAAR)', nameEn: 'TB (Ziehl-Neelsen microscopy)',
    parameters: [{ name: 'BAAR', unit: '', referenceRange: 'Négatif' }],
  },
];

const RADIOLOGY_EXAM_TYPES = [
  { code: 'XRAY', nameFr: 'Radiographie', nameEn: 'X-Ray', imagingCode: 'XRAY', order: 1 },
  { code: 'CT', nameFr: 'Scanner', nameEn: 'CT Scan', imagingCode: 'CT_SCAN', order: 2 },
  { code: 'MRI', nameFr: 'IRM', nameEn: 'MRI', imagingCode: 'MRI', order: 3 },
  { code: 'ULTRASOUND', nameFr: 'Échographie', nameEn: 'Ultrasound', imagingCode: 'ECHO', order: 4 },
  { code: 'MAMMOGRAPHY', nameFr: 'Mammographie', nameEn: 'Mammography', imagingCode: 'MAMMOGRAPHY', order: 5 },
];

const RADIOLOGY_EXAMS: { code: string; typeCode: string; nameFr: string; nameEn: string; zoneCode?: string; requiresContrast: boolean }[] = [
  { code: 'XR-CHEST', typeCode: 'XRAY', nameFr: 'Radiographie thoracique (2 incidences)', nameEn: 'Chest X-ray (2 views)', zoneCode: 'CHEST', requiresContrast: false },
  { code: 'XR-EXT', typeCode: 'XRAY', nameFr: 'Radiographie des extrémités', nameEn: 'Extremity X-ray', requiresContrast: false },
  { code: 'CT-HEAD', typeCode: 'CT', nameFr: 'Scanner cérébral sans injection', nameEn: 'CT Head without contrast', zoneCode: 'HEAD', requiresContrast: false },
  { code: 'CT-ABD-CONTRAST', typeCode: 'CT', nameFr: 'Scanner abdomino-pelvien avec injection', nameEn: 'CT Abdomen/Pelvis with contrast', zoneCode: 'ABDOMEN', requiresContrast: true },
  { code: 'CT-CHEST-CONTRAST', typeCode: 'CT', nameFr: 'Scanner thoracique avec injection', nameEn: 'CT Chest with contrast', zoneCode: 'CHEST', requiresContrast: true },
  { code: 'MRI-BRAIN', typeCode: 'MRI', nameFr: 'IRM cérébrale sans injection', nameEn: 'MRI Brain without contrast', zoneCode: 'HEAD', requiresContrast: false },
  { code: 'MRI-SPINE-CONTRAST', typeCode: 'MRI', nameFr: 'IRM du rachis avec gadolinium', nameEn: 'MRI Spine with gadolinium', zoneCode: 'SPINE', requiresContrast: true },
  { code: 'US-ABD', typeCode: 'ULTRASOUND', nameFr: 'Échographie abdominale', nameEn: 'Ultrasound Abdomen', zoneCode: 'ABDOMEN', requiresContrast: false },
  { code: 'US-PELVIS', typeCode: 'ULTRASOUND', nameFr: 'Échographie pelvienne', nameEn: 'Ultrasound Pelvis', zoneCode: 'PELVIS', requiresContrast: false },
  { code: 'MMG-SCREEN', typeCode: 'MAMMOGRAPHY', nameFr: 'Mammographie de dépistage', nameEn: 'Screening Mammography', zoneCode: 'BREAST', requiresContrast: false },
];

async function seedExamCatalog(prisma: PrismaClient, tenantId: string) {
  const imagingItems = await prisma.referenceCatalogItem.findMany({ where: { tenantId, catalogType: 'imaging_type' } });
  const imagingByCode = new Map(imagingItems.map((i) => [i.code, i.id]));
  const zoneItems = await prisma.referenceCatalogItem.findMany({ where: { tenantId, catalogType: 'anatomical_zone' } });
  const zoneByCode = new Map(zoneItems.map((i) => [i.code, i.id]));

  const labTypeIds: Record<string, string> = {};
  for (const type of LAB_EXAM_TYPES) {
    const record = await prisma.examCatalogType.upsert({
      where: { tenantId_domain_code: { tenantId, domain: ExamCatalogDomain.laboratory, code: type.code } },
      update: { nameFr: type.nameFr, nameEn: type.nameEn, order: type.order },
      create: { tenantId, domain: ExamCatalogDomain.laboratory, code: type.code, nameFr: type.nameFr, nameEn: type.nameEn, order: type.order },
    });
    labTypeIds[type.code] = record.id;
  }
  for (const exam of LAB_EXAMS) {
    await prisma.examCatalogEntry.upsert({
      where: { tenantId_code: { tenantId, code: exam.code } },
      update: { examTypeId: labTypeIds[exam.typeCode], nameFr: exam.nameFr, nameEn: exam.nameEn, parameters: exam.parameters as any },
      create: { tenantId, examTypeId: labTypeIds[exam.typeCode], code: exam.code, nameFr: exam.nameFr, nameEn: exam.nameEn, parameters: exam.parameters as any },
    });
  }

  const radTypeIds: Record<string, string> = {};
  for (const type of RADIOLOGY_EXAM_TYPES) {
    const record = await prisma.examCatalogType.upsert({
      where: { tenantId_domain_code: { tenantId, domain: ExamCatalogDomain.radiology, code: type.code } },
      update: { nameFr: type.nameFr, nameEn: type.nameEn, order: type.order },
      create: { tenantId, domain: ExamCatalogDomain.radiology, code: type.code, nameFr: type.nameFr, nameEn: type.nameEn, order: type.order },
    });
    radTypeIds[type.code] = record.id;
  }
  for (const exam of RADIOLOGY_EXAMS) {
    const typeSeed = RADIOLOGY_EXAM_TYPES.find((t) => t.code === exam.typeCode)!;
    await prisma.examCatalogEntry.upsert({
      where: { tenantId_code: { tenantId, code: exam.code } },
      update: {
        examTypeId: radTypeIds[exam.typeCode],
        nameFr: exam.nameFr,
        nameEn: exam.nameEn,
        imagingCatalogItemId: imagingByCode.get(typeSeed.imagingCode) ?? null,
        anatomicalZoneId: exam.zoneCode ? zoneByCode.get(exam.zoneCode) ?? null : null,
        requiresContrast: exam.requiresContrast,
      },
      create: {
        tenantId,
        examTypeId: radTypeIds[exam.typeCode],
        code: exam.code,
        nameFr: exam.nameFr,
        nameEn: exam.nameEn,
        imagingCatalogItemId: imagingByCode.get(typeSeed.imagingCode) ?? null,
        anatomicalZoneId: exam.zoneCode ? zoneByCode.get(exam.zoneCode) ?? null : null,
        requiresContrast: exam.requiresContrast,
      },
    });
  }
  console.log(`Exam catalog seeded (${LAB_EXAMS.length} lab exams, ${RADIOLOGY_EXAMS.length} radiology exams)`);
}

async function seedStorageAndSuppliers(prisma: PrismaClient, tenantId: string) {
  const locations = [
    { code: 'MAIN', name: 'Pharmacie centrale', address: 'Bâtiment principal, RDC' },
    { code: 'ER_STOCK', name: 'Stock urgences', address: "Service des urgences" },
    { code: 'COLD_CHAIN', name: 'Chaîne du froid (vaccins/insuline)', address: 'Pharmacie centrale, réfrigérateur 1' },
  ];
  for (const loc of locations) {
    await prisma.storageLocation.upsert({
      where: { tenantId_code: { tenantId, code: loc.code } },
      update: { name: loc.name, address: loc.address },
      create: { tenantId, ...loc },
    });
  }

  const suppliers = [
    { code: 'MEDCAM', name: 'MedCam Distribution', contactName: 'Service commercial', phone: '+237 233000001', email: 'contact@medcam.example' },
    { code: 'PHARMAGROS', name: 'PharmaGros Cameroun', contactName: 'Service commandes', phone: '+237 233000002', email: 'commandes@pharmagros.example' },
    { code: 'CENAME', name: "CENAME (Centrale Nationale d'Approvisionnement)", contactName: 'Antenne régionale', phone: '+237 233000003', email: 'contact@cename.example' },
  ];
  for (const sup of suppliers) {
    await prisma.supplier.upsert({
      where: { tenantId_code: { tenantId, code: sup.code } },
      update: sup,
      create: { tenantId, ...sup },
    });
  }
  console.log(`Storage locations (${locations.length}) and suppliers (${suppliers.length}) seeded`);
}

// ~500 real, standard ICD-10 (CIM-10) category codes spanning all 21 WHO chapters — the
// 3-character category level, which is the well-defined, stable part of the standard.
// This is a representative common-use working set, not the full WHO catalog (which runs
// to 14,000+ codes once every 4th/5th-character subdivision is included) — admins can add
// more manually or via the CSV importer on this page.
const ICD10_CODES: { code: string; labelFr: string; chapter: string }[] = [
  // Chapitre I — Maladies infectieuses et parasitaires (A00-B99)
  { code: 'A00', labelFr: 'Choléra', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A01', labelFr: 'Fièvres typhoïde et paratyphoïde', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A02', labelFr: 'Autres infections à Salmonella', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A03', labelFr: 'Shigellose', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A04', labelFr: 'Autres infections intestinales bactériennes', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A05', labelFr: 'Autres intoxications alimentaires bactériennes', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A06', labelFr: 'Amibiase', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A08', labelFr: 'Infections intestinales virales', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A09', labelFr: "Diarrhée et gastro-entérite d'origine infectieuse présumée", chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A15', labelFr: 'Tuberculose respiratoire, confirmée bactériologiquement', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A16', labelFr: 'Tuberculose respiratoire, non confirmée', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A17', labelFr: 'Tuberculose du système nerveux', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A18', labelFr: "Tuberculose d'autres organes", chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A19', labelFr: 'Tuberculose miliaire', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A20', labelFr: 'Peste', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A21', labelFr: 'Tularémie', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A23', labelFr: 'Brucellose', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A27', labelFr: 'Leptospirose', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A30', labelFr: 'Lèpre', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A33', labelFr: 'Tétanos néonatal', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A35', labelFr: 'Autres tétanos', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A36', labelFr: 'Diphtérie', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A37', labelFr: 'Coqueluche', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A39', labelFr: 'Infection à méningocoques', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A40', labelFr: 'Septicémie à streptocoques', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A41', labelFr: 'Autres septicémies', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A46', labelFr: 'Érysipèle', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A50', labelFr: 'Syphilis congénitale', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A54', labelFr: 'Infection gonococcique', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A56', labelFr: 'Infections chlamydiennes sexuellement transmises', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A63', labelFr: 'Autres maladies sexuellement transmises', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A69', labelFr: 'Autres infections à spirochètes', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A75', labelFr: 'Typhus exanthématique', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A82', labelFr: 'Rage', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A90', labelFr: 'Dengue', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A91', labelFr: 'Fièvre hémorragique due au virus de la dengue', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A92', labelFr: "Autres fièvres virales transmises par des arthropodes", chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A95', labelFr: 'Fièvre jaune', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A96', labelFr: 'Fièvre hémorragique à Arénavirus', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'A98', labelFr: "Autres fièvres hémorragiques virales, non classées ailleurs", chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B00', labelFr: 'Infection herpétique', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B01', labelFr: 'Varicelle', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B02', labelFr: 'Zona', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B05', labelFr: 'Rougeole', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B06', labelFr: 'Rubéole', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B15', labelFr: 'Hépatite virale A aiguë', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B16', labelFr: 'Hépatite virale B aiguë', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B17', labelFr: 'Autres hépatites virales aiguës', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B18', labelFr: 'Hépatite virale chronique', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B19', labelFr: 'Hépatite virale sans précision', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B20', labelFr: 'Maladie à VIH avec infections opportunistes', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B23', labelFr: "Maladie à VIH ayant réalisé d'autres affections", chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B24', labelFr: 'Maladie à VIH, sans précision', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B26', labelFr: 'Oreillons', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B27', labelFr: 'Mononucléose infectieuse', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B30', labelFr: 'Conjonctivite virale', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B35', labelFr: 'Dermatophytie', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B37', labelFr: 'Candidose', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B50', labelFr: 'Paludisme à Plasmodium falciparum', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B51', labelFr: 'Paludisme à Plasmodium vivax', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B52', labelFr: 'Paludisme à Plasmodium malariae', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B53', labelFr: 'Autres paludismes confirmés parasitologiquement', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B54', labelFr: 'Paludisme, sans précision', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B55', labelFr: 'Leishmaniose', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B57', labelFr: 'Maladie de Chagas', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B65', labelFr: 'Schistosomiase (bilharziose)', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B67', labelFr: 'Échinococcose', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B73', labelFr: 'Onchocercose', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B74', labelFr: 'Filariose', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B77', labelFr: 'Ascaridiase', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B80', labelFr: 'Oxyurose', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B82', labelFr: 'Parasitose intestinale, sans précision', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B86', labelFr: 'Gale', chapter: 'Maladies infectieuses et parasitaires' },
  { code: 'B99', labelFr: 'Autres maladies infectieuses', chapter: 'Maladies infectieuses et parasitaires' },
  // Chapitre II — Tumeurs (C00-D48)
  { code: 'C15', labelFr: "Tumeur maligne de l'œsophage", chapter: 'Tumeurs' },
  { code: 'C16', labelFr: "Tumeur maligne de l'estomac", chapter: 'Tumeurs' },
  { code: 'C18', labelFr: 'Tumeur maligne du côlon', chapter: 'Tumeurs' },
  { code: 'C19', labelFr: 'Tumeur maligne de la jonction recto-sigmoïdienne', chapter: 'Tumeurs' },
  { code: 'C20', labelFr: 'Tumeur maligne du rectum', chapter: 'Tumeurs' },
  { code: 'C22', labelFr: 'Tumeur maligne du foie', chapter: 'Tumeurs' },
  { code: 'C25', labelFr: 'Tumeur maligne du pancréas', chapter: 'Tumeurs' },
  { code: 'C32', labelFr: 'Tumeur maligne du larynx', chapter: 'Tumeurs' },
  { code: 'C33', labelFr: 'Tumeur maligne de la trachée', chapter: 'Tumeurs' },
  { code: 'C34', labelFr: 'Tumeur maligne des bronches et du poumon', chapter: 'Tumeurs' },
  { code: 'C43', labelFr: 'Mélanome malin de la peau', chapter: 'Tumeurs' },
  { code: 'C50', labelFr: 'Tumeur maligne du sein', chapter: 'Tumeurs' },
  { code: 'C53', labelFr: 'Tumeur maligne du col utérin', chapter: 'Tumeurs' },
  { code: 'C54', labelFr: "Tumeur maligne du corps de l'utérus", chapter: 'Tumeurs' },
  { code: 'C56', labelFr: "Tumeur maligne de l'ovaire", chapter: 'Tumeurs' },
  { code: 'C61', labelFr: 'Tumeur maligne de la prostate', chapter: 'Tumeurs' },
  { code: 'C64', labelFr: 'Tumeur maligne du rein', chapter: 'Tumeurs' },
  { code: 'C67', labelFr: 'Tumeur maligne de la vessie', chapter: 'Tumeurs' },
  { code: 'C71', labelFr: 'Tumeur maligne du cerveau', chapter: 'Tumeurs' },
  { code: 'C73', labelFr: 'Tumeur maligne de la thyroïde', chapter: 'Tumeurs' },
  { code: 'C81', labelFr: 'Maladie de Hodgkin', chapter: 'Tumeurs' },
  { code: 'C82', labelFr: 'Lymphome folliculaire', chapter: 'Tumeurs' },
  { code: 'C90', labelFr: 'Myélome multiple', chapter: 'Tumeurs' },
  { code: 'C91', labelFr: 'Leucémie lymphoïde', chapter: 'Tumeurs' },
  { code: 'C92', labelFr: 'Leucémie myéloïde', chapter: 'Tumeurs' },
  { code: 'D10', labelFr: 'Tumeur bénigne de la bouche et du pharynx', chapter: 'Tumeurs' },
  { code: 'D12', labelFr: 'Tumeur bénigne du côlon, rectum et anus', chapter: 'Tumeurs' },
  { code: 'D17', labelFr: 'Tumeur bénigne lipomateuse', chapter: 'Tumeurs' },
  { code: 'D22', labelFr: 'Naevus mélanocytaire', chapter: 'Tumeurs' },
  { code: 'D24', labelFr: 'Tumeur bénigne du sein', chapter: 'Tumeurs' },
  { code: 'D25', labelFr: "Léiomyome de l'utérus", chapter: 'Tumeurs' },
  { code: 'D35', labelFr: "Tumeur bénigne d'autres glandes endocrines", chapter: 'Tumeurs' },
  // Chapitre III — Maladies du sang (D50-D89)
  { code: 'D50', labelFr: 'Anémie par carence en fer', chapter: 'Maladies du sang et des organes hématopoïétiques' },
  { code: 'D51', labelFr: 'Anémie par carence en vitamine B12', chapter: 'Maladies du sang et des organes hématopoïétiques' },
  { code: 'D56', labelFr: 'Thalassémie', chapter: 'Maladies du sang et des organes hématopoïétiques' },
  { code: 'D57', labelFr: 'Drépanocytose', chapter: 'Maladies du sang et des organes hématopoïétiques' },
  { code: 'D64', labelFr: 'Autres anémies', chapter: 'Maladies du sang et des organes hématopoïétiques' },
  { code: 'D65', labelFr: 'Coagulation intravasculaire disséminée', chapter: 'Maladies du sang et des organes hématopoïétiques' },
  { code: 'D69', labelFr: 'Purpura et autres affections hémorragiques', chapter: 'Maladies du sang et des organes hématopoïétiques' },
  { code: 'D70', labelFr: 'Agranulocytose', chapter: 'Maladies du sang et des organes hématopoïétiques' },
  { code: 'D72', labelFr: 'Autres anomalies des globules blancs', chapter: 'Maladies du sang et des organes hématopoïétiques' },
  { code: 'D73', labelFr: 'Maladies de la rate', chapter: 'Maladies du sang et des organes hématopoïétiques' },
  { code: 'D80', labelFr: "Déficits immunitaires avec déficit prédominant d'anticorps", chapter: 'Maladies du sang et des organes hématopoïétiques' },
  { code: 'D84', labelFr: 'Autres déficits immunitaires', chapter: 'Maladies du sang et des organes hématopoïétiques' },
  // Chapitre IV — Maladies endocriniennes, nutritionnelles et métaboliques (E00-E90)
  { code: 'E03', labelFr: 'Autres hypothyroïdies', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E04', labelFr: 'Autres goitres non toxiques', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E05', labelFr: 'Thyrotoxicose (hyperthyroïdie)', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E10', labelFr: 'Diabète sucré de type 1', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E11', labelFr: 'Diabète sucré de type 2', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E13', labelFr: 'Autres diabètes sucrés précisés', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E14', labelFr: 'Diabète sucré sans précision', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E16', labelFr: "Autres troubles de la sécrétion interne du pancréas", chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E21', labelFr: 'Hyperparathyroïdie et autres affections parathyroïdiennes', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E23', labelFr: "Hypofonctionnement et autres troubles de l'hypophyse", chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E27', labelFr: 'Autres affections de la surrénale', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E34', labelFr: 'Autres affections endocriniennes', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E40', labelFr: 'Kwashiorkor', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E43', labelFr: 'Malnutrition protéino-énergétique grave, sans précision', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E44', labelFr: 'Malnutrition protéino-énergétique légère et modérée', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E46', labelFr: 'Malnutrition protéino-énergétique, sans précision', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E50', labelFr: 'Carence en vitamine A', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E51', labelFr: 'Carence en thiamine', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E56', labelFr: 'Autres carences vitaminiques', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E58', labelFr: 'Carence alimentaire en calcium', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E61', labelFr: "Carence en d'autres éléments nutritifs", chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E63', labelFr: 'Autres carences nutritionnelles', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E65', labelFr: 'Adiposité localisée', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E66', labelFr: 'Obésité', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E70', labelFr: 'Troubles du métabolisme des acides aminés aromatiques', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E73', labelFr: 'Intolérance au lactose', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E78', labelFr: 'Troubles du métabolisme des lipoprotéines', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E79', labelFr: 'Troubles du métabolisme des purines et des pyrimidines', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E83', labelFr: 'Troubles du métabolisme des minéraux', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E86', labelFr: 'Déplétion volémique', chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  { code: 'E87', labelFr: "Autres troubles de l'équilibre hydro-électrolytique", chapter: 'Maladies endocriniennes, nutritionnelles et métaboliques' },
  // Chapitre V — Troubles mentaux et du comportement (F00-F99)
  { code: 'F00', labelFr: "Démence de la maladie d'Alzheimer", chapter: 'Troubles mentaux et du comportement' },
  { code: 'F05', labelFr: 'État confusionnel non induit par l\'alcool et d\'autres substances psycho-actives', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F10', labelFr: "Troubles mentaux et du comportement liés à l'utilisation d'alcool", chapter: 'Troubles mentaux et du comportement' },
  { code: 'F17', labelFr: "Troubles mentaux et du comportement liés à l'utilisation de tabac", chapter: 'Troubles mentaux et du comportement' },
  { code: 'F20', labelFr: 'Schizophrénie', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F23', labelFr: 'Troubles psychotiques aigus et transitoires', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F25', labelFr: 'Troubles schizo-affectifs', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F29', labelFr: 'Psychose non organique, sans précision', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F31', labelFr: 'Trouble affectif bipolaire', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F32', labelFr: 'Épisodes dépressifs', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F33', labelFr: 'Trouble dépressif récurrent', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F40', labelFr: 'Troubles anxieux phobiques', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F41', labelFr: 'Autres troubles anxieux', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F42', labelFr: 'Trouble obsessionnel-compulsif', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F43', labelFr: "Réactions à un facteur de stress sévère et troubles de l'adaptation", chapter: 'Troubles mentaux et du comportement' },
  { code: 'F45', labelFr: 'Troubles somatoformes', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F50', labelFr: "Troubles de l'alimentation", chapter: 'Troubles mentaux et du comportement' },
  { code: 'F51', labelFr: "Troubles du sommeil non organiques", chapter: 'Troubles mentaux et du comportement' },
  { code: 'F60', labelFr: 'Troubles spécifiques de la personnalité', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F70', labelFr: 'Retard mental léger', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F71', labelFr: 'Retard mental moyen', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F80', labelFr: 'Troubles spécifiques du développement de la parole et du langage', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F84', labelFr: 'Troubles envahissants du développement', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F90', labelFr: 'Troubles hyperkinétiques', chapter: 'Troubles mentaux et du comportement' },
  { code: 'F98', labelFr: 'Autres troubles du comportement et troubles émotionnels', chapter: 'Troubles mentaux et du comportement' },
  // Chapitre VI — Maladies du système nerveux (G00-G99)
  { code: 'G00', labelFr: 'Méningite bactérienne, non classée ailleurs', chapter: 'Maladies du système nerveux' },
  { code: 'G03', labelFr: "Méningite due à d'autres causes et à des causes non précisées", chapter: 'Maladies du système nerveux' },
  { code: 'G04', labelFr: 'Encéphalite, myélite et encéphalomyélite', chapter: 'Maladies du système nerveux' },
  { code: 'G06', labelFr: 'Abcès et granulome intracrâniens et intrarachidiens', chapter: 'Maladies du système nerveux' },
  { code: 'G20', labelFr: 'Maladie de Parkinson', chapter: 'Maladies du système nerveux' },
  { code: 'G30', labelFr: "Maladie d'Alzheimer", chapter: 'Maladies du système nerveux' },
  { code: 'G35', labelFr: 'Sclérose en plaques', chapter: 'Maladies du système nerveux' },
  { code: 'G40', labelFr: 'Épilepsie', chapter: 'Maladies du système nerveux' },
  { code: 'G43', labelFr: 'Migraine', chapter: 'Maladies du système nerveux' },
  { code: 'G45', labelFr: 'Accidents ischémiques cérébraux transitoires', chapter: 'Maladies du système nerveux' },
  { code: 'G47', labelFr: 'Troubles du sommeil', chapter: 'Maladies du système nerveux' },
  { code: 'G50', labelFr: 'Atteintes du nerf trijumeau', chapter: 'Maladies du système nerveux' },
  { code: 'G51', labelFr: 'Atteintes du nerf facial', chapter: 'Maladies du système nerveux' },
  { code: 'G54', labelFr: 'Atteintes des racines et des plexus nerveux', chapter: 'Maladies du système nerveux' },
  { code: 'G56', labelFr: 'Mononévrites du membre supérieur', chapter: 'Maladies du système nerveux' },
  { code: 'G61', labelFr: 'Polyneuropathie inflammatoire', chapter: 'Maladies du système nerveux' },
  { code: 'G62', labelFr: 'Autres polyneuropathies', chapter: 'Maladies du système nerveux' },
  { code: 'G80', labelFr: 'Infirmité motrice cérébrale', chapter: 'Maladies du système nerveux' },
  { code: 'G81', labelFr: 'Hémiplégie', chapter: 'Maladies du système nerveux' },
  { code: 'G83', labelFr: 'Autres syndromes paralytiques', chapter: 'Maladies du système nerveux' },
  { code: 'G91', labelFr: 'Hydrocéphalie', chapter: 'Maladies du système nerveux' },
  { code: 'G93', labelFr: 'Autres affections cérébrales', chapter: 'Maladies du système nerveux' },
  // Chapitre VII — Maladies de l'œil (H00-H59)
  { code: 'H00', labelFr: 'Orgelet et chalazion', chapter: "Maladies de l'œil et de ses annexes" },
  { code: 'H10', labelFr: 'Conjonctivite', chapter: "Maladies de l'œil et de ses annexes" },
  { code: 'H11', labelFr: 'Autres affections de la conjonctive', chapter: "Maladies de l'œil et de ses annexes" },
  { code: 'H16', labelFr: 'Kératite', chapter: "Maladies de l'œil et de ses annexes" },
  { code: 'H20', labelFr: 'Iridocyclite', chapter: "Maladies de l'œil et de ses annexes" },
  { code: 'H25', labelFr: 'Cataracte sénile', chapter: "Maladies de l'œil et de ses annexes" },
  { code: 'H26', labelFr: 'Autres cataractes', chapter: "Maladies de l'œil et de ses annexes" },
  { code: 'H35', labelFr: 'Autres affections de la rétine', chapter: "Maladies de l'œil et de ses annexes" },
  { code: 'H40', labelFr: 'Glaucome', chapter: "Maladies de l'œil et de ses annexes" },
  { code: 'H52', labelFr: "Troubles de la réfraction et de l'accommodation", chapter: "Maladies de l'œil et de ses annexes" },
  { code: 'H53', labelFr: 'Troubles de la vision', chapter: "Maladies de l'œil et de ses annexes" },
  { code: 'H54', labelFr: 'Cécité et vision basse', chapter: "Maladies de l'œil et de ses annexes" },
  // Chapitre VIII — Maladies de l'oreille (H60-H95)
  { code: 'H60', labelFr: "Otite externe", chapter: "Maladies de l'oreille et de l'apophyse mastoïde" },
  { code: 'H65', labelFr: 'Otite moyenne non suppurée', chapter: "Maladies de l'oreille et de l'apophyse mastoïde" },
  { code: 'H66', labelFr: 'Otite moyenne suppurée', chapter: "Maladies de l'oreille et de l'apophyse mastoïde" },
  { code: 'H72', labelFr: 'Perforation du tympan', chapter: "Maladies de l'oreille et de l'apophyse mastoïde" },
  { code: 'H81', labelFr: 'Troubles de la fonction vestibulaire', chapter: "Maladies de l'oreille et de l'apophyse mastoïde" },
  { code: 'H90', labelFr: 'Surdité de transmission et surdité neurosensorielle', chapter: "Maladies de l'oreille et de l'apophyse mastoïde" },
  { code: 'H93', labelFr: "Autres affections de l'oreille", chapter: "Maladies de l'oreille et de l'apophyse mastoïde" },
  // Chapitre IX — Maladies de l'appareil circulatoire (I00-I99)
  { code: 'I05', labelFr: 'Maladies rhumatismales de la valve mitrale', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I10', labelFr: 'Hypertension essentielle (primitive)', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I11', labelFr: 'Cardiopathie hypertensive', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I12', labelFr: 'Néphropathie hypertensive', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I13', labelFr: 'Cardiopathie et néphropathie hypertensives', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I20', labelFr: 'Angine de poitrine', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I21', labelFr: 'Infarctus aigu du myocarde', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I25', labelFr: 'Cardiopathie ischémique chronique', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I26', labelFr: 'Embolie pulmonaire', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I27', labelFr: 'Autres maladies cardio-pulmonaires', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I34', labelFr: 'Affections non rhumatismales de la valve mitrale', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I42', labelFr: 'Cardiomyopathie', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I44', labelFr: 'Bloc auriculo-ventriculaire et bloc de branche gauche', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I47', labelFr: 'Tachycardie paroxystique', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I48', labelFr: 'Fibrillation et flutter auriculaires', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I50', labelFr: 'Insuffisance cardiaque', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I60', labelFr: 'Hémorragie sous-arachnoïdienne', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I61', labelFr: 'Hémorragie intracérébrale', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I63', labelFr: 'Infarctus cérébral', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I64', labelFr: "Accident vasculaire cérébral, non précisé comme hémorragique ou par infarctus", chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I67', labelFr: 'Autres maladies cérébrovasculaires', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I70', labelFr: 'Athérosclérose', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I73', labelFr: 'Autres maladies vasculaires périphériques', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I80', labelFr: 'Phlébite et thrombophlébite', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I83', labelFr: 'Varices des membres inférieurs', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I84', labelFr: 'Hémorroïdes', chapter: "Maladies de l'appareil circulatoire" },
  { code: 'I95', labelFr: 'Hypotension', chapter: "Maladies de l'appareil circulatoire" },
  // Chapitre X — Maladies de l'appareil respiratoire (J00-J99)
  { code: 'J00', labelFr: 'Rhinopharyngite aiguë (rhume banal)', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J01', labelFr: 'Sinusite aiguë', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J02', labelFr: 'Pharyngite aiguë', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J03', labelFr: 'Amygdalite aiguë', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J06', labelFr: "Infections aiguës des voies respiratoires supérieures", chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J09', labelFr: 'Grippe due à un virus grippal identifié', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J11', labelFr: 'Grippe, virus non identifié', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J12', labelFr: 'Pneumopathie virale', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J13', labelFr: 'Pneumopathie à Streptococcus pneumoniae', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J15', labelFr: 'Pneumopathie bactérienne', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J18', labelFr: 'Pneumopathie, micro-organisme non précisé', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J20', labelFr: 'Bronchite aiguë', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J21', labelFr: 'Bronchiolite aiguë', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J22', labelFr: 'Infection aiguë non précisée des voies respiratoires inférieures', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J30', labelFr: 'Rhinite allergique et vasomotrice', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J32', labelFr: 'Sinusite chronique', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J35', labelFr: 'Maladies chroniques des amygdales et des végétations adénoïdes', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J40', labelFr: 'Bronchite, non précisée comme aiguë ou chronique', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J44', labelFr: "Autre maladie pulmonaire obstructive chronique", chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J45', labelFr: 'Asthme', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J46', labelFr: 'État de mal asthmatique', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J47', labelFr: 'Bronchectasie', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J60', labelFr: "Pneumoconiose des mineurs de charbon", chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J69', labelFr: "Pneumopathie due à des solides et liquides", chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J80', labelFr: 'Syndrome de détresse respiratoire aiguë', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J81', labelFr: 'Œdème pulmonaire', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J84', labelFr: 'Autres pneumopathies interstitielles', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J90', labelFr: 'Épanchement pleural, non classé ailleurs', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J93', labelFr: 'Pneumothorax', chapter: "Maladies de l'appareil respiratoire" },
  { code: 'J96', labelFr: 'Insuffisance respiratoire, non classée ailleurs', chapter: "Maladies de l'appareil respiratoire" },
  // Chapitre XI — Maladies de l'appareil digestif (K00-K93)
  { code: 'K02', labelFr: 'Carie dentaire', chapter: "Maladies de l'appareil digestif" },
  { code: 'K04', labelFr: 'Maladies de la pulpe et des tissus périapicaux', chapter: "Maladies de l'appareil digestif" },
  { code: 'K05', labelFr: 'Gingivite et maladies parodontales', chapter: "Maladies de l'appareil digestif" },
  { code: 'K12', labelFr: 'Stomatite et lésions apparentées', chapter: "Maladies de l'appareil digestif" },
  { code: 'K20', labelFr: 'Œsophagite', chapter: "Maladies de l'appareil digestif" },
  { code: 'K21', labelFr: 'Reflux gastro-œsophagien', chapter: "Maladies de l'appareil digestif" },
  { code: 'K25', labelFr: "Ulcère de l'estomac", chapter: "Maladies de l'appareil digestif" },
  { code: 'K26', labelFr: 'Ulcère duodénal', chapter: "Maladies de l'appareil digestif" },
  { code: 'K29', labelFr: 'Gastrite et duodénite', chapter: "Maladies de l'appareil digestif" },
  { code: 'K30', labelFr: 'Dyspepsie', chapter: "Maladies de l'appareil digestif" },
  { code: 'K35', labelFr: 'Appendicite aiguë', chapter: "Maladies de l'appareil digestif" },
  { code: 'K40', labelFr: 'Hernie inguinale', chapter: "Maladies de l'appareil digestif" },
  { code: 'K42', labelFr: 'Hernie ombilicale', chapter: "Maladies de l'appareil digestif" },
  { code: 'K44', labelFr: 'Hernie diaphragmatique', chapter: "Maladies de l'appareil digestif" },
  { code: 'K50', labelFr: 'Maladie de Crohn', chapter: "Maladies de l'appareil digestif" },
  { code: 'K51', labelFr: 'Rectocolite hémorragique', chapter: "Maladies de l'appareil digestif" },
  { code: 'K52', labelFr: 'Autres gastro-entérites et colites non infectieuses', chapter: "Maladies de l'appareil digestif" },
  { code: 'K56', labelFr: 'Occlusion intestinale sans hernie', chapter: "Maladies de l'appareil digestif" },
  { code: 'K57', labelFr: 'Diverticulose intestinale', chapter: "Maladies de l'appareil digestif" },
  { code: 'K59', labelFr: "Autres troubles fonctionnels de l'intestin", chapter: "Maladies de l'appareil digestif" },
  { code: 'K60', labelFr: 'Fissure et fistule anale et rectale', chapter: "Maladies de l'appareil digestif" },
  { code: 'K63', labelFr: 'Autres maladies intestinales', chapter: "Maladies de l'appareil digestif" },
  { code: 'K70', labelFr: 'Maladie alcoolique du foie', chapter: "Maladies de l'appareil digestif" },
  { code: 'K74', labelFr: 'Fibrose et cirrhose du foie', chapter: "Maladies de l'appareil digestif" },
  { code: 'K76', labelFr: 'Autres maladies du foie', chapter: "Maladies de l'appareil digestif" },
  { code: 'K80', labelFr: 'Lithiase biliaire', chapter: "Maladies de l'appareil digestif" },
  { code: 'K81', labelFr: 'Cholécystite', chapter: "Maladies de l'appareil digestif" },
  { code: 'K85', labelFr: 'Pancréatite aiguë', chapter: "Maladies de l'appareil digestif" },
  { code: 'K86', labelFr: 'Autres maladies du pancréas', chapter: "Maladies de l'appareil digestif" },
  { code: 'K92', labelFr: "Autres maladies de l'appareil digestif", chapter: "Maladies de l'appareil digestif" },
  // Chapitre XII — Maladies de la peau (L00-L99)
  { code: 'L01', labelFr: 'Impétigo', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L02', labelFr: 'Abcès cutané, furoncle et anthrax', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L03', labelFr: 'Cellulite', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L20', labelFr: 'Dermatite atopique', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L21', labelFr: 'Dermite séborrhéique', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L23', labelFr: 'Dermite allergique de contact', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L30', labelFr: 'Autres dermites', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L40', labelFr: 'Psoriasis', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L50', labelFr: 'Urticaire', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L57', labelFr: "Affections de la peau dues à l'exposition chronique aux rayonnements non ionisants", chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L60', labelFr: 'Maladies des ongles', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L70', labelFr: 'Acné', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L72', labelFr: 'Kystes folliculaires de la peau', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L80', labelFr: 'Vitiligo', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L89', labelFr: 'Ulcère de décubitus', chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  { code: 'L98', labelFr: "Autres affections de la peau et du tissu cellulaire sous-cutané", chapter: 'Maladies de la peau et du tissu cellulaire sous-cutané' },
  // Chapitre XIII — Maladies du système ostéo-articulaire (M00-M99)
  { code: 'M00', labelFr: 'Arthrite pyogène', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M05', labelFr: 'Polyarthrite rhumatoïde séropositive', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M06', labelFr: 'Autres polyarthrites rhumatoïdes', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M15', labelFr: 'Polyarthrose', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M16', labelFr: 'Coxarthrose', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M17', labelFr: 'Gonarthrose', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M19', labelFr: 'Autres arthroses', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M25', labelFr: 'Autres atteintes articulaires', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M30', labelFr: 'Périartérite noueuse et affections apparentées', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M32', labelFr: 'Lupus érythémateux disséminé', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M45', labelFr: 'Spondylarthrite ankylosante', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M47', labelFr: 'Spondylose', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M51', labelFr: "Autres affections des disques intervertébraux", chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M54', labelFr: 'Dorsalgie', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M60', labelFr: 'Myosite', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M62', labelFr: 'Autres affections musculaires', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M75', labelFr: "Lésions de l'épaule", chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M79', labelFr: 'Autres affections des tissus mous', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M80', labelFr: 'Ostéoporose avec fracture pathologique', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M81', labelFr: 'Ostéoporose sans fracture pathologique', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M84', labelFr: "Anomalies de la continuité de l'os", chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  { code: 'M86', labelFr: 'Ostéomyélite', chapter: 'Maladies du système ostéo-articulaire, des muscles et du tissu conjonctif' },
  // Chapitre XIV — Maladies de l'appareil génito-urinaire (N00-N99)
  { code: 'N00', labelFr: 'Syndrome néphritique aigu', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N03', labelFr: 'Syndrome néphritique chronique', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N04', labelFr: 'Syndrome néphrotique', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N10', labelFr: 'Néphrite tubulo-interstitielle aiguë', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N17', labelFr: 'Insuffisance rénale aiguë', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N18', labelFr: 'Maladie rénale chronique', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N20', labelFr: 'Calcul du rein et de l\'uretère', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N30', labelFr: 'Cystite', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N34', labelFr: 'Urétrite et syndrome urétral', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N39', labelFr: 'Autres affections des voies urinaires', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N40', labelFr: 'Hyperplasie de la prostate', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N41', labelFr: 'Maladies inflammatoires de la prostate', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N43', labelFr: 'Hydrocèle et spermatocèle', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N45', labelFr: 'Orchite et épididymite', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N60', labelFr: 'Dysplasie mammaire bénigne', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N70', labelFr: 'Salpingite et ovarite', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N76', labelFr: 'Autres affections inflammatoires du vagin et de la vulve', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N80', labelFr: 'Endométriose', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N81', labelFr: 'Prolapsus génital féminin', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N83', labelFr: "Affections non inflammatoires de l'ovaire", chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N91', labelFr: 'Règles absentes, peu abondantes ou rares', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N92', labelFr: 'Règles abondantes, fréquentes et irrégulières', chapter: "Maladies de l'appareil génito-urinaire" },
  { code: 'N95', labelFr: 'Troubles de la ménopause', chapter: "Maladies de l'appareil génito-urinaire" },
  // Chapitre XV — Grossesse, accouchement et puerpéralité (O00-O99)
  { code: 'O00', labelFr: 'Grossesse extra-utérine', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O03', labelFr: 'Avortement spontané', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O10', labelFr: "Hypertension préexistante compliquant la grossesse", chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O11', labelFr: "Hypertension préexistante avec protéinurie surajoutée", chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O13', labelFr: 'Hypertension gestationnelle sans protéinurie significative', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O14', labelFr: 'Pré-éclampsie', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O15', labelFr: 'Éclampsie', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O16', labelFr: 'Hypertension maternelle, sans précision', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O20', labelFr: 'Hémorragie précoce de la grossesse', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O23', labelFr: 'Infection des voies génito-urinaires au cours de la grossesse', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O24', labelFr: 'Diabète sucré au cours de la grossesse', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O26', labelFr: "Soins maternels pour d'autres affections liées à la grossesse", chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O30', labelFr: 'Grossesse multiple', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O32', labelFr: 'Soins maternels pour présentation anormale connue ou présumée du fœtus', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O36', labelFr: 'Soins maternels pour autres problèmes fœtaux connus ou présumés', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O42', labelFr: 'Rupture prématurée des membranes', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O44', labelFr: 'Placenta praevia', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O45', labelFr: 'Décollement prématuré du placenta', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O46', labelFr: 'Hémorragie ante-partum, non classée ailleurs', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O60', labelFr: 'Travail prématuré', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O62', labelFr: 'Anomalies de la contraction utérine', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O64', labelFr: 'Dystocie par malposition ou présentation anormale du fœtus', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O70', labelFr: 'Déchirure obstétricale du périnée', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O71', labelFr: 'Autres traumatismes obstétricaux', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O72', labelFr: 'Hémorragie du post-partum', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O75', labelFr: "Autres complications du travail et de l'accouchement", chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O80', labelFr: 'Accouchement spontané', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O82', labelFr: 'Accouchement par césarienne', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O85', labelFr: 'Infection puerpérale', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O86', labelFr: "Autres infections des voies génito-urinaires consécutives à l'accouchement", chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O90', labelFr: 'Complications de la puerpéralité, non classées ailleurs', chapter: 'Grossesse, accouchement et puerpéralité' },
  { code: 'O99', labelFr: "Autres maladies maternelles classées ailleurs, compliquant la grossesse", chapter: 'Grossesse, accouchement et puerpéralité' },
  // Chapitre XVI — Affections périnatales (P00-P96)
  { code: 'P05', labelFr: 'Retard de croissance fœtale et malnutrition fœtale', chapter: 'Certaines affections dont l\'origine se situe dans la période périnatale' },
  { code: 'P07', labelFr: "Troubles liés à une durée de gestation courte et à un faible poids de naissance", chapter: 'Certaines affections dont l\'origine se situe dans la période périnatale' },
  { code: 'P08', labelFr: "Troubles liés à une durée de gestation longue et à un poids de naissance élevé", chapter: 'Certaines affections dont l\'origine se situe dans la période périnatale' },
  { code: 'P20', labelFr: 'Hypoxie intra-utérine', chapter: 'Certaines affections dont l\'origine se situe dans la période périnatale' },
  { code: 'P21', labelFr: 'Asphyxie à la naissance', chapter: 'Certaines affections dont l\'origine se situe dans la période périnatale' },
  { code: 'P22', labelFr: 'Détresse respiratoire du nouveau-né', chapter: 'Certaines affections dont l\'origine se situe dans la période périnatale' },
  { code: 'P23', labelFr: 'Pneumopathie congénitale', chapter: 'Certaines affections dont l\'origine se situe dans la période périnatale' },
  { code: 'P36', labelFr: 'Septicémie bactérienne du nouveau-né', chapter: 'Certaines affections dont l\'origine se situe dans la période périnatale' },
  { code: 'P37', labelFr: "Autres maladies infectieuses et parasitaires congénitales", chapter: 'Certaines affections dont l\'origine se situe dans la période périnatale' },
  { code: 'P59', labelFr: "Ictère néonatal dû à d'autres causes et à des causes non précisées", chapter: 'Certaines affections dont l\'origine se situe dans la période périnatale' },
  { code: 'P70', labelFr: "Troubles transitoires du métabolisme des glucides propres au fœtus et au nouveau-né", chapter: 'Certaines affections dont l\'origine se situe dans la période périnatale' },
  { code: 'P91', labelFr: 'Autres troubles de la fonction cérébrale du nouveau-né', chapter: 'Certaines affections dont l\'origine se situe dans la période périnatale' },
  // Chapitre XVII — Malformations congénitales (Q00-Q99)
  { code: 'Q00', labelFr: 'Anencéphalie et malformations similaires', chapter: 'Malformations congénitales, déformations et anomalies chromosomiques' },
  { code: 'Q05', labelFr: 'Spina bifida', chapter: 'Malformations congénitales, déformations et anomalies chromosomiques' },
  { code: 'Q20', labelFr: "Malformations congénitales des chambres et communications cardiaques", chapter: 'Malformations congénitales, déformations et anomalies chromosomiques' },
  { code: 'Q21', labelFr: 'Malformations congénitales des cloisons cardiaques', chapter: 'Malformations congénitales, déformations et anomalies chromosomiques' },
  { code: 'Q35', labelFr: 'Fente palatine', chapter: 'Malformations congénitales, déformations et anomalies chromosomiques' },
  { code: 'Q36', labelFr: 'Fente labiale', chapter: 'Malformations congénitales, déformations et anomalies chromosomiques' },
  { code: 'Q65', labelFr: 'Malformations congénitales de la hanche', chapter: 'Malformations congénitales, déformations et anomalies chromosomiques' },
  { code: 'Q66', labelFr: 'Déformations congénitales du pied', chapter: 'Malformations congénitales, déformations et anomalies chromosomiques' },
  { code: 'Q90', labelFr: 'Syndrome de Down (trisomie 21)', chapter: 'Malformations congénitales, déformations et anomalies chromosomiques' },
  // Chapitre XVIII — Symptômes et signes (R00-R99)
  { code: 'R05', labelFr: 'Toux', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R06', labelFr: 'Anomalies de la respiration', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R07', labelFr: 'Douleur pharyngée et thoracique', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R10', labelFr: 'Douleur abdominale et pelvienne', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R11', labelFr: 'Nausées et vomissements', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R17', labelFr: 'Ictère, sans précision', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R18', labelFr: 'Ascite', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R19', labelFr: "Autres symptômes et signes relatifs à l'appareil digestif et à l'abdomen", chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R25', labelFr: 'Mouvements anormaux involontaires', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R26', labelFr: 'Anomalies de la démarche et de la motilité', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R31', labelFr: 'Hématurie, sans précision', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R42', labelFr: 'Étourdissement et vertige', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R50', labelFr: 'Fièvre, sans précision', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R51', labelFr: 'Céphalée', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R53', labelFr: 'Malaise et fatigue', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R55', labelFr: 'Syncope et collapsus', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R56', labelFr: 'Convulsions, non classées ailleurs', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R57', labelFr: 'Choc, non classé ailleurs', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R58', labelFr: 'Hémorragie, non classée ailleurs', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R60', labelFr: 'Œdème, non classé ailleurs', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  { code: 'R73', labelFr: 'Glycémie élevée', chapter: "Symptômes, signes et résultats anormaux d'examens cliniques" },
  // Chapitre XIX — Traumatismes, empoisonnements (S00-T98)
  { code: 'S02', labelFr: 'Fracture du crâne et des os de la face', chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'S06', labelFr: 'Traumatisme intracrânien', chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'S12', labelFr: 'Fracture du rachis cervical', chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'S22', labelFr: 'Fracture de côte, du sternum et du rachis thoracique', chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'S32', labelFr: 'Fracture du rachis lombaire et du bassin', chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'S42', labelFr: "Fracture de l'épaule et du bras", chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'S52', labelFr: "Fracture de l'avant-bras", chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'S62', labelFr: "Fracture au niveau du poignet et de la main", chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'S72', labelFr: 'Fracture du fémur', chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'S82', labelFr: 'Fracture de la jambe, y compris la cheville', chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'S92', labelFr: 'Fracture du pied, à l\'exception de la cheville', chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'T14', labelFr: 'Traumatisme, siège non précisé', chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'T20', labelFr: 'Brûlure de la tête et du cou', chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'T30', labelFr: 'Brûlure, siège non précisé', chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'T78', labelFr: "Effets indésirables, non classés ailleurs", chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  { code: 'T81', labelFr: "Complications de soins, non classées ailleurs", chapter: 'Lésions traumatiques, empoisonnements et certaines autres conséquences de causes externes' },
  // Chapitre XX — Causes externes (V01-Y98) — représentatif
  { code: 'V89', labelFr: 'Accident de véhicule à moteur ou sans moteur', chapter: 'Causes externes de morbidité et de mortalité' },
  { code: 'W19', labelFr: 'Chute, sans précision', chapter: 'Causes externes de morbidité et de mortalité' },
  { code: 'X59', labelFr: 'Exposition à des facteurs non précisés', chapter: 'Causes externes de morbidité et de mortalité' },
  { code: 'Y10', labelFr: 'Empoisonnement, intention non déterminée', chapter: 'Causes externes de morbidité et de mortalité' },
  // Chapitre XXI — Facteurs influant sur l'état de santé (Z00-Z99)
  { code: 'Z00', labelFr: 'Examen général et consultation de personnes sans plainte', chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z01', labelFr: "Autres examens et mises en observation spéciaux ne se rapportant pas à une plainte", chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z03', labelFr: 'Mise en observation et évaluation médicale pour maladies et affections suspectées', chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z20', labelFr: 'Sujet en contact avec un malade atteint de maladie transmissible', chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z23', labelFr: 'Nécessité de vaccination contre une seule maladie bactérienne', chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z30', labelFr: 'Prise en charge de la contraception', chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z33', labelFr: 'État de grossesse, incident', chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z34', labelFr: "Surveillance d'une grossesse normale", chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z38', labelFr: "Enfants nés vivants selon le lieu de naissance", chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z39', labelFr: "Examen et soins postnatals", chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z51', labelFr: 'Autres soins médicaux', chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z71', labelFr: "Personnes en contact avec les services de santé pour d'autres consultations et avis médicaux", chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z76', labelFr: "Personnes en contact avec les services de santé dans d'autres circonstances", chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z86', labelFr: 'Antécédents personnels de certaines autres maladies', chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z87', labelFr: "Antécédents personnels d'autres affections", chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
  { code: 'Z88', labelFr: "Antécédents personnels d'allergie à des médicaments", chapter: "Facteurs influant sur l'état de santé et motifs de recours aux services de santé" },
];

async function seedIcd10(prisma: PrismaClient, tenantId: string) {
  for (const entry of ICD10_CODES) {
    await prisma.icd10Code.upsert({
      where: { tenantId_code: { tenantId, code: entry.code } },
      update: { labelFr: entry.labelFr, chapter: entry.chapter },
      create: { tenantId, code: entry.code, labelFr: entry.labelFr, chapter: entry.chapter },
    });
  }
  console.log(`ICD-10 codes seeded (${ICD10_CODES.length} entries)`);
}

export async function seedReferenceData(prisma: PrismaClient, tenantId: string) {
  await seedGenericCatalogs(prisma, tenantId);
  await seedMedicalActs(prisma, tenantId);
  await seedExamCatalog(prisma, tenantId);
  await seedStorageAndSuppliers(prisma, tenantId);
  await seedIcd10(prisma, tenantId);
  console.log('All reference data seeded successfully');
}
