import { prisma } from '../config/db';

async function checkAllOpenSessions() {
  console.log('===============================================================');
  console.log('    AUDITORÍA DE TODAS LAS SESIONES DE CAJA ABIERTAS EN LA BD');
  console.log('===============================================================\n');

  const openSessions = await prisma.cashSession.findMany({
    where: { status: 'OPEN' },
    include: {
      business: { select: { id: true, name: true } },
      cashRegister: { select: { id: true, name: true, code: true } },
      openedBy: { select: { id: true, name: true, email: true } },
      cashMovements: { select: { id: true, type: true, amount: true, referenceType: true, reason: true } }
    },
    orderBy: { openedAt: 'desc' }
  });

  console.log(`TOTAL DE SESIONES ABIERTAS (status: 'OPEN') EN LA BD: ${openSessions.length}\n`);

  for (const s of openSessions) {
    console.log(JSON.stringify({
      sessionId: s.id,
      businessName: s.business?.name,
      businessId: s.businessId,
      cashRegisterCode: s.cashRegister?.code,
      openedByName: s.openedBy?.name,
      openedById: s.openedById,
      openingBalance: Number(s.openingBalance),
      openedAt: s.openedAt,
      cashMovementsCount: s.cashMovements.length,
      cashMovementsSummary: s.cashMovements.map(m => ({
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        referenceType: m.referenceType,
        reason: m.reason
      }))
    }, null, 2));
    console.log('---------------------------------------------------------------');
  }

  // Verificar usuarios registrados en la BD
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, businessId: true }
  });

  console.log('\nUSUARIOS REGISTRADOS EN LA BD:');
  console.log(JSON.stringify(users, null, 2));
}

checkAllOpenSessions()
  .catch((err) => console.error('Error al auditar sesiones abiertas:', err))
  .finally(() => prisma.$disconnect());
