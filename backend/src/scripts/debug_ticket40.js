const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== DIAGNÓSTICO TICKET-40 ===\n');

  // 1. Buscar la venta TICKET-40
  const sale = await prisma.sale.findFirst({
    where: { documentNumber: 40 },
    include: {
      customer: true,
      payments: { include: { paymentMethod: true } },
      refunds: { include: { items: true } },
      documentType: true,
    },
  });

  if (!sale) {
    console.log('❌ Venta con documentNumber=40 no encontrada.');
    const sales = await prisma.sale.findMany({
      include: {
        customer: { select: { id: true, name: true } },
        payments: { include: { paymentMethod: true } },
        refunds: { select: { id: true, status: true, totalAmount: true } },
        documentType: { select: { code: true } },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    console.log('Últimas 10 ventas:', JSON.stringify(sales.map(s => ({
      id: s.id,
      documentNumber: s.documentNumber,
      docType: s.documentType?.code,
      status: s.status,
      total: Number(s.total),
      customerId: s.customerId,
      customerName: s.customer?.name,
      paymentDetails: s.payments.map(p => ({ details: p.details, amount: Number(p.amount), pmType: p.paymentMethod?.type })),
      refunds: s.refunds.map(r => ({ status: r.status, totalAmount: Number(r.totalAmount) })),
    })), null, 2));
    await prisma.$disconnect();
    return;
  }

  console.log('=== SALE ===');
  console.log(JSON.stringify({
    id: sale.id,
    documentNumber: sale.documentNumber,
    status: sale.status,
    total: Number(sale.total),
    customerId: sale.customerId,
    customerName: sale.customer?.name,
    payments: sale.payments.map(p => ({
      details: p.details,
      amount: Number(p.amount),
      pmType: p.paymentMethod?.type,
    })),
    refunds: sale.refunds.map(r => ({
      id: r.id,
      status: r.status,
      totalAmount: Number(r.totalAmount),
      paymentMethod: r.paymentMethod,
    })),
  }, null, 2));

  if (!sale.customerId) {
    console.log('❌ La venta no tiene customerId.');
    await prisma.$disconnect();
    return;
  }

  const customer = await prisma.customer.findUnique({
    where: { id: sale.customerId },
    select: { id: true, name: true, currentDebt: true, creditLimit: true, allowCreditAccount: true },
  });

  console.log('\n=== CUSTOMER ===');
  console.log(JSON.stringify({
    id: customer?.id,
    name: customer?.name,
    currentDebt: Number(customer?.currentDebt),
    creditLimit: Number(customer?.creditLimit),
    allowCreditAccount: customer?.allowCreditAccount,
  }, null, 2));

  const movements = await prisma.customerAccountMovement.findMany({
    where: { customerId: sale.customerId },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n=== CUSTOMER ACCOUNT MOVEMENTS ===');
  if (movements.length === 0) {
    console.log('❌ No hay movimientos de cuenta corriente.');
  } else {
    movements.forEach(m => {
      console.log(JSON.stringify({
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        remainingAmount: Number(m.remainingAmount),
        isSettled: m.isSettled,
        referenceId: m.referenceId,
        description: m.description,
        createdAt: m.createdAt,
      }));
    });

    const pendingMovements = movements.filter(m => m.type === 'SALE' && !m.isSettled && Number(m.remainingAmount) > 0);
    const calculatedDebt = pendingMovements.reduce((acc, m) => acc + Number(m.remainingAmount !== null ? m.remainingAmount : m.amount), 0);
    
    console.log('\n=== CÁLCULO ===');
    console.log(`Movimientos SALE no liquidados: ${pendingMovements.length}`);
    console.log(`Deuda calculada desde movimientos: $${calculatedDebt}`);
    console.log(`Customer.currentDebt en DB: $${Number(customer?.currentDebt)}`);
    
    if (Math.abs(calculatedDebt - Number(customer?.currentDebt)) > 0.01) {
      console.log('⚠️  INCONSISTENCIA detectada entre Customer.currentDebt y movimientos!');
    } else {
      console.log('✅ Consistente.');
    }
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
