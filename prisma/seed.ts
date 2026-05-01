import 'dotenv/config';
import { TenantType, TenantStatus, TenantUserRole, DepartmentType } from '@prisma/client';
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
      where: { code: dept.code },
      update: { type: dept.type },
      create: dept,
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
        data: med,
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
