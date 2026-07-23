import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial SaaS plans...');

  const plans = [
    {
      name: 'FREE',
      code: 'PLAN_FREE',
      monthlyPrice: 0,
      maxUsers: 2,
      maxProducts: 100,
      active: true,
      features: JSON.stringify(['VENTAS_BASICAS', 'GESTION_CLIENTES', 'PRODUCTOS_BASICOS']),
    },
    {
      name: 'PROFESSIONAL',
      code: 'PLAN_PRO',
      monthlyPrice: 10000,
      maxUsers: 10,
      maxProducts: 5000,
      active: true,
      features: JSON.stringify(['VENTAS', 'COMPRAS', 'CAJA', 'STOCK', 'REPORTES', 'USUARIOS_MULTIPLES']),
    },
    {
      name: 'ENTERPRISE',
      code: 'PLAN_ENT',
      monthlyPrice: 50000,
      maxUsers: 0,
      maxProducts: 0,
      active: true,
      features: JSON.stringify(['TODAS_LAS_FUNCIONALIDADES', 'SOPORTE_PRIORITARIO', 'PERSONALIZACIONES']),
    }
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {},
      create: plan,
    });
  }

  console.log('Plans seeded successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
