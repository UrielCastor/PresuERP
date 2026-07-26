import { prisma } from '../config/db';
import { CashService } from '../services/cash.service';

async function inspectUrielBusiness() {
  console.log('===============================================================');
  console.log(' AUDITORÍA DE LA CUENTA URIEL CASTOR (urielcastor_4@hotmail.com)');
  console.log('===============================================================\n');

  const user = await prisma.user.findFirst({
    where: { email: 'urielcastor_4@hotmail.com' }
  });

  if (!user || !user.businessId) {
    console.error('❌ No se encontró el usuario Uriel Castor con businessId.');
    return;
  }

  const businessId = user.businessId;

  console.log('1. USUARIO:', { id: user.id, name: user.name, email: user.email, businessId });

  const business = await prisma.business.findUnique({
    where: { id: businessId }
  });

  console.log('2. NEGOCIO:', { id: business?.id, name: business?.name });

  // Buscar todas las sesiones de este negocio
  const sessions = await prisma.cashSession.findMany({
    where: { businessId },
    include: {
      cashRegister: true,
      openedBy: { select: { id: true, name: true, email: true } },
      cashMovements: { orderBy: { createdAt: 'desc' } },
      sales: { orderBy: { createdAt: 'desc' } }
    },
    orderBy: { openedAt: 'desc' }
  });

  console.log(`\n3. TOTAL DE SESIONES EN ESTE NEGOCIO: ${sessions.length}`);
  for (const s of sessions) {
    console.log(JSON.stringify({
      sessionId: s.id,
      cashRegisterCode: s.cashRegister?.code,
      openedByName: s.openedBy?.name,
      openedById: s.openedById,
      status: s.status,
      openingBalance: Number(s.openingBalance),
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      cashMovementsCount: s.cashMovements.length,
      cashMovements: s.cashMovements.map((m: any) => ({
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        paymentMethod: m.paymentMethod,
        reason: m.reason
      })),
      salesCount: s.sales.length,
      sales: s.sales.map((sal: any) => ({
        id: sal.id,
        documentNumber: sal.documentNumber,
        status: sal.status,
        totalAmount: Number(sal.totalAmount)
      }))
    }, null, 2));
    console.log('---------------------------------------------------------------');
  }

  // 4. Probar la respuesta de /cash/active para Uriel Castor
  const cashService = new CashService();
  const activePayload = await cashService.getActiveSession(businessId, user.id);

  console.log('\n4. RESPUESTA EXACTA DE /cash/active QUE RECIBE EL NAVEGADOR DE URIEL CASTOR:');
  console.log(JSON.stringify(activePayload, null, 2));
}

inspectUrielBusiness()
  .catch((err) => console.error('Error al inspeccionar negocio de Uriel:', err))
  .finally(() => prisma.$disconnect());
