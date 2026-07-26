import { prisma } from '../config/db';
import { CashService } from '../services/cash.service';

async function traceRealPOSSale() {
  console.log('===============================================================');
  console.log('    TRAZABILIDAD COMPLETA DE VENTAS REALES EN BASE DE DATOS');
  console.log('===============================================================\n');

  // 1. Buscar el negocio y la última venta creada
  const business = await prisma.business.findFirst();
  if (!business) {
    console.error('❌ No se encontró ningún negocio en la base de datos.');
    return;
  }

  const sales = await prisma.sale.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      payments: {
        include: {
          paymentMethod: true
        }
      }
    }
  });

  console.log(`1. ÚLTIMAS 5 VENTAS EN LA BASE DE DATOS (${business.name}):`);
  for (const s of sales) {
    const mov = await prisma.cashMovement.findFirst({
      where: { referenceType: 'SALE', referenceId: s.id }
    });

    console.log(JSON.stringify({
      saleId: s.id,
      documentNumber: s.documentNumber,
      status: s.status,
      paymentStatus: s.paymentStatus,
      totalAmount: Number(s.totalAmount),
      cashSessionId: s.cashSessionId,
      createdAt: s.createdAt,
      associatedCashMovement: mov ? {
        id: mov.id,
        cashSessionId: mov.cashSessionId,
        type: mov.type,
        amount: Number(mov.amount),
        paymentMethod: mov.paymentMethod,
        reason: mov.reason,
        createdAt: mov.createdAt
      } : '❌ INEXISTENTE'
    }, null, 2));
    console.log('---------------------------------------------------------------');
  }

  // 2. Buscar la sesión activa en el negocio
  const activeSession = await prisma.cashSession.findFirst({
    where: { businessId: business.id, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
    include: {
      openedBy: { select: { id: true, name: true, email: true } },
      cashRegister: { select: { id: true, name: true, code: true } }
    }
  });

  console.log('\n2. INFORMACIÓN DE LA SESIÓN ACTIVA (status: OPEN):');
  if (!activeSession) {
    console.log('❌ NO HAY NINGUNA SESIÓN DE CAJA ABIERTA ACTUALMENTE EN EL NEGOCIO.');
  } else {
    console.log(JSON.stringify({
      id: activeSession.id,
      cashRegister: activeSession.cashRegister?.code || activeSession.cashRegisterId,
      openedBy: activeSession.openedBy?.name,
      openedById: activeSession.openedById,
      openingBalance: Number(activeSession.openingBalance),
      status: activeSession.status,
      openedAt: activeSession.openedAt
    }, null, 2));

    // 3. Consultar la API a través de CashService (lo mismo que recibe GET /api/v1/cash/active)
    const cashService = new CashService();
    const activeData = await cashService.getActiveSession(business.id, activeSession.openedById);

    console.log('\n3. RESPUESTA DEL ENDPOINT /cash/active (CashService.getActiveSession):');
    console.log(JSON.stringify({
      sessionId: activeData?.id,
      status: activeData?.status,
      openingBalance: activeData?.openingBalance,
      totals: activeData?.totals,
      cashMovementsCount: activeData?.cashMovements?.length,
      cashMovementsList: activeData?.cashMovements
    }, null, 2));
  }
}

traceRealPOSSale()
  .catch((err) => console.error('Error al trazar venta real:', err))
  .finally(() => prisma.$disconnect());
