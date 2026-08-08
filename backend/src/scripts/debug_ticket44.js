const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== DIAGNÓSTICO COMPLETO TICKET-44 ===\n');

  // Find TICKET-44 sale
  const sale44 = await prisma.sale.findFirst({
    where: { documentNumber: 44 },
    include: {
      customer: true,
      payments: { include: { paymentMethod: true } },
      refunds: { include: { items: true } },
      documentType: true,
    },
  });

  if (!sale44) {
    console.log('❌ TICKET-44 no encontrada. Intentando buscar por referenceId del movimiento SALE...');
    
    // Find by the referenceId in the SALE movement
    const saleMovement = await prisma.customerAccountMovement.findFirst({
      where: { 
        referenceId: '9a26463d-ed5e-4441-b34f-b96f083fa0b3',
        type: 'SALE'
      }
    });
    console.log('SALE movement encontrado:', JSON.stringify(saleMovement, null, 2));
    
    const sale = await prisma.sale.findUnique({
      where: { id: '9a26463d-ed5e-4441-b34f-b96f083fa0b3' },
      include: {
        customer: true,
        payments: { include: { paymentMethod: true } },
        refunds: { include: { items: true } },
        documentType: true,
      }
    });
    if (sale) {
      console.log('\n=== VENTA (por ID) ===');
      console.log(JSON.stringify({
        id: sale.id,
        documentNumber: sale.documentNumber,
        status: sale.status,
        total: Number(sale.total),
        customerId: sale.customerId,
        customerName: sale.customer?.name,
        paymentDetails: sale.payments.map(p => ({ details: p.details, amount: Number(p.amount) })),
        refunds: sale.refunds.map(r => ({ id: r.id, status: r.status, totalAmount: Number(r.totalAmount), paymentMethod: r.paymentMethod })),
      }, null, 2));
    }
    await prisma.$disconnect();
    return;
  }

  console.log('=== TICKET-44 SALE ===');
  console.log(JSON.stringify({
    id: sale44.id,
    documentNumber: sale44.documentNumber,
    status: sale44.status,
    total: Number(sale44.total),
    customerId: sale44.customerId,
    customerName: sale44.customer?.name,
    payments: sale44.payments.map(p => ({ details: p.details, amount: Number(p.amount), pmType: p.paymentMethod?.type })),
    refunds: sale44.refunds.map(r => ({ id: r.id, status: r.status, totalAmount: Number(r.totalAmount), paymentMethod: r.paymentMethod })),
  }, null, 2));

  // Find the problematic SALE movement
  const saleMov = await prisma.customerAccountMovement.findFirst({
    where: {
      customerId: sale44.customerId,
      type: 'SALE',
      referenceId: sale44.id,
    }
  });

  console.log('\n=== SALE MOVEMENT FOR TICKET-44 ===');
  console.log(JSON.stringify({
    id: saleMov?.id,
    type: saleMov?.type,
    amount: Number(saleMov?.amount),
    remainingAmount: Number(saleMov?.remainingAmount),
    isSettled: saleMov?.isSettled,
    settledAt: saleMov?.settledAt,
    description: saleMov?.description,
    referenceId: saleMov?.referenceId,
  }, null, 2));

  // Find the PAYMENT movement for the refund
  const paymentMov = await prisma.customerAccountMovement.findFirst({
    where: {
      customerId: sale44.customerId,
      type: 'PAYMENT',
      referenceId: '921df8f4-139a-49a2-ac6a-58b901de8165',
    }
  });

  console.log('\n=== PAYMENT/REFUND MOVEMENT FOR TICKET-44 ===');
  console.log(JSON.stringify({
    id: paymentMov?.id,
    type: paymentMov?.type,
    amount: Number(paymentMov?.amount),
    remainingAmount: Number(paymentMov?.remainingAmount),
    isSettled: paymentMov?.isSettled,
    description: paymentMov?.description,
    referenceId: paymentMov?.referenceId,
  }, null, 2));

  console.log('\n=== DIAGNÓSTICO ===');
  if (saleMov && !saleMov.isSettled && Number(saleMov.remainingAmount) > 0) {
    console.log('🚨 BUG CONFIRMADO: El movimiento SALE de TICKET-44 NO fue marcado como isSettled=true ni remainingAmount=0 durante la devolución!');
    console.log('   Esto hace que el frontend calcule la deuda = $2200 aunque Customer.currentDebt = $0');
    console.log('   La fuente de verdad del frontend es los movimientos, NO Customer.currentDebt directamente');
    console.log('\n   SOLUCIÓN: Durante la devolución, el código busca el saleMovement por:');
    console.log('   businessId + customerId + type=SALE + referenceId=sale.id');
    console.log('   Si lo encuentra lo actualiza. Si no lo encuentra, no lo actualiza.');
    console.log('\n   Verificar si en el processRefund de TICKET-44, se encontró el saleMovement...');
  } else if (saleMov && saleMov.isSettled && Number(saleMov.remainingAmount) === 0) {
    console.log('✅ El movimiento SALE está correctamente liquidado.');
    console.log('   El problema puede ser otro movimiento SALE pendiente.');
  }

  console.log('\n=== VERIFICACIÓN DE TICKET-40 ===');
  const sale40 = await prisma.sale.findFirst({
    where: { documentNumber: 40 },
    select: { id: true, documentNumber: true, status: true, total: true, customerId: true }
  });
  console.log(JSON.stringify(sale40, null, 2));

  if (sale40?.customerId) {
    const tick40Movement = await prisma.customerAccountMovement.findFirst({
      where: { customerId: sale40.customerId, type: 'SALE', referenceId: sale40.id }
    });
    console.log('TICKET-40 SALE movement:', JSON.stringify({
      id: tick40Movement?.id,
      isSettled: tick40Movement?.isSettled,
      remainingAmount: Number(tick40Movement?.remainingAmount),
    }, null, 2));
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
