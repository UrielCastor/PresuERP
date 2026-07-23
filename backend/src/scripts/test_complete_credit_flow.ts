import { prisma } from '../config/db';
import { CustomerService } from '../services/customer.service';
import { SaleService } from '../services/sale.service';
import { CashService, calculateSessionTotals } from '../services/cash.service';
import { PaymentAdjustmentRuleService } from '../services/payment-adjustment-rule.service';

async function runCompleteCreditFlowTest() {
  console.log('=== TEST INTEGRAL COMPLETO: CUENTA CORRIENTE, CAJA, REGLAS Y ARQUEO Z ===\n');

  const customerService = new CustomerService();
  const saleService = new SaleService();
  const cashService = new CashService();
  const ruleService = new PaymentAdjustmentRuleService();

  const business = await prisma.business.findFirst({ where: { isActive: true } });
  if (!business) throw new Error('No business found');

  const user = await prisma.user.findFirst({ where: { businessId: business.id } });
  if (!user) throw new Error('No user found');

  const warehouse = await prisma.warehouse.findFirst({ where: { businessId: business.id } });
  if (!warehouse) throw new Error('No warehouse found');

  const product = await prisma.product.findFirst({ where: { businessId: business.id, status: 'ACTIVE' } });
  if (!product) throw new Error('No product found');

  let session = await prisma.cashSession.findFirst({ where: { businessId: business.id, status: 'OPEN' } });
  if (!session) {
    const register = await prisma.cashRegister.findFirst({ where: { businessId: business.id, isActive: true } });
    if (register) {
      session = await prisma.cashSession.create({
        data: {
          businessId: business.id,
          cashRegisterId: register.id,
          openedById: user.id,
          openingBalance: 1000,
          status: 'OPEN',
        },
      });
    }
  }

  let pm = await prisma.paymentMethod.findFirst({ where: { businessId: business.id } });
  if (!pm) {
    pm = await prisma.paymentMethod.create({ data: { businessId: business.id, name: 'Efectivo', type: 'CASH' } });
  }
  const pmId = pm.id;
  const docType = await prisma.documentType.findFirst({ where: { businessId: business.id } });

  // 0. Configurar Reglas de Ajuste de Pago (Mercado Pago: 5% Descuento, Crédito: 10% Recargo)
  await ruleService.upsertRule(business.id, {
    paymentMethod: 'MERCADO_PAGO',
    adjustmentType: 'DISCOUNT',
    valueType: 'PERCENTAGE',
    value: 5,
    active: true,
  });

  await ruleService.upsertRule(business.id, {
    paymentMethod: 'CREDIT_CARD',
    adjustmentType: 'SURCHARGE',
    valueType: 'PERCENTAGE',
    value: 10,
    active: true,
  });

  console.log('✅ 0. Reglas de Ajuste de Pago configuradas (MP: -5%, Crédito: +10%)');

  // 1. Crear Cliente Nicole Oviedo con Cuenta Corriente ($500.000 de Límite)
  const customer = await customerService.createCustomer(business.id, {
    name: `Nicole Oviedo ${Date.now()}`,
    type: 'PERSON',
    document: `DNI-${Math.floor(Math.random() * 100000000)}`,
    allowCreditAccount: true,
    creditLimit: 500000,
  });
  console.log('✅ 1. Cliente creado:', customer.name, '| Límite:', customer.creditLimit);

  // 2. Venta POS en Cuenta Corriente ($200.000)
  const sale = await saleService.create(business.id, user.id, {
    warehouseId: warehouse.id,
    customerId: customer.id,
    cashSessionId: session?.id,
    documentTypeId: docType?.id,
    subtotal: 200000,
    totalAmount: 200000,
    items: [{ productId: product.id, quantity: 1, unitPrice: 200000, totalAmount: 200000 }],
    payments: [{ paymentMethodId: pmId, amount: 200000, details: 'CREDIT_ACCOUNT' }],
  });
  console.log('✅ 2. Venta en Cta. Cte. realizada ($200.000). Comprobante:', sale.documentNumber);

  const customerAfterSale = await customerService.getCustomerById(customer.id, business.id);
  console.log('   -> Deuda acumulada tras venta:', customerAfterSale.currentDebt);

  // 3. Registrar Pago 1: Efectivo CASH ($10.000)
  const p1 = await customerService.registerAccountPayment(
    customer.id,
    business.id,
    { amount: 10000, paymentMethod: 'CASH', description: 'Pago parcial efectivo' },
    user.id
  );
  console.log('✅ 3. Cobro 1 (Efectivo $10.000) registrado. Deuda restante:', p1.newDebt);

  // 4. Registrar Pago 2: Transferencia TRANSFER ($20.000)
  const p2 = await customerService.registerAccountPayment(
    customer.id,
    business.id,
    { amount: 20000, paymentMethod: 'TRANSFER', description: 'Pago parcial transferencia' },
    user.id
  );
  console.log('✅ 4. Cobro 2 (Transferencia $20.000) registrado. Deuda restante:', p2.newDebt);

  // 5. Registrar Pago 3: Mercado Pago MERCADO_PAGO ($50.000 con 5% descuento => paga $47.500)
  const p3 = await customerService.registerAccountPayment(
    customer.id,
    business.id,
    { amount: 50000, paymentMethod: 'MERCADO_PAGO', description: 'Pago parcial Mercado Pago' },
    user.id
  );
  console.log('✅ 5. Cobro 3 (Mercado Pago con -5% Descuento) registrado:');
  console.log('   - Deuda reducida:', p3.debtAmount, '| Monto cobrado en MP:', p3.paidAmount, '| Descuento:', p3.adjustmentAmount);

  // 6. Registrar Pago 4: Débito DEBIT_CARD ($15.000)
  const p4 = await customerService.registerAccountPayment(
    customer.id,
    business.id,
    { amount: 15000, paymentMethod: 'DEBIT_CARD', description: 'Pago parcial débito' },
    user.id
  );
  console.log('✅ 6. Cobro 4 (Débito $15.000) registrado. Deuda restante:', p4.newDebt);

  // 7. Registrar Pago 5: Crédito CREDIT_CARD ($30.000 con 10% recargo => paga $33.000)
  const p5 = await customerService.registerAccountPayment(
    customer.id,
    business.id,
    { amount: 30000, paymentMethod: 'CREDIT_CARD', description: 'Pago parcial crédito' },
    user.id
  );
  console.log('✅ 7. Cobro 5 (Crédito con +10% Recargo) registrado:');
  console.log('   - Deuda reducida:', p5.debtAmount, '| Monto cobrado en Crédito:', p5.paidAmount, '| Recargo:', p5.adjustmentAmount);

  // 8. Verificar Arqueo Z y Medios de Pago en CashSession
  const activeSessionDetails = await prisma.cashSession.findFirst({
    where: { id: session?.id },
    include: { cashMovements: true }
  });

  const totalsZ = calculateSessionTotals(activeSessionDetails);
  console.log('\n📊 8. VERIFICACIÓN DE ARQUEO Z FINANCIERO:');
  console.log('   - Total Efectivo (cashTotal):', totalsZ.cashTotal);
  console.log('   - Total Mercado Pago (mercadoPagoTotal):', totalsZ.mercadoPagoTotal);
  console.log('   - Total Transferencia (transferTotal):', totalsZ.transferTotal);
  console.log('   - Total Débito (debitCardTotal):', totalsZ.debitCardTotal);
  console.log('   - Total Crédito (creditCardTotal):', totalsZ.creditCardTotal);
  console.log('   - Gran Total Esperado en Caja (grandTotal):', totalsZ.grandTotal);

  if (
    totalsZ.cashTotal < 10000 ||
    totalsZ.transferTotal < 20000 ||
    totalsZ.mercadoPagoTotal < 47500 ||
    totalsZ.debitCardTotal < 15000 ||
    totalsZ.creditCardTotal < 33000
  ) {
    throw new Error('❌ Error: El Cierre Z no contabilizó correctamente los cobros por medio de pago.');
  }

  // 9. Verificar Movimientos en la Línea de Tiempo de Caja
  const movements = activeSessionDetails?.cashMovements || [];
  const creditMovements = movements.filter((m) => m.referenceType === 'ACCOUNT_RECEIVABLE_PAYMENT');
  console.log('\n⏱️ 9. VERIFICACIÓN DE LÍNEA DE TIEMPO DE CAJA:');
  console.log('   - Movimientos de cobro en línea de tiempo:', creditMovements.length);
  creditMovements.forEach((m) => {
    console.log(`     🔹 [${m.paymentMethod}] ${m.reason} => +$${m.amount}`);
  });

  if (creditMovements.length < 5) {
    throw new Error('❌ Error: No se registraron los 5 movimientos de cobro en la caja.');
  }

  console.log('\n🎉 ¡TODAS LAS VALIDACIONES Y PRUEBAS DE LA AUDITORÍA PASARON CON ÉXITO ABSOLUTO!');
}

runCompleteCreditFlowTest()
  .catch((err) => {
    console.error('❌ Error durante la prueba integral:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
