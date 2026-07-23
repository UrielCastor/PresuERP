const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const business = await prisma.business.findFirst();
    if (!business) { console.log('No business'); return; }

    const warehouse = await prisma.warehouse.findFirst({ where: { businessId: business.id } });
    const product = await prisma.product.findFirst({ where: { businessId: business.id } });
    const user = await prisma.user.findFirst({ where: { businessId: business.id } });
    const cashSession = await prisma.cashSession.findFirst({ where: { businessId: business.id, status: 'OPEN' } });

    if (!warehouse || !product || !user || !cashSession) {
      console.log('Missing dependencies', { warehouse: !!warehouse, product: !!product, user: !!user, cashSession: !!cashSession });
      return;
    }

    // Call service logic equivalent manually relying on Prisma transactions
    const docType = await prisma.documentType.findFirst({ where: { businessId: business.id } });
    if (!docType) { console.log('No doctype'); return; }

    await prisma.$transaction(async (tx) => {
        // Attempt to create cashMovement and update cashSession
        console.log('Attempting Sale Creation and Cash Integration');
        
        const payments = [{ amount: 100, details: "CASH" }];
        
        console.log('Creating cashMovement...');
        await tx.cashMovement.create({
            data: {
              businessId: business.id,
              cashSessionId: cashSession.id,
              createdById: user.id,
              type: 'IN',
              amount: 100,
              referenceType: 'SALE',
              referenceId: 'some-fake-uuid',
              reason: `Cobro de venta ${docType.code}-1234 (CASH)`,
            }
          });
          
        console.log('Updating cashSession...');
        await tx.cashSession.update({
            where: { id: cashSession.id },
            data: {
              cashTransactionsTotal: { increment: 100 }
            }
        });
        
    });
    
    console.log('Success!');

  } catch (err) {
    console.error('EXCEPTION:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
