import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de Planes...');
  const planFree = await prisma.plan.upsert({
    where: { code: 'FREE' },
    update: {},
    create: {
      name: 'FREE',
      code: 'FREE',
      maxUsers: 0,
      maxProducts: 0,
      active: true,
      isDefault: true,
    },
  });

  const planStandard = await prisma.plan.upsert({
    where: { code: 'STANDARD' },
    update: {},
    create: {
      name: 'STANDARD',
      code: 'STANDARD',
      maxUsers: 10,
      maxProducts: 1000,
      active: true,
      isDefault: false,
    },
  });

  const planPremium = await prisma.plan.upsert({
    where: { code: 'PREMIUM' },
    update: {},
    create: {
      name: 'PREMIUM',
      code: 'PREMIUM',
      maxUsers: 0,
      maxProducts: 0,
      active: true,
      isDefault: false,
    },
  });

  // Seed Plan Prices
  await prisma.planPrice.upsert({
    where: { id: 'price-free' },
    update: {},
    create: {
      id: 'price-free',
      planId: planFree.id,
      billingCycle: 'FREE',
      price: 0,
      active: true,
    },
  });

  await prisma.planPrice.upsert({
    where: { id: 'price-standard-monthly' },
    update: {},
    create: {
      id: 'price-standard-monthly',
      planId: planStandard.id,
      billingCycle: 'MONTHLY',
      price: 2999.00,
      active: true,
    },
  });

  await prisma.planPrice.upsert({
    where: { id: 'price-standard-yearly' },
    update: {},
    create: {
      id: 'price-standard-yearly',
      planId: planStandard.id,
      billingCycle: 'YEARLY',
      price: 29990.00,
      active: true,
    },
  });

  await prisma.planPrice.upsert({
    where: { id: 'price-premium-monthly' },
    update: {},
    create: {
      id: 'price-premium-monthly',
      planId: planPremium.id,
      billingCycle: 'MONTHLY',
      price: 5999.00,
      active: true,
    },
  });

  await prisma.planPrice.upsert({
    where: { id: 'price-premium-yearly' },
    update: {},
    create: {
      id: 'price-premium-yearly',
      planId: planPremium.id,
      billingCycle: 'YEARLY',
      price: 59990.00,
      active: true,
    },
  });

  console.log('Iniciando seed de DocumentTypes...');
  const businesses = await prisma.business.findMany();

  for (const business of businesses) {
    // Ticket POS
    await prisma.documentType.upsert({
      where: {
        code_businessId: {
          code: 'TICKET',
          businessId: business.id,
        },
      },
      update: {},
      create: {
        businessId: business.id,
        name: 'Ticket POS',
        code: 'TICKET',
        prefix: 'T',
        nextNumber: 1,
        isFiscal: false,
        direction: 'OUTGOING',
      },
    });

    // Factura Electrónica
    await prisma.documentType.upsert({
      where: {
        code_businessId: {
          code: 'FACTURA',
          businessId: business.id,
        },
      },
      update: {},
      create: {
        businessId: business.id,
        name: 'Factura Electrónica',
        code: 'FACTURA',
        prefix: 'F',
        nextNumber: 1,
        isFiscal: true,
        direction: 'OUTGOING',
      },
    });
  }

  console.log(`Seed completado: Planes y DocumentTypes configurados de forma segura.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
