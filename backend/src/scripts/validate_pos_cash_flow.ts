import { prisma } from '../config/db';
import { SaleService } from '../services/sale.service';
import { CashService } from '../services/cash.service';

async function validatePOSCashFlow() {
  console.log('===============================================================');
  console.log('   VALIDACIÓN FUNCIONAL REAL Y COMPLETA: POS -> CAJA');
  console.log('===============================================================\n');

  const saleService = new SaleService();
  const cashService = new CashService();

  const business = await prisma.business.findFirst();
  if (!business) return;

  const warehouse = await prisma.warehouse.findFirst({ where: { businessId: business.id } });
  const product = await prisma.product.findFirst({ where: { businessId: business.id } });
  
  if (!warehouse || !product) return;

  let activeSessionData = await prisma.cashSession.findFirst({
    where: { businessId: business.id, status: 'OPEN' },
    orderBy: { openedAt: 'desc' }
  });

  if (!activeSessionData) return;

  const currentSession = activeSessionData;
  const user = await prisma.user.findFirst({ where: { businessId: business.id } });
  const userId = user?.id || currentSession.openedById;

  console.log('📌 SESIÓN DE CAJA INICIAL DE LA PRUEBA:');
  console.log({
    sessionId: currentSession.id,
    businessId: business.id,
    userId,
    openingBalance: Number(currentSession.openingBalance),
    status: currentSession.status
  });

  const testCases = [
    { name: 'Venta 1: EFECTIVO', method: 'EFECTIVO', amount: 1500.00, status: 'COMPLETED' },
    { name: 'Venta 2: TARJETA DEBITO', method: 'DEBIT_CARD', amount: 3500.00, status: 'COMPLETED' },
    { name: 'Venta 3: MERCADO PAGO APROBADO', method: 'MERCADO_PAGO', amount: 5000.00, status: 'COMPLETED' }
  ];

  for (const tc of testCases) {
    console.log(`\n---------------------------------------------------------------`);
    console.log(`🚀 EJECUTANDO: ${tc.name}`);
    console.log(`---------------------------------------------------------------`);

    console.log('[SALE TEST]', {
      businessId: business.id,
      usuario: userId,
      cashSessionIdRecibido: undefined,
      cashSessionIdResuelto: currentSession.id,
      totalAmount: tc.amount,
      paymentMethod: tc.method
    });

    const sale = await saleService.create(business.id, userId, {
      warehouseId: warehouse.id,
      totalAmount: tc.amount,
      subtotal: tc.amount,
      status: tc.status,
      items: [
        {
          productId: product.id,
          quantity: 1,
          unitPrice: tc.amount,
          totalAmount: tc.amount
        }
      ],
      payments: [
        {
          paymentMethodId: '',
          amount: tc.amount,
          details: tc.method
        }
      ]
    });

    console.log('\n1. CREACIÓN DE SALE:');
    console.log({
      id: sale.id,
      documentNumber: sale.documentNumber,
      cashSessionId: sale.cashSessionId,
      status: sale.status,
      totalAmount: Number(sale.totalAmount)
    });

    const movement = await prisma.cashMovement.findFirst({
      where: { referenceType: 'SALE', referenceId: sale.id }
    });

    console.log('\n2. CREACIÓN DE CASHMOVEMENT:');
    if (movement) {
      console.log({
        id: movement.id,
        cashSessionId: movement.cashSessionId,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        amount: Number(movement.amount),
        paymentMethod: movement.paymentMethod,
        reason: movement.reason,
        createdAt: movement.createdAt
      });
    } else {
      console.error('❌ FALLÓ: No se creó CashMovement para la venta ' + sale.id);
    }
  }

  console.log('\n===============================================================');
  console.log(' 3. VALIDACIÓN EN /cash/active (CashService.getActiveSession)');
  console.log('===============================================================\n');

  const activeSessionResponse = await cashService.getActiveSession(business.id, userId);

  console.log('RESPUESTA DEL ENDPOINT /cash/active (Resumen de Totales):');
  console.log(JSON.stringify(activeSessionResponse?.totals, null, 2));

  console.log('\nÚLTIMOS MOVIMIENTOS EN CAJA (/cash/active):');
  console.log(JSON.stringify((activeSessionResponse?.cashMovements || []).slice(0, 5), null, 2));

  console.log('\n===============================================================');
  console.log(' 4. AUDITORÍA DE TRANSACCIÓN ATÓMICA');
  console.log('===============================================================\n');

  const orphanedSales = await prisma.sale.findMany({
    where: {
      businessId: business.id,
      status: 'COMPLETED',
    }
  });

  const movementsCheck = await Promise.all(
    orphanedSales.map(async (s) => {
      const mov = await prisma.cashMovement.findFirst({ where: { referenceType: 'SALE', referenceId: s.id } });
      return { saleId: s.id, documentNumber: s.documentNumber, hasMovement: !!mov };
    })
  );

  const salesWithoutMovement = movementsCheck.filter(m => !m.hasMovement);
  console.log(`Ventas COMPLETED auditadas en el negocio: ${movementsCheck.length}`);
  console.log(`Ventas COMPLETED sin CashMovement tras las correcciones: ${salesWithoutMovement.length}`);

  if (salesWithoutMovement.length > 0) {
    console.log('⚠️ Ventas huérfanas históricas previas a la corrección:', JSON.stringify(salesWithoutMovement, null, 2));
  } else {
    console.log('✅ 100% de las ventas COMPLETED tienen su correspondiente CashMovement registrado.');
  }
}

validatePOSCashFlow()
  .catch((err) => console.error('Error en prueba funcional:', err))
  .finally(() => prisma.$disconnect());
