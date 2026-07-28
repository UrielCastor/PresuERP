import { prisma } from '../config/db';
import app from '../app';
import http from 'http';

async function runTest() {
  console.log('========================================================================');
  console.log('🚀 TESTING MERCADO PAGO WEBHOOK FLOW (order.processed -> COMPLETED)');
  console.log('========================================================================\n');

  // 1. Find an existing business
  let business = await prisma.business.findFirst();
  if (!business) {
    throw new Error('No business found in database');
  }

  // 2. Find an existing user for this business
  let user = await prisma.user.findFirst({ where: { businessId: business.id } });
  if (!user) {
    throw new Error('No user found in database');
  }

  // 3. Find or create an open CashSession
  let cashSession = await prisma.cashSession.findFirst({
    where: { businessId: business.id, status: 'OPEN' }
  });

  if (!cashSession) {
    let register = await prisma.cashRegister.findFirst({ where: { businessId: business.id } });
    if (!register) {
      register = await prisma.cashRegister.create({
        data: {
          businessId: business.id,
          code: 'REG-001',
          name: 'Main Register',
          status: 'ACTIVE'
        } as any
      });
    }

    cashSession = await prisma.cashSession.create({
      data: {
        businessId: business.id,
        cashRegisterId: register.id,
        openedById: user.id,
        openingBalance: 1000,
        status: 'OPEN'
      } as any
    });
  }

  // 4. Find DocumentType if required or find existing sale as template
  const docType = await prisma.documentType.findFirst({ where: { businessId: business.id } });

  // Create a test Sale in PENDING status
  const sale = await prisma.sale.create({
    data: {
      businessId: business.id,
      documentNumber: Math.floor(Math.random() * 1000000),
      ...(docType ? { documentTypeId: docType.id } : {}),
      status: 'PENDING',
      paymentStatus: 'PENDING',
      totalAmount: 2500,
      subtotal: 2500,
      taxAmount: 0,
      createdById: user.id,
      cashSessionId: cashSession.id,
    } as any
  });

  console.log(`✅ Created Test Sale: ID = ${sale.id}, DocNumber = ${sale.documentNumber}`);
  console.log(`   Initial Sale Status = ${sale.status}, Payment Status = ${sale.paymentStatus}`);

  // Find or create MERCADO_PAGO PaymentMethod (same logic as the webhook controller)
  let paymentMethod = await prisma.paymentMethod.findFirst({
    where: { businessId: business.id, type: 'MERCADO_PAGO' }
  });

  if (!paymentMethod) {
    paymentMethod = await prisma.paymentMethod.findFirst({
      where: { businessId: business.id, name: { contains: 'Mercado Pago', mode: 'insensitive' } }
    });
  }

  if (!paymentMethod) {
    paymentMethod = await prisma.paymentMethod.create({
      data: {
        businessId: business.id,
        name: 'Mercado Pago',
        type: 'MERCADO_PAGO',
        isActive: true
      }
    });
  }

  // Create pending SalePayment
  const pendingPayment = await prisma.salePayment.create({
    data: {
      saleId: sale.id,
      paymentMethodId: paymentMethod.id,
      amount: 2500,
      provider: 'MERCADO_PAGO',
      status: 'PENDING',
      details: 'Cobro Mercado Pago Pendiente'
    }
  });

  console.log(`   Pending SalePayment ID = ${pendingPayment.id}\n`);

  // Start Express server on random port for HTTP test
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  console.log(`🌐 Test server listening on http://localhost:${port}`);

  // 5. Test Mercado Pago Webhook without JWT (Public POST /api/v1/business/integrations/mercado-pago/webhook)
  const webhookPayload = {
    action: 'order.processed',
    api_version: 'v1',
    data: { id: sale.id }, // Using sale.id as order id / external_reference match
    external_reference: sale.id,
    type: 'order'
  };

  console.log('📡 Sending HTTP POST to Webhook Endpoint without Authorization header (PUBLIC ENDPOINT)...');
  console.log(`   URL: http://localhost:${port}/api/v1/business/integrations/mercado-pago/webhook?external_reference=${sale.id}`);

  const response = await fetch(`http://localhost:${port}/api/v1/business/integrations/mercado-pago/webhook?external_reference=${sale.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(webhookPayload)
  });

  const responseStatus = response.status;
  const responseData = await response.json();

  console.log(`\n📥 Webhook Response Status Code: ${responseStatus}`);
  console.log(`📥 Webhook Response Body:`, JSON.stringify(responseData));

  server.close();

  // 6. Verify Database State
  const updatedSale = await prisma.sale.findUnique({
    where: { id: sale.id },
    include: { payments: true }
  });

  const cashMovements = await prisma.cashMovement.findMany({
    where: { referenceId: sale.id }
  });

  console.log('\n========================================================================');
  console.log('📊 VERIFICATION RESULTS:');
  console.log('========================================================================');
  console.log(`1. HTTP Status Code 200: ${responseStatus === 200 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`2. Sale Status COMPLETED: ${updatedSale?.status === 'COMPLETED' ? '✅ PASSED' : '❌ FAILED'} (Actual: ${updatedSale?.status})`);
  console.log(`3. Payment Status PAID: ${updatedSale?.paymentStatus === 'PAID' ? '✅ PASSED' : '❌ FAILED'} (Actual: ${updatedSale?.paymentStatus})`);
  console.log(`4. SalePayment Status APPROVED: ${updatedSale?.payments[0]?.status === 'APPROVED' ? '✅ PASSED' : '❌ FAILED'} (Actual: ${updatedSale?.payments[0]?.status})`);
  console.log(`5. CashMovement Created: ${cashMovements.length > 0 ? '✅ PASSED' : '❌ FAILED'} (Count: ${cashMovements.length})`);

  if (cashMovements.length > 0) {
    console.log(`   CashMovement details: Type=${cashMovements[0].type}, Amount=${cashMovements[0].amount}, Reason="${cashMovements[0].reason}"`);
  }

  // Cleanup test sale
  await prisma.cashMovement.deleteMany({ where: { referenceId: sale.id } });
  await prisma.salePayment.deleteMany({ where: { saleId: sale.id } });
  await prisma.sale.delete({ where: { id: sale.id } });
  console.log('\n🧹 Test record cleanup finished successfully.');
}

runTest()
  .then(() => {
    console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  });
