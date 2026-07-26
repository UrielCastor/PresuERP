import { prisma } from '../config/db';

async function repairUrielSessionSales() {
  console.log('===============================================================');
  console.log('  REPARACIÓN DE MOVIMIENTOS FALTANTES EN CAJA DE URIEL CASTOR');
  console.log('===============================================================\n');

  const user = await prisma.user.findFirst({ where: { email: 'urielcastor_4@hotmail.com' } });
  if (!user || !user.businessId) return;

  const activeSession = await prisma.cashSession.findFirst({
    where: { businessId: user.businessId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
    include: { sales: true }
  });

  if (!activeSession) {
    console.log('❌ No se encontró sesión abierta.');
    return;
  }

  console.log(`Sesión activa: ${activeSession.id} (Fondo Inicial: $${activeSession.openingBalance})`);

  for (const s of activeSession.sales) {
    if (s.status === 'COMPLETED') {
      const existingMov = await prisma.cashMovement.findFirst({
        where: { referenceType: 'SALE', referenceId: s.id }
      });

      if (!existingMov) {
        console.log(`🔧 Creando CashMovement faltante para Venta TICKET-${s.documentNumber} (ID: ${s.id}, Monto: $${s.totalAmount})...`);
        
        const newMov = await prisma.cashMovement.create({
          data: {
            businessId: user.businessId,
            cashSessionId: activeSession.id,
            createdById: s.createdById,
            type: 'IN',
            amount: s.totalAmount,
            referenceType: 'SALE',
            referenceId: s.id,
            paymentMethod: 'CASH',
            reason: `Cobro de venta TICKET-${s.documentNumber} (EFECTIVO)`,
          }
        });

        console.log(`✅ CashMovement creado con ID: ${newMov.id}`);
      } else {
        console.log(`✓ Venta TICKET-${s.documentNumber} ya tiene CashMovement ${existingMov.id}`);
      }
    }
  }

  console.log('\n✅ Reparación completada.');
}

repairUrielSessionSales()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
