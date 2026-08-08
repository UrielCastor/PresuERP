/**
 * Script de diagnóstico para TICKET-40
 * Inspecciona el estado real en PostgreSQL
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== DIAGNÓSTICO TICKET-40 ===\n');

  // 1. Buscar la venta TICKET-40
  const sale = await prisma.sale.findFirst({
    where: {
      documentNumber: 40,
    },
    include: {
      customer: true,
      payments: { include: { paymentMethod: true } },
      refunds: { include: { items: true } },
      documentType: true,
    },
  });

  if (!sale) {
    console.log('❌ Venta con documentNumber=40 no encontrada.');
    console.log('Buscando por código de ticket...');
    const sales = await prisma.sale.findMany({
      where: {
        OR: [
          { documentNumber: 40 },
        ]
      },
      include: {
        customer: true,
        payments: { include: { paymentMethod: true } },
        refunds: { include: { items: true } },
        documentType: true,
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });
    console.log('Últimas 5 ventas:', JSON.stringify(sales.map(s => ({
      id: s.id,
      documentNumber: s.documentNumber,
      status: s.status,
      total: Number((s as any).totalAmount),
      customerId: s.customerId,
      paymentMethod: s.payments.map(p => p.details),
    })), null, 2));
    await prisma.$disconnect();
    return;
  }

  console.log('=== SALE ===');
  console.log({
    id: sale.id,
    documentNumber: sale.documentNumber,
    status: sale.status,
    totalAmount: Number(sale.totalAmount),
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
  });

  if (!sale.customerId) {
    console.log('❌ La venta no tiene customerId asignado.');
    await prisma.$disconnect();
    return;
  }

  // 2. Customer
  const customer = await prisma.customer.findUnique({
    where: { id: sale.customerId },
    select: { id: true, name: true, currentDebt: true, creditLimit: true, allowCreditAccount: true },
  });

  console.log('\n=== CUSTOMER ===');
  console.log({
    id: customer?.id,
    name: customer?.name,
    currentDebt: Number(customer?.currentDebt),
    creditLimit: Number(customer?.creditLimit),
    allowCreditAccount: customer?.allowCreditAccount,
  });

  // 3. Account Movements
  const movements = await prisma.customerAccountMovement.findMany({
    where: { customerId: sale.customerId },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n=== CUSTOMER ACCOUNT MOVEMENTS ===');
  if (movements.length === 0) {
    console.log('❌ No hay movimientos de cuenta corriente para este cliente.');
  } else {
    movements.forEach(m => {
      console.log({
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        remainingAmount: Number(m.remainingAmount),
        isSettled: m.isSettled,
        referenceId: m.referenceId,
        description: m.description,
        createdAt: m.createdAt,
      });
    });

    const pendingMovements = movements.filter(m => m.type === 'SALE' && !m.isSettled && Number(m.remainingAmount) > 0);
    const calculatedDebt = pendingMovements.reduce((acc, m) => acc + Number(m.remainingAmount ?? m.amount), 0);
    
    console.log('\n=== CÁLCULO DE DEUDA SEGÚN MOVIMIENTOS ===');
    console.log(`Movimientos SALE no liquidados: ${pendingMovements.length}`);
    console.log(`Deuda calculada desde movimientos: $${calculatedDebt}`);
    console.log(`Customer.currentDebt en DB: $${Number(customer?.currentDebt)}`);
    
    if (Math.abs(calculatedDebt - Number(customer?.currentDebt)) > 0.01) {
      console.log('⚠️  INCONSISTENCIA: la deuda en Customer difiere de la calculada desde movimientos.');
    } else {
      console.log('✅ Consistente: Customer.currentDebt coincide con la suma de movimientos.');
    }
  }

  // 4. Sale Refunds
  console.log('\n=== SALE REFUNDS ===');
  const refunds = await prisma.saleRefund.findMany({
    where: { saleId: sale.id },
    include: { items: true },
  });
  
  if (refunds.length === 0) {
    console.log('❌ No hay devoluciones registradas para esta venta.');
  } else {
    refunds.forEach(r => {
      console.log({
        id: r.id,
        refundCode: r.refundCode,
        status: r.status,
        totalAmount: Number(r.totalAmount),
        paymentMethod: r.paymentMethod,
        createdAt: r.createdAt,
        items: r.items.map(i => ({
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          totalAmount: Number(i.totalAmount),
        })),
      });
    });
  }

  console.log('\n=== RESULTADO ESPERADO ===');
  console.log(`Customer.currentDebt debería ser: $0`);
  console.log(`Customer.currentDebt actual: $${Number(customer?.currentDebt)}`);
  console.log(`Deuda calculada por movimientos: ${movements.filter(m => m.type === 'SALE' && !m.isSettled && Number(m.remainingAmount) > 0).reduce((acc, m) => acc + Number(m.remainingAmount ?? m.amount), 0)}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
