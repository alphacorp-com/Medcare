import 'dotenv/config';
import {
  TenantType,
  TenantStatus,
  TenantUserRole,
  DepartmentType,
  PlanTier,
  BillingCycle,
  ModuleCategory,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';

async function main() {
  console.log('Seeding database...');

  // Create or find default tenant
  let tenant = await prisma.tenant.findFirst({
    where: { dbSchema: 'public' },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug: 'centre-de-sante',
        name: 'Hopital central de Foumbot',
        type: TenantType.hospital,
        status: TenantStatus.active,
        dbSchema: 'public',
        countryCode: 'CM',
        contactEmail: 'admin@medcare.com',
        contactPhone: '+237 600000000',
        address: '1 Avenue de l\'Hôpital, foumbot, Cameroun',
        metadata: {
          website: 'https://foumbot-hospital.com',
          taxId: '1000000100'
        }
      },
    });
  }

  console.log('Tenant ensured:', tenant.name);

  // Seed plans (monthly and yearly)
  const plans = [
    {
      name: 'MedCare Monthly',
      tier: PlanTier.core,
      billingCycle: BillingCycle.monthly,
      basePrice: 150000,
      currency: 'XAF',
      sortOrder: 1,
      maxUsers: 50,
      maxBeds: 100,
      maxStorageGb: 200,
      features: {
        support: 'standard',
        billing: true,
        analytics: false,
      },
    },
    {
      name: 'MedCare Yearly',
      tier: PlanTier.core,
      billingCycle: BillingCycle.annual,
      basePrice: 1600000,
      currency: 'XAF',
      sortOrder: 2,
      maxUsers: 50,
      maxBeds: 100,
      maxStorageGb: 200,
      features: {
        support: 'priority',
        billing: true,
        analytics: true,
      },
    },
  ];

  for (const plan of plans) {
    const existingPlan = await prisma.plan.findFirst({
      where: { name: plan.name, billingCycle: plan.billingCycle },
      select: { id: true },
    });

    if (existingPlan) {
      await prisma.plan.update({
        where: { id: existingPlan.id },
        data: {
          tier: plan.tier,
          basePrice: plan.basePrice,
          currency: plan.currency,
          sortOrder: plan.sortOrder,
          maxUsers: plan.maxUsers,
          maxBeds: plan.maxBeds,
          maxStorageGb: plan.maxStorageGb,
          features: plan.features,
          isActive: true,
          isPublic: true,
        },
      });
    } else {
      await prisma.plan.create({
        data: {
          ...plan,
          isActive: true,
          isPublic: true,
        },
      });
    }
  }
  console.log('Plans ensured (monthly/yearly)');

  const moduleDefinitions: Array<{
    code: string;
    name: string;
    category: ModuleCategory;
    tier: PlanTier;
    description: string;
    isPublished: boolean;
  }> = [
    {
      code: 'MODULE_CORE_PATIENT',
      name: 'Patient Management',
      category: 'clinical',
      tier: 'core',
      description: 'Manage patient records, appointments, and clinical workflows.',
      isPublished: true,
    },
    {
      code: 'MODULE_ADMISSION',
      name: 'Admissions',
      category: 'clinical',
      tier: 'core',
      description: 'Track admissions, bed assignments and patient flow.',
      isPublished: true,
    },
    {
      code: 'MODULE_PHARMACY',
      name: 'Pharmacy',
      category: 'clinical',
      tier: 'core',
      description: 'Manage medication dispensing, prescriptions and stock.',
      isPublished: true,
    },
    {
      code: 'MODULE_LAB',
      name: 'Laboratory',
      category: 'clinical',
      tier: 'core',
      description: 'Manage lab requests, results and test tracking.',
      isPublished: true,
    },
    {
      code: 'MODULE_SURGERY',
      name: 'Surgery',
      category: 'clinical',
      tier: 'core',
      description: 'Coordinate surgical scheduling and operative workflows.',
      isPublished: true,
    },
    {
      code: 'MODULE_RADIOLOGY',
      name: 'Radiology',
      category: 'clinical',
      tier: 'core',
      description: 'Manage imaging orders, reports and radiology workflows.',
      isPublished: true,
    },
    {
      code: 'MODULE_BILLING',
      name: 'Billing',
      category: 'finance',
      tier: 'core',
      description: 'Handle invoicing, payments and billing records.',
      isPublished: true,
    },
    {
      code: 'MODULE_PLANNING',
      name: 'Planning',
      category: 'admin',
      tier: 'core',
      description: 'Manage facility planning, staffing and resource allocation.',
      isPublished: true,
    },
    {
      code: 'MODULE_MATERNITY',
      name: 'Maternity',
      category: 'clinical',
      tier: 'core',
      description: 'Track pregnancies, antenatal visits, delivery/partograph and newborn records.',
      isPublished: true,
    },
  ];

  const seededModules: Record<string, { id: string }> = {};
  for (const moduleDefinition of moduleDefinitions) {
    const moduleRecord = await prisma.module.upsert({
      where: { code: moduleDefinition.code },
      update: {
        name: moduleDefinition.name,
        category: moduleDefinition.category as any,
        tier: moduleDefinition.tier as any,
        description: moduleDefinition.description,
        isPublished: moduleDefinition.isPublished,
      },
      create: {
        ...moduleDefinition,
      },
    });
    seededModules[moduleRecord.code] = { id: moduleRecord.id };
  }
  console.log('Modules ensured');

  const monthlyPlan = await prisma.plan.findFirst({
    where: { name: 'MedCare Monthly', billingCycle: BillingCycle.monthly },
    select: { id: true },
  });
  const annualPlan = await prisma.plan.findFirst({
    where: { name: 'MedCare Yearly', billingCycle: BillingCycle.annual },
    select: { id: true },
  });

  if (!monthlyPlan || !annualPlan) {
    throw new Error('Expected subscription plans were not seeded before plan module associations');
  }

  const planAssignments = [
    { planId: monthlyPlan.id, moduleCode: 'MODULE_CORE_PATIENT' },
    { planId: monthlyPlan.id, moduleCode: 'MODULE_ADMISSION' },
    { planId: monthlyPlan.id, moduleCode: 'MODULE_PHARMACY' },
    { planId: monthlyPlan.id, moduleCode: 'MODULE_LAB' },
    { planId: monthlyPlan.id, moduleCode: 'MODULE_BILLING' },
    { planId: annualPlan.id, moduleCode: 'MODULE_CORE_PATIENT' },
    { planId: annualPlan.id, moduleCode: 'MODULE_ADMISSION' },
    { planId: annualPlan.id, moduleCode: 'MODULE_PHARMACY' },
    { planId: annualPlan.id, moduleCode: 'MODULE_LAB' },
    { planId: annualPlan.id, moduleCode: 'MODULE_SURGERY' },
    { planId: annualPlan.id, moduleCode: 'MODULE_RADIOLOGY' },
    { planId: annualPlan.id, moduleCode: 'MODULE_BILLING' },
    { planId: annualPlan.id, moduleCode: 'MODULE_PLANNING' },
    { planId: annualPlan.id, moduleCode: 'MODULE_MATERNITY' },
  ];

  for (const assignment of planAssignments) {
    const moduleEntry = seededModules[assignment.moduleCode];
    if (!moduleEntry) continue;

    await prisma.planModule.upsert({
      where: {
        planId_moduleId: {
          planId: assignment.planId,
          moduleId: moduleEntry.id,
        },
      },
      update: {
        isIncluded: true,
      },
      create: {
        planId: assignment.planId,
        moduleId: moduleEntry.id,
        isIncluded: true,
      },
    });
  }
  console.log('Plan module associations ensured');

  // Seed Admin User
  const adminPassword = 'admin123';
  const adminHashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.adminUser.upsert({
    where: { email: 'admin@medcare.com' },
    update: {
      fullName: 'MedCare Administrator',
      role: 'superadmin' as any,
      passwordHash: adminHashedPassword,
      isActive: true,
    },
    create: {
      email: 'admin@medcare.com',
      fullName: 'MedCare Administrator',
      role: 'superadmin' as any,
      passwordHash: adminHashedPassword,
      isActive: true,
    },
  });

  console.log('Admin user ensured:', adminUser.email);

  const featureFlags = [
    {
      key: 'feature_advanced_reporting',
      description: 'Enable advanced analytics and reporting dashboards.',
      defaultValue: false,
      isGlobal: true,
      rolloutPct: 0,
    },
    {
      key: 'feature_custom_templates',
      description: 'Allow custom document templates for invoices and reports.',
      defaultValue: true,
      isGlobal: false,
      rolloutPct: 0,
    },
    {
      key: 'feature_prescription_refill',
      moduleCode: 'MODULE_PHARMACY',
      description: 'Allow automated prescription refill requests.',
      defaultValue: false,
      isGlobal: false,
      rolloutPct: 0,
    },
    {
      key: 'feature_image_annotations',
      moduleCode: 'MODULE_RADIOLOGY',
      description: 'Allow image annotation tools for radiology studies.',
      defaultValue: false,
      isGlobal: false,
      rolloutPct: 0,
    },
  ];

  const seededFlags: Record<string, { id: string }> = {};
  for (const flag of featureFlags) {
    const flagRecord = await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {
        description: flag.description,
        defaultValue: flag.defaultValue,
        isGlobal: flag.isGlobal,
        rolloutPct: flag.rolloutPct,
        moduleId: flag.moduleCode ? seededModules[flag.moduleCode]?.id : null,
      },
      create: {
        key: flag.key,
        description: flag.description,
        defaultValue: flag.defaultValue,
        isGlobal: flag.isGlobal,
        rolloutPct: flag.rolloutPct,
        moduleId: flag.moduleCode ? seededModules[flag.moduleCode]?.id : null,
      },
    });
    seededFlags[flagRecord.key] = { id: flagRecord.id };
  }
  console.log('Feature flags ensured');

  const tenantFlagAssignments = [
    { flagKey: 'feature_advanced_reporting', value: true },
    { flagKey: 'feature_custom_templates', value: true },
    { flagKey: 'feature_image_annotations', value: false },
  ];

  for (const assignment of tenantFlagAssignments) {
    const flagEntry = seededFlags[assignment.flagKey];
    if (!flagEntry) continue;

    await prisma.tenantFeatureFlag.upsert({
      where: {
        tenantId_flagId: {
          tenantId: tenant.id,
          flagId: flagEntry.id,
        },
      },
      update: {
        value: assignment.value,
        setBy: adminUser.id,
      },
      create: {
        tenantId: tenant.id,
        flagId: flagEntry.id,
        value: assignment.value,
        setBy: adminUser.id,
      },
    });
  }
  console.log('Tenant feature flags ensured');

  const tenantModuleSeeds = [
    { moduleCode: 'MODULE_CORE_PATIENT', status: 'active' },
    { moduleCode: 'MODULE_PHARMACY', status: 'active' },
    { moduleCode: 'MODULE_LAB', status: 'active' },
    { moduleCode: 'MODULE_BILLING', status: 'active' },
    { moduleCode: 'MODULE_SURGERY', status: 'trial' },
    { moduleCode: 'MODULE_RADIOLOGY', status: 'pending' },
  ];

  for (const assignment of tenantModuleSeeds) {
    const moduleEntry = seededModules[assignment.moduleCode];
    if (!moduleEntry) continue;

    await prisma.tenantModule.upsert({
      where: {
        tenantId_moduleId: {
          tenantId: tenant.id,
          moduleId: moduleEntry.id,
        },
      },
      update: {
        status: assignment.status as any,
        activatedAt: assignment.status === 'active' ? new Date() : null,
        activatedBy: adminUser.id,
      },
      create: {
        tenantId: tenant.id,
        moduleId: moduleEntry.id,
        status: assignment.status as any,
        activatedAt: assignment.status === 'active' ? new Date() : null,
        activatedBy: adminUser.id,
      },
    });
  }
  console.log('Default tenant module assignments ensured');

  // Seed Default Template Settings
  await prisma.tenantSetting.upsert({
    where: {
      tenantId_key: {
        tenantId: tenant.id,
        key: 'document_templates',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      key: 'document_templates',
      value: {
        showLogo: true,
        includeQR: true,
        digitalSignature: true,
        watermark: false
      },
    },
  });

  // Seed Departments
  const departmentsData = [
    { code: 'ADM', name: 'Administration', type: DepartmentType.admin },
    { code: 'EMER', name: 'Emergency', type: DepartmentType.emergency },
    { code: 'SURG', name: 'Surgery', type: DepartmentType.surgery },
    { code: 'MED', name: 'General Medicine', type: DepartmentType.medicine },
    { code: 'LAB', name: 'Laboratory', type: DepartmentType.laboratory },
    { code: 'RAD', name: 'Radiology', type: DepartmentType.radiology },
    { code: 'PHAR', name: 'Pharmacy', type: DepartmentType.pharmacy },
  ];

  const departments: Record<string, any> = {};
  for (const dept of departmentsData) {
    departments[dept.code] = await prisma.department.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: dept.code } },
      update: { type: dept.type },
      create: { ...dept, tenantId: tenant.id },
    });
  }
  console.log('Departments ensured');

  // Users to seed
  const defaultPassword = 'password123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const defaultActions = ['read', 'create', 'update', 'delete'];
  
  const toPermissions = (modules: string[]) => 
    modules.map(mod => ({ moduleId: mod, actions: defaultActions }));

  const users = [
    {
      email: 'admin@hospital.com',
      fullName: 'Jane Admin',
      role: TenantUserRole.tenant_admin,
      modules: [], // tenant_admin bypasses module checks
      departmentCode: 'ADM',
    },
    {
      email: 'doctor@hospital.com',
      fullName: 'Dr. Gregory House',
      role: TenantUserRole.doctor,
      departmentCode: 'MED',
      modules: toPermissions([
        'MODULE_CORE_PATIENT',
        'MODULE_ADMISSION',
        'MODULE_LAB',
        'MODULE_SURGERY',
        'MODULE_RADIOLOGY',
        'MODULE_PHARMACY',
      ]),
    },
    {
      email: 'nurse@hospital.com',
      fullName: 'Carla Espinosa',
      role: TenantUserRole.nurse,
      departmentCode: 'EMER',
      modules: toPermissions([
        'MODULE_CORE_PATIENT',
        'MODULE_ADMISSION',
        'MODULE_PHARMACY',
        'MODULE_LAB',
      ]),
    },
    {
      email: 'pharmacy@hospital.com',
      fullName: 'John Mortar',
      role: TenantUserRole.pharmacist,
      departmentCode: 'PHAR',
      modules: toPermissions(['MODULE_CORE_PATIENT', 'MODULE_PHARMACY']),
    },
    {
      email: 'lab@hospital.com',
      fullName: 'Sarah Microscope',
      role: TenantUserRole.lab_tech,
      departmentCode: 'LAB',
      modules: toPermissions(['MODULE_CORE_PATIENT', 'MODULE_LAB']),
    },
    {
      email: 'billing@hospital.com',
      fullName: 'Amanda Ledger',
      role: TenantUserRole.billing,
      departmentCode: 'ADM',
      modules: toPermissions(['MODULE_CORE_PATIENT', 'MODULE_BILLING']),
    },
    {
      email: 'hr@hospital.com',
      fullName: 'David Resources',
      role: TenantUserRole.hr,
      departmentCode: 'ADM',
      modules: toPermissions(['MODULE_PLANNING']),
    },
  ];

  for (const user of users) {
    const existing = await prisma.tenantUser.findUnique({
      where: { email: user.email },
    });

    const userData = {
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      passwordHash: hashedPassword,
      modules: user.modules,
      isActive: true,
      tenantId: tenant.id,
      departmentId: departments[user.departmentCode]?.id,
    };

    if (!existing) {
      await prisma.tenantUser.create({
        data: userData,
      });
      console.log(`Created user: ${user.fullName} (${user.email})`);
    } else {
      await prisma.tenantUser.update({
        where: { email: user.email },
        data: {
          ...userData,
          // Don't overwrite created_at if we had one, though prisma handles this
        },
      });
      console.log(`Updated user: ${user.fullName} (${user.email})`);
    }
  }

  // Seed Medication Inventory
  console.log('Seeding medication inventory...');
  const medications = [
    { name: 'Paracetamol 500mg Tablets', manufacturer: 'Generic', category: 'Analgesic', stock: 1500, threshold: 200, unit: 'tablets', unitPrice: 100 },
    { name: 'Ibuprofen 200mg Tablets', manufacturer: 'Generic', category: 'Anti-inflammatory', stock: 1200, threshold: 150, unit: 'tablets', unitPrice: 80 },
    { name: 'Amoxicillin 500mg Capsules', manufacturer: 'Generic', category: 'Antibiotic', stock: 800, threshold: 100, unit: 'capsules', unitPrice: 150 },
    { name: 'Omeprazole 20mg Capsules', manufacturer: 'Generic', category: 'Gastrointestinal', stock: 600, threshold: 80, unit: 'capsules', unitPrice: 200 },
    { name: 'Metformin 500mg Tablets', manufacturer: 'Generic', category: 'Antidiabetic', stock: 900, threshold: 120, unit: 'tablets', unitPrice: 100 },
    { name: 'Amlodipine 5mg Tablets', manufacturer: 'Generic', category: 'Cardiovascular', stock: 700, threshold: 90, unit: 'tablets', unitPrice: 120 },
    { name: 'Simvastatin 20mg Tablets', manufacturer: 'Generic', category: 'Cardiovascular', stock: 500, threshold: 70, unit: 'tablets', unitPrice: 0.18 },
    { name: 'Losartan 50mg Tablets', manufacturer: 'Generic', category: 'Cardiovascular', stock: 650, threshold: 85, unit: 'tablets', unitPrice: 0.14 },
    { name: 'Prednisone 5mg Tablets', manufacturer: 'Generic', category: 'Corticosteroid', stock: 400, threshold: 50, unit: 'tablets', unitPrice: 0.25 },
    { name: 'Furosemide 40mg Tablets', manufacturer: 'Generic', category: 'Diuretic', stock: 550, threshold: 75, unit: 'tablets', unitPrice: 0.09 },
    { name: 'Warfarin 5mg Tablets', manufacturer: 'Generic', category: 'Anticoagulant', stock: 300, threshold: 40, unit: 'tablets', unitPrice: 0.30 },
    { name: 'Digoxin 0.25mg Tablets', manufacturer: 'Generic', category: 'Cardiovascular', stock: 250, threshold: 35, unit: 'tablets', unitPrice: 0.35 },
    { name: 'Levothyroxine 50mcg Tablets', manufacturer: 'Generic', category: 'Thyroid', stock: 450, threshold: 60, unit: 'tablets', unitPrice: 0.22 },
    { name: 'Albuterol Inhaler 100mcg', manufacturer: 'Generic', category: 'Respiratory', stock: 200, threshold: 30, unit: 'inhalers', unitPrice: 5.00 },
    { name: 'Insulin Glargine 100IU/ml', manufacturer: 'Generic', category: 'Antidiabetic', stock: 150, threshold: 20, unit: 'vials', unitPrice: 15.00 },
    { name: 'Ciprofloxacin 500mg Tablets', manufacturer: 'Generic', category: 'Antibiotic', stock: 750, threshold: 100, unit: 'tablets', unitPrice: 0.20 },
    { name: 'Azithromycin 250mg Tablets', manufacturer: 'Generic', category: 'Antibiotic', stock: 600, threshold: 80, unit: 'tablets', unitPrice: 0.18 },
    { name: 'Hydrochlorothiazide 25mg Tablets', manufacturer: 'Generic', category: 'Diuretic', stock: 500, threshold: 65, unit: 'tablets', unitPrice: 0.07 },
    { name: 'Aspirin 75mg Tablets', manufacturer: 'Generic', category: 'Antiplatelet', stock: 1000, threshold: 130, unit: 'tablets', unitPrice: 0.03 },
    { name: 'Clopidogrel 75mg Tablets', manufacturer: 'Generic', category: 'Antiplatelet', stock: 400, threshold: 55, unit: 'tablets', unitPrice: 0.40 },
    { name: 'Atorvastatin 10mg Tablets', manufacturer: 'Generic', category: 'Cardiovascular', stock: 550, threshold: 75, unit: 'tablets', unitPrice: 0.16 },
    { name: 'Ramipril 5mg Capsules', manufacturer: 'Generic', category: 'Cardiovascular', stock: 450, threshold: 60, unit: 'capsules', unitPrice: 0.13 },
    { name: 'Bisoprolol 5mg Tablets', manufacturer: 'Generic', category: 'Cardiovascular', stock: 350, threshold: 45, unit: 'tablets', unitPrice: 0.11 },
    { name: 'Pantoprazole 40mg Tablets', manufacturer: 'Generic', category: 'Gastrointestinal', stock: 500, threshold: 70, unit: 'tablets', unitPrice: 0.28 },
    { name: 'Cetirizine 10mg Tablets', manufacturer: 'Generic', category: 'Antihistamine', stock: 800, threshold: 100, unit: 'tablets', unitPrice: 0.06 },
    { name: 'Loratadine 10mg Tablets', manufacturer: 'Generic', category: 'Antihistamine', stock: 700, threshold: 90, unit: 'tablets', unitPrice: 0.08 },
    { name: 'Salbutamol Nebulizer Solution', manufacturer: 'Generic', category: 'Respiratory', stock: 300, threshold: 40, unit: 'vials', unitPrice: 2.50 },
    { name: 'Budesonide 200mcg Inhaler', manufacturer: 'Generic', category: 'Respiratory', stock: 180, threshold: 25, unit: 'inhalers', unitPrice: 6.00 },
    { name: 'Montelukast 10mg Tablets', manufacturer: 'Generic', category: 'Respiratory', stock: 400, threshold: 50, unit: 'tablets', unitPrice: 0.50 },
    { name: 'Vitamin D3 1000IU Capsules', manufacturer: 'Generic', category: 'Vitamin', stock: 600, threshold: 80, unit: 'capsules', unitPrice: 0.10 },
    { name: 'Folic Acid 5mg Tablets', manufacturer: 'Generic', category: 'Vitamin', stock: 900, threshold: 120, unit: 'tablets', unitPrice: 0.05 },
    { name: 'Iron Sulfate 325mg Tablets', manufacturer: 'Generic', category: 'Mineral', stock: 550, threshold: 75, unit: 'tablets', unitPrice: 0.04 },
    { name: 'Calcium Carbonate 500mg Tablets', manufacturer: 'Generic', category: 'Mineral', stock: 800, threshold: 100, unit: 'tablets', unitPrice: 0.06 },
    { name: 'Magnesium Oxide 400mg Tablets', manufacturer: 'Generic', category: 'Mineral', stock: 450, threshold: 60, unit: 'tablets', unitPrice: 0.08 },
    { name: 'Multivitamin Tablets', manufacturer: 'Generic', category: 'Vitamin', stock: 700, threshold: 90, unit: 'tablets', unitPrice: 0.12 },
    { name: 'Zinc Sulfate 220mg Tablets', manufacturer: 'Generic', category: 'Mineral', stock: 500, threshold: 65, unit: 'tablets', unitPrice: 0.07 },
    { name: 'Vitamin C 500mg Tablets', manufacturer: 'Generic', category: 'Vitamin', stock: 1000, threshold: 130, unit: 'tablets', unitPrice: 0.03 },
    { name: 'Vitamin B Complex Tablets', manufacturer: 'Generic', category: 'Vitamin', stock: 600, threshold: 80, unit: 'tablets', unitPrice: 0.09 },
    { name: 'Omega-3 Fish Oil 1000mg Capsules', manufacturer: 'Generic', category: 'Supplement', stock: 400, threshold: 50, unit: 'capsules', unitPrice: 0.25 },
    { name: 'Probiotics 10 Billion CFU Capsules', manufacturer: 'Generic', category: 'Supplement', stock: 350, threshold: 45, unit: 'capsules', unitPrice: 0.30 },
    { name: 'Melatonin 3mg Tablets', manufacturer: 'Generic', category: 'Sleep Aid', stock: 300, threshold: 40, unit: 'tablets', unitPrice: 0.15 },
    { name: 'Diphenhydramine 25mg Tablets', manufacturer: 'Generic', category: 'Antihistamine', stock: 650, threshold: 85, unit: 'tablets', unitPrice: 0.04 },
    { name: 'Loperamide 2mg Capsules', manufacturer: 'Generic', category: 'Antidiarrheal', stock: 500, threshold: 65, unit: 'capsules', unitPrice: 0.06 },
    { name: 'Docusate Sodium 100mg Capsules', manufacturer: 'Generic', category: 'Laxative', stock: 450, threshold: 60, unit: 'capsules', unitPrice: 0.08 },
    { name: 'Senna 8.6mg Tablets', manufacturer: 'Generic', category: 'Laxative', stock: 400, threshold: 55, unit: 'tablets', unitPrice: 0.05 },
    { name: 'Acetaminophen 325mg Tablets', manufacturer: 'Generic', category: 'Analgesic', stock: 1200, threshold: 150, unit: 'tablets', unitPrice: 0.04 },
    { name: 'Naproxen 250mg Tablets', manufacturer: 'Generic', category: 'Anti-inflammatory', stock: 550, threshold: 70, unit: 'tablets', unitPrice: 0.12 },
    { name: 'Doxycycline 100mg Capsules', manufacturer: 'Generic', category: 'Antibiotic', stock: 400, threshold: 50, unit: 'capsules', unitPrice: 0.22 },
    { name: 'Trimethoprim-Sulfamethoxazole 160mg/800mg Tablets', manufacturer: 'Generic', category: 'Antibiotic', stock: 350, threshold: 45, unit: 'tablets', unitPrice: 0.18 },
    { name: 'Fluconazole 150mg Tablets', manufacturer: 'Generic', category: 'Antifungal', stock: 250, threshold: 35, unit: 'tablets', unitPrice: 0.50 },
    { name: 'Acyclovir 400mg Tablets', manufacturer: 'Generic', category: 'Antiviral', stock: 300, threshold: 40, unit: 'tablets', unitPrice: 0.35 },
    { name: 'Valacyclovir 500mg Tablets', manufacturer: 'Generic', category: 'Antiviral', stock: 200, threshold: 30, unit: 'tablets', unitPrice: 0.80 },
    { name: 'Oseltamivir 75mg Capsules', manufacturer: 'Generic', category: 'Antiviral', stock: 150, threshold: 20, unit: 'capsules', unitPrice: 1.00 },
    { name: 'Ranitidine 150mg Tablets', manufacturer: 'Generic', category: 'Gastrointestinal', stock: 600, threshold: 80, unit: 'tablets', unitPrice: 0.06 },
    { name: 'Famotidine 20mg Tablets', manufacturer: 'Generic', category: 'Gastrointestinal', stock: 500, threshold: 65, unit: 'tablets', unitPrice: 0.10 },
  ];

  for (const med of medications) {
    try {
      await prisma.medicationInventory.create({
        data: { ...med, tenantId: tenant.id },
      });
    } catch (error) {
      // Skip if already exists
      console.log(`Medication ${med.name} already exists, skipping`);
    }
  }
  console.log('Medication inventory seeded with 50 items');

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
