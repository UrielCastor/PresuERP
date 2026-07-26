import { prisma } from '../config/db';
import { SaleService } from '../services/sale.service';

async function runAudit() {
  console.log('===============================================================');
  console.log('      AUDITORÍA DE TRAZABILIDAD REAL: POS -> SALE -> CASHMOVEMENT');
  console.log('===============================================================\n');

  // 1. Obtener la última venta registrada en DB
  const lastSale = await prisma.sale.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      payments: {
        include: {
          paymentMethod: true
        }
      }
    }
  });

  if (!lastSale) {
    console.log('❌ No hay ventas registradas en la base de datos.');
  } else {
    console.log('1. ÚLTIMA VENTA REGISTRADA EN LA BD:');
    console.log(JSON.stringify({
      id: lastSale.id,
      documentNumber: lastSale.documentNumber,
      status: lastSale.status,
      paymentStatus: lastSale.paymentStatus,
      totalAmount: Number(lastSale.totalAmount),
      cashSessionId: lastSale.cashSessionId,
      createdById: lastSale.createdById,
      businessId: lastSale.businessId,
      createdAt: lastSale.createdAt,
      payments: lastSale.payments.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        paymentMethodName: p.paymentMethod?.name,
        paymentMethodType: p.paymentMethod?.type,
        status: p.status
      }))
    }, null, 2));

    // Buscar si existe CashMovement asociado a esa venta
    const associatedMovement = await prisma.cashMovement.findFirst({
      where: {
        referenceType: 'SALE',
        referenceId: lastSale.id
      }
    });

    console.log('\n2. CashMovement ASOCIADO A LA ÚLTIMA VENTA (referenceId = ' + lastSale.id + '):');
    if (associatedMovement) {
      console.log(JSON.stringify({
        id: associatedMovement.id,
        cashSessionId: associatedMovement.cashSessionId,
        type: associatedMovement.type,
        amount: Number(associatedMovement.amount),
        paymentMethod: associatedMovement.paymentMethod,
        referenceType: associatedMovement.referenceType,
        reason: associatedMovement.reason,
        createdAt: associatedMovement.createdAt
      }, null, 2));
    } else {
      console.log('⚠️ NO SE ENCONTRÓ NINGÚN CashMovement ASOCIADO A ESTA VENTA.');
    }
  }

  // 2. Verificar la sesión activa de caja en el negocio
  const business = await prisma.business.findFirst();
  if (!business) {
    console.log('\n❌ No hay ningún negocio en la BD.');
    return;
  }

  const activeSession = await prisma.cashSession.findFirst({
    where: { businessId: business.id, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
    include: {
      cashMovements: true,
      openedBy: { select: { id: true, name: true, email: true } }
    }
  });

  console.log('\n3. SESIÓN ACTIVA EN EL NEGOCIO (' + business.name + '):');
  if (activeSession) {
    console.log(JSON.stringify({
      sessionId: activeSession.id,
      openedBy: activeSession.openedBy?.name,
      openedById: activeSession.openedById,
      openingBalance: Number(activeSession.openingBalance),
      status: activeSession.status,
      cashMovementsCount: activeSession.cashMovements.length,
      cashMovements: activeSession.cashMovements.map(m => ({
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        referenceType: m.referenceType,
        reason: m.reason
      }))
    }, null, 2));
  } else {
    console.log('❌ No hay ninguna sesión de caja ABIERTA actualmente.');
  }

  // 3. Probar ejecución simulada del flujo de venta de prueba
  if (activeSession && business) {
    const warehouse = await prisma.warehouse.findFirst({ where: { businessId: business.id } });
    const product = await prisma.product.findFirst({ where: { businessId: business.id } });
    
    if (warehouse && product) {
      console.log('\n4. EJECUTANDO VENTA DE PRUEBA SIMULANDO EL FLUJO REAL DEL POS...');
      const saleService = new SaleService();

      try {
        const testSale = await saleService.create(
          business.id,
          activeSession.openedById,
          {
            warehouseId: warehouse.id,
            totalAmount: 15.00,
            subtotal: 15.00,
            status: 'COMPLETED',
            items: [
              {
                productId: product.id,
                quantity: 1,
                unitPrice: 15.00,
                totalAmount: 15.00
              }
            ],
            payments: [
              {
                paymentMethodId: '', // Forzará resolución automática de método de pago por código
                amount: 15.00,
                details: 'EFECTIVO'
              }
            ]
          }
        );

        console.log('\n✅ VENTA DE PRUEBA CREADA EXITOSAMENTE con ID:', testSale.id);

        // Verificar inmediatamente si se creó el CashMovement
        const newMov = await prisma.cashMovement.findFirst({
          where: {
            referenceType: 'SALE',
            referenceId: testSale.id
          }
        });

        console.log('\n5. VERIFICACIÓN DEL CashMovement CREADO DE LA VENTA DE PRUEBA:');
        console.log(JSON.stringify(newMov, null, 2));

      } catch (err: any) {
        console.error('\n❌ ERROR AL CREAR VENTA DE PRUEBA:', err.message || err);
      }
    }
  }
}

runAudit()
  .catch((err) => console.error('Error general:', err))
  .finally(() => prisma.$disconnect());
