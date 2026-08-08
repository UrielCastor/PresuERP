const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== REPARACIÓN DE DATOS Y VERIFICACIÓN COMPLETA ===\n');

  // Find all SALE movements that are NOT settled but their corresponding sale is REFUNDED
  const unsettledSaleMovements = await prisma.customerAccountMovement.findMany({
    where: {
      type: 'SALE',
      isSettled: false,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Movimientos SALE no liquidados: ${unsettledSaleMovements.length}`);

  for (const mov of unsettledSaleMovements) {
    if (!mov.referenceId) continue;
    
    // Check if corresponding sale is REFUNDED
    const sale = await prisma.sale.findUnique({
      where: { id: mov.referenceId },
      select: { id: true, documentNumber: true, status: true, totalAmount: true }
    });

    if (sale && (sale.status === 'REFUNDED')) {
      console.log(`\n⚠️  INCONSISTENCIA DETECTADA:`);
      console.log(`   Sale: TICKET-${sale.documentNumber} | status: ${sale.status} | total: $${Number(sale.totalAmount)}`);
      console.log(`   Movement id: ${mov.id} | remainingAmount: $${Number(mov.remainingAmount)} | isSettled: ${mov.isSettled}`);
      
      // Fix the movement
      console.log(`   → REPARANDO: Actualizando isSettled=true, remainingAmount=0...`);
      await prisma.customerAccountMovement.update({
        where: { id: mov.id },
        data: {
          remainingAmount: 0,
          isSettled: true,
          settledAt: new Date(),
        }
      });
      console.log(`   ✅ REPARADO`);
    } else if (sale && sale.status === 'PARTIAL_REFUND') {
      // For partial refunds, check if remainingAmount is correct
      const refunds = await prisma.saleRefund.findMany({
        where: { saleId: sale.id, status: 'COMPLETED' }
      });
      const totalRefunded = refunds.reduce((acc, r) => acc + Number(r.totalAmount), 0);
      const correctRemaining = Math.max(0, Number(sale.totalAmount) - totalRefunded);
      
      if (Math.abs(Number(mov.remainingAmount) - correctRemaining) > 0.01) {
        console.log(`\n⚠️  INCONSISTENCIA PARCIAL:`);
        console.log(`   Sale: TICKET-${sale.documentNumber} | status: PARTIAL_REFUND`);
        console.log(`   Total sale: $${Number(sale.totalAmount)} | Total refunded: $${totalRefunded}`);
        console.log(`   Expected remaining: $${correctRemaining} | Actual remaining: $${Number(mov.remainingAmount)}`);
        // Don't auto-fix partial refunds here, just report
      } else {
        console.log(`\n✅ PARTIAL_REFUND OK: TICKET-${sale.documentNumber} remaining=$${Number(mov.remainingAmount)}`);
      }
    } else {
      console.log(`\n✅ SALE MOVEMENT OK: TICKET-${sale?.documentNumber || '?'} | status: ${sale?.status || 'NOT FOUND'} | isSettled: ${mov.isSettled} | remaining: $${Number(mov.remainingAmount)}`);
    }
  }

  // Final state check
  console.log('\n=== ESTADO FINAL PARA CLIENTE URIEL ===');
  const customer = await prisma.customer.findFirst({
    where: { name: 'Uriel' },
    select: { id: true, name: true, currentDebt: true }
  });
  
  if (customer) {
    const allMovements = await prisma.customerAccountMovement.findMany({
      where: { customerId: customer.id },
    });
    const pendingMovements = allMovements.filter(m => m.type === 'SALE' && !m.isSettled && Number(m.remainingAmount) > 0);
    const calculatedDebt = pendingMovements.reduce((acc, m) => acc + Number(m.remainingAmount), 0);
    
    console.log(`Customer.currentDebt: $${Number(customer.currentDebt)}`);
    console.log(`Movimientos SALE pendientes: ${pendingMovements.length}`);
    console.log(`Deuda calculada por frontend: $${calculatedDebt}`);
    
    if (Math.abs(calculatedDebt - Number(customer.currentDebt)) > 0.01) {
      console.log('⚠️  Customer.currentDebt difiere de la deuda calculada. Sincronizando...');
      await prisma.customer.update({
        where: { id: customer.id },
        data: { currentDebt: calculatedDebt }
      });
      console.log(`✅ Customer.currentDebt actualizado a $${calculatedDebt}`);
    } else {
      console.log('✅ Customer.currentDebt es consistente con los movimientos.');
    }
    
    if (pendingMovements.length === 0) {
      console.log('\n✅ RESULTADO ESPERADO: Deuda = $0');
    } else {
      console.log('\n📋 Deudas pendientes reales:');
      pendingMovements.forEach(m => {
        console.log(`   - ${m.description}: $${Number(m.remainingAmount)}`);
      });
    }
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
