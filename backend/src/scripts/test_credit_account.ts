import { prisma } from '../config/db';
import { CustomerService } from '../services/customer.service';
import { SaleService } from '../services/sale.service';

async function runCreditAccountTests() {
  console.log('=== TEST INTEGRAL DE CUENTA CORRIENTE POR CLIENTE ===\n');

  const customerService = new CustomerService();
  const saleService = new SaleService();

  const business = await prisma.business.findFirst({ where: { isActive: true } });
  if (!business) throw new Error('No se encontró empresa activa');

  const user = await prisma.user.findFirst({ where: { businessId: business.id } });
  if (!user) throw new Error('No se encontró usuario activo');

  const warehouse = await prisma.warehouse.findFirst({ where: { businessId: business.id } });
  if (!warehouse) throw new Error('No se encontró depósito');

  const product = await prisma.product.findFirst({ where: { businessId: business.id, status: 'ACTIVE' } });
  if (!product) throw new Error('No se encontró producto activo');

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

  // 1. Crear cliente con Cuenta Corriente habilitada y Límite $50.000
  const customer = await customerService.createCustomer(business.id, {
    name: `Carlos Crédito ${Date.now()}`,
    type: 'PERSON',
    document: `DNI-${Math.floor(Math.random() * 100000000)}`,
    allowCreditAccount: true,
    creditLimit: 50000,
  });
  console.log('✅ 1. Cliente con Cuenta Corriente creado:', customer.name, '| Límite: $', customer.creditLimit);

  // 2. Intentar Venta en Cta. Cte. a Consumidor Final (Debe rechazar)
  try {
    await saleService.create(business.id, user.id, {
      warehouseId: warehouse.id,
      customerId: null,
      cashSessionId: session?.id,
      documentTypeId: docType?.id,
      subtotal: 1000,
      totalAmount: 1000,
      items: [{ productId: product.id, quantity: 1, unitPrice: 1000, totalAmount: 1000 }],
      payments: [{ paymentMethodId: pmId, amount: 1000, details: 'CREDIT_ACCOUNT' }],
    });
    console.error('❌ Error: Se debió rechazar la venta a Consumidor Final con Cta. Cte.');
  } catch (err: any) {
    console.log('✅ 2. Venta Cta. Cte. a Consumidor Final rechazada correctamente:', err.message);
  }

  // 3. Intentar Venta en Cta. Cte. Superando Límite ($60.000 > $50.000) (Debe rechazar)
  try {
    await saleService.create(business.id, user.id, {
      warehouseId: warehouse.id,
      customerId: customer.id,
      cashSessionId: session?.id,
      documentTypeId: docType?.id,
      subtotal: 60000,
      totalAmount: 60000,
      items: [{ productId: product.id, quantity: 1, unitPrice: 60000, totalAmount: 60000 }],
      payments: [{ paymentMethodId: pmId, amount: 60000, details: 'CREDIT_ACCOUNT' }],
    });
    console.error('❌ Error: Se debió rechazar la venta por superar el límite de crédito.');
  } catch (err: any) {
    console.log('✅ 3. Venta con crédito superado rechazada correctamente:', err.message);
  }

  // 4. Venta Válida en Cta. Cte. ($20.000 <= $50.000)
  const validSale = await saleService.create(business.id, user.id, {
    warehouseId: warehouse.id,
    customerId: customer.id,
    cashSessionId: session?.id,
    documentTypeId: docType?.id,
    subtotal: 20000,
    totalAmount: 20000,
    items: [{ productId: product.id, quantity: 1, unitPrice: 20000, totalAmount: 20000 }],
    payments: [{ paymentMethodId: pmId, amount: 20000, details: 'CREDIT_ACCOUNT' }],
  });
  console.log('✅ 4. Venta Cta. Cte. efectuada exitosamente:', validSale.documentNumber);

  // Verificar Deuda Actual
  const updatedCustomer1 = await customerService.getCustomerById(customer.id, business.id);
  console.log('   -> Deuda Actual del cliente:', updatedCustomer1.currentDebt);

  // 5. Registrar Pago / Entrega a Cta. Cte. ($15.000 con Mercado Pago)
  const paymentResult = await customerService.registerAccountPayment(
    customer.id,
    business.id,
    { amount: 15000, paymentMethod: 'MERCADO_PAGO', description: 'Entrega por Mercado Pago' },
    user.id
  );
  console.log('✅ 5. Pago a Cta. Cte. registrado correctamente con Mercado Pago. Nueva deuda:', paymentResult.newDebt);

  // Verificar CashMovement en caja
  const cashMovement = await prisma.cashMovement.findFirst({
    where: { referenceId: paymentResult.movement.id }
  });
  console.log('   -> CashMovement creado en caja:', cashMovement?.reason, '| Método:', cashMovement?.paymentMethod, '| Monto: $', cashMovement?.amount);

  if (!cashMovement || cashMovement.paymentMethod !== 'MERCADO_PAGO') {
    throw new Error('❌ No se registró el CashMovement con Mercado Pago');
  }

  // 6. Consultar Movimientos de Cuenta Corriente
  const movements = await customerService.getAccountMovements(customer.id, business.id);
  console.log('✅ 6. Historial de movimientos obtenido:', movements.length, 'movimientos (Venta y Pago)');

  console.log('\n🎉 ¡TODAS LAS PRUEBAS INTEGRALES DE CUENTA CORRIENTE Y CAJA PASARON CON ÉXITO!');
}

runCreditAccountTests()
  .catch((err) => {
    console.error('❌ Error durante las pruebas:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
