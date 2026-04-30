import 'dotenv/config';
import { TenantType, TenantStatus, TenantUserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';

async function main() {
  console.log('Seeding database...');

  // Create or find default tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'medcare-main' },
    update: {},
    create: {
      slug: 'medcare-main',
      name: 'MedCare Hospital',
      type: TenantType.hospital,
      status: TenantStatus.active,
      dbSchema: 'tenant_main',
      countryCode: 'CM',
      contactEmail: 'admin@medcare.com',
      contactPhone: '+237 600000000',
    },
  });

  console.log('Tenant ensured:', tenant.name);

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
    },
    {
      email: 'doctor@hospital.com',
      fullName: 'Dr. Gregory House',
      role: TenantUserRole.doctor,
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
      modules: toPermissions(['MODULE_CORE_PATIENT', 'MODULE_PHARMACY']),
    },
    {
      email: 'lab@hospital.com',
      fullName: 'Sarah Microscope',
      role: TenantUserRole.lab_tech,
      modules: toPermissions(['MODULE_CORE_PATIENT', 'MODULE_LAB']),
    },
    {
      email: 'billing@hospital.com',
      fullName: 'Amanda Ledger',
      role: TenantUserRole.billing,
      modules: toPermissions(['MODULE_CORE_PATIENT', 'MODULE_BILLING']),
    },
    {
      email: 'hr@hospital.com',
      fullName: 'David Resources',
      role: TenantUserRole.hr,
      modules: toPermissions(['MODULE_PLANNING']),
    },
  ];

  for (const user of users) {
    const existing = await prisma.tenantUser.findUnique({
      where: { email: user.email },
    });

    if (!existing) {
      await prisma.tenantUser.create({
        data: {
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          passwordHash: hashedPassword,
          modules: user.modules,
          isActive: true,
        },
      });
      console.log(`Created user: ${user.fullName} (${user.email})`);
    } else {
      await prisma.tenantUser.update({
        where: { email: user.email },
        data: {
          modules: user.modules,
          role: user.role,
          passwordHash: hashedPassword,
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
