import { prisma } from '../config/db';
import { CashService } from '../services/cash.service';
import { SaleService } from '../services/sale.service';

const cashService = new CashService();
const saleService = new SaleService();

async function runTest() {
  console.log('--- TEST DESGLOSE MEDIOS DE PAGO EN ARQUEO DE CAJA ---');

  const business = await prisma.business.findFirst();
  if (!business) {
    console.error('No business found');
    return;
  }

  const user = await prisma.user.findFirst({ where: { businessId: business.id } });
  if (!user) {
    console.error('No user found');
    return;
  }

  const product = await prisma.product.findFirst({ where: { businessId: business.id } });
  if (!product) {
    console.error('No product found');
    return;
  }

  const warehouse = await prisma.warehouse.findFirst({ where: { businessId: business.id } });
  if (!warehouse) {
    console.error('No warehouse found');
    return;
  }

  let register = await prisma.cashRegister.findFirst({ where: { businessId: business.id } });
  if (!register) {
    register = await prisma.cashRegister.create({
      data: {
        businessId: business.id,
        name: 'Caja Test',
        code: 'CAJA-TEST-' + Date.now(),
      }
    });
  }

  // Close active session if any
  const active = await prisma.cashSession.findFirst({ where: { businessId: business.id, status: 'OPEN' } });
  if (active) {
    await prisma.cashSession.update({
      where: { id: active.id },
      data: { status: 'CLOSED', closedAt: new Date() }
    });
  }

  // 1. Abrir caja con $500
  const session = await cashService.openSession({
    businessId: business.id,
    userId: user.id,
    cashRegisterId: register.id,
    openingBalance: 500,
    notes: 'Prueba 5 Medios de Pago'
  });
  console.log('Caja abierta exitosamente. ID:', session.id, 'OpeningBalance: $500');

  // Buscar o crear PaymentMethods
  const getOrCreatePM = async (name: string, type: string) => {
    let pm = await prisma.paymentMethod.findFirst({ where: { businessId: business.id, type } });
    if (!pm) {
      pm = await prisma.paymentMethod.create({
        data: { businessId: business.id, name, type }
      });
    }
    return pm;
  };

  const pmCash = await getOrCreatePM('Efectivo', 'CASH');
  const pmMP = await getOrCreatePM('Mercado Pago', 'DIGITAL_WALLET');
  const pmTransfer = await getOrCreatePM('Transferencia Bancaria', 'TRANSFER');
  const pmDebit = await getOrCreatePM('Tarjeta Débito', 'CARD');
  const pmCredit = await getOrCreatePM('Tarjeta Crédito', 'CARD');

  const testCases = [
    { methodId: pmCash.id, details: 'CASH', amount: 1000, label: 'Efectivo' },
    { methodId: pmMP.id, details: 'MERCADO_PAGO', amount: 2000, label: 'Mercado Pago' },
    { methodId: pmTransfer.id, details: 'TRANSFER', amount: 3000, label: 'Transferencia' },
    { methodId: pmDebit.id, details: 'DEBIT_CARD', amount: 4000, label: 'Débito' },
    { methodId: pmCredit.id, details: 'CREDIT_CARD', amount: 5000, label: 'Crédito' },
  ];

  // 2. Crear 5 ventas (una por medio)
  for (const tc of testCases) {
    const sale = await saleService.create(
      business.id,
      user.id,
      {
        cashSessionId: session.id,
        warehouseId: warehouse.id,
        subtotal: tc.amount,
        totalAmount: tc.amount,
        discountType: 'NONE',
        discountValue: 0,
        discountAmount: 0,
        surchargeType: 'NONE',
        surchargeValue: 0,
        surchargeAmount: 0,
        items: [
          {
            productId: product.id,
            quantity: 1,
            unitPrice: tc.amount,
            totalAmount: tc.amount,
          }
        ],
        payments: [
          {
            paymentMethodId: tc.methodId,
            amount: tc.amount,
            details: tc.details,
          }
        ]
      }
    );
    console.log(`Venta creada (${tc.label}): $${tc.amount} -> Venta ID: ${sale.id}`);
  }

  // 3. Consultar arqueo / sesión activa
  const activeSessionDetails = await cashService.getActiveSession(business.id, user.id);
  const totals = activeSessionDetails?.totals;

  console.log('\n================ RESUMEN DE ARQUEO ================');
  console.log('Saldo Inicial (Efectivo):', totals?.openingBalance);
  console.log('Efectivo Ventas:', totals?.cashTotal);
  console.log('Saldo Esperado Caja Física (Inicial + Efectivo):', totals?.expectedCashBalance);
  console.log('Mercado Pago:', totals?.mercadoPagoTotal);
  console.log('Transferencia:', totals?.transferTotal);
  console.log('Tarjeta Débito:', totals?.debitCardTotal);
  console.log('Tarjeta Crédito:', totals?.creditCardTotal);
  console.log('TOTAL GENERAL ARQUEO:', totals?.grandTotal);
  console.log('===================================================\n');

  let passed = true;
  if (totals?.cashTotal !== 1000) { console.error('FAIL: cashTotal expected 1000, got', totals?.cashTotal); passed = false; }
  if (totals?.mercadoPagoTotal !== 2000) { console.error('FAIL: mercadoPagoTotal expected 2000, got', totals?.mercadoPagoTotal); passed = false; }
  if (totals?.transferTotal !== 3000) { console.error('FAIL: transferTotal expected 3000, got', totals?.transferTotal); passed = false; }
  if (totals?.debitCardTotal !== 4000) { console.error('FAIL: debitCardTotal expected 4000, got', totals?.debitCardTotal); passed = false; }
  if (totals?.creditCardTotal !== 5000) { console.error('FAIL: creditCardTotal expected 5000, got', totals?.creditCardTotal); passed = false; }
  if (totals?.expectedCashBalance !== 1500) { console.error('FAIL: expectedCashBalance expected 1500 (500+1000), got', totals?.expectedCashBalance); passed = false; }

  if (passed) {
    console.log('✅ TODAS LAS PRUEBAS DE ARQUEO SEPARADO POR MEDIO DE PAGO PASARON EXITOSAMENTE!');
  } else {
    console.error('❌ ALGUNAS PRUEBAS FALLARON');
  }

  await prisma.$disconnect();
}

runTest().catch((e) => {
  console.error(e);
  prisma.$disconnect();
});
