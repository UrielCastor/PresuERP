import { prisma } from '../config/db';
import { calculateSessionTotals, CashService } from '../services/cash.service';

async function inspectRealDatabaseData() {
  console.log('===============================================================');
  console.log('      AUDITORÍA DE DATOS REALES EN BASE DE DATOS (PRISMA)');
  console.log('===============================================================\n');

  // 1. El registro completo de CustomerAccountMovement (último tipo PAYMENT)
  const lastAccountPayment = await prisma.customerAccountMovement.findFirst({
    where: { type: 'PAYMENT' },
    orderBy: { createdAt: 'desc' },
  });

  console.log('1. ÚLTIMO REGISTRO DE CustomerAccountMovement (PAYMENT):');
  console.log(JSON.stringify(lastAccountPayment, null, 2));

  if (!lastAccountPayment) {
    console.log('\n❌ No hay ningún CustomerAccountMovement de tipo PAYMENT registrado en la BD.');
    return;
  }

  // 2. El registro completo de CashMovement creado para ese mismo pago (o último CashMovement)
  const cashMovement = await prisma.cashMovement.findFirst({
    where: { referenceId: lastAccountPayment.id },
  });

  console.log('\n2. CashMovement ASOCIADO AL PAGO (referenceId = ' + lastAccountPayment.id + '):');
  console.log(JSON.stringify(cashMovement, null, 2));

  // 3. La CashSession a la que pertenece ese CashMovement (o última CashSession abierta/cerrada)
  const sessionId = cashMovement ? cashMovement.cashSessionId : (await prisma.cashSession.findFirst({ orderBy: { openedAt: 'desc' } }))?.id;

  const session = sessionId ? await prisma.cashSession.findUnique({
    where: { id: sessionId },
    include: {
      openedBy: { select: { id: true, name: true, email: true } },
      cashRegister: { select: { id: true, name: true, code: true } },
      cashMovements: {
        orderBy: { createdAt: 'asc' }
      }
    }
  }) : null;

  console.log('\n3. LA CashSession CORRESPONDIENTE:');
  console.log(JSON.stringify({
    id: session?.id,
    businessId: session?.businessId,
    cashRegisterId: session?.cashRegisterId,
    status: session?.status,
    openingBalance: session?.openingBalance,
    openedAt: session?.openedAt,
    closedAt: session?.closedAt,
    cashMovementsCount: session?.cashMovements?.length
  }, null, 2));

  // 4 & 6. Todos los CashMovement asociados a esa CashSession (con id, amount, type, paymentMethod, referenceType, reason)
  console.log('\n4 & 6. TODOS LOS CashMovement ASOCIADOS A LA SESIÓN (Campos solicitados):');
  const mappedMovements = (session?.cashMovements || []).map((m: any) => ({
    id: m.id,
    amount: Number(m.amount),
    type: m.type,
    paymentMethod: m.paymentMethod,
    referenceType: m.referenceType,
    reason: m.reason,
    createdAt: m.createdAt
  }));
  console.log(JSON.stringify(mappedMovements, null, 2));

  // 5. Los valores que recibe calculateSessionTotals() antes de empezar a sumar
  console.log('\n5. VALORES ENTRANTES A calculateSessionTotals(session):');
  console.log('   - openingBalance:', session?.openingBalance);
  console.log('   - Array de cashMovements (longitud ' + session?.cashMovements?.length + ')');

  // 7. Mostrar cuánto calcula calculateSessionTotals()
  const totals = session ? calculateSessionTotals(session) : null;
  console.log('\n7. CÁLCULO RESULTANTE DE calculateSessionTotals():');
  console.log(JSON.stringify(totals, null, 2));

  // 8. Comparar con lo que devuelve el servicio CashService (Endpoint de Caja)
  const cashService = new CashService();
  const apiSessionData = session ? await cashService.getSessionHistoryDetail(session.id, session.businessId) : null;

  console.log('\n8. DATOS RETORNADOS POR EL ENDPOINT DE CAJA (CashService.getSessionHistoryDetail / getActiveSession):');
  console.log(JSON.stringify({
    sessionId: apiSessionData?.id,
    status: apiSessionData?.status,
    totals: apiSessionData?.totals
  }, null, 2));
}

inspectRealDatabaseData()
  .catch((err) => console.error('Error al inspeccionar datos:', err))
  .finally(() => prisma.$disconnect());
