import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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

  console.log(`Seed completado: DocumentTypes configurados de forma segura para ${businesses.length} tenants.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
