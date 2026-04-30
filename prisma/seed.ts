import 'dotenv/config';
import { TenantType, TenantStatus, TenantUserRole, DepartmentType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';

async function main() {
  console.log('Seeding database...');

  // Create or find default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'medcare-main' },
    update: {
      dbSchema: 'public', // Ensure it matches the user's request
    },
    create: {
      slug: 'medcare-main',
      name: 'MedCare Hospital',
      type: TenantType.hospital,
      status: TenantStatus.active,
      dbSchema: 'public',
      countryCode: 'CM',
      contactEmail: 'admin@medcare.com',
      contactPhone: '+237 600000000',
      address: '1 Avenue de l\'Hôpital, Douala',
      metadata: {
        website: 'https://medcare-hospital.com',
        taxId: '1000000100'
      }
    },
  });

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
