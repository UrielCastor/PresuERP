const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== DIAGNÓSTICO PROFUNDO: businessId mismatch ===\n');

  // Get the sale
  const sale = await prisma.sale.findFirst({
    where: { documentNumber: 44 },
    select: { id: true, documentNumber: true, status: true, businessId: true, customerId: true, totalAmount: true }
  });
  console.log('TICKET-44:', JSON.stringify(sale, null, 2));

  // Get the SALE movement
  const saleMovement = await prisma.customerAccountMovement.findFirst({
    where: { referenceId: sale.id, type: 'SALE' }
  });
  console.log('\nSALE movement:', JSON.stringify({
    id: saleMovement?.id,
    businessId: saleMovement?.businessId,
    customerId: saleMovement?.customerId,
    type: saleMovement?.type,
    amount: Number(saleMovement?.amount),
    remainingAmount: Number(saleMovement?.remainingAmount),
    isSettled: saleMovement?.isSettled,
  }, null, 2));

  // Check businessId match
  if (sale && saleMovement) {
    if (sale.businessId !== saleMovement.businessId) {
      console.log('\n🚨 BUSINESSID MISMATCH!');
      console.log(`   Sale.businessId: ${sale.businessId}`);
      console.log(`   SaleMovement.businessId: ${saleMovement.businessId}`);
      console.log('   This is why findFirst with businessId condition fails to find the movement!');
    } else {
      console.log('\n✅ businessId matches: both have', sale.businessId);
      console.log('   The movement SHOULD have been found. Checking other possible issues...');
      
      // Maybe the code ran BEFORE the saleMovement was created? Check order
      // Or maybe the code is correct now but TICKET-44 was refunded with OLD code
    }
  }

  // Also check the refund record
  const refund = await prisma.saleRefund.findFirst({
    where: { saleId: sale?.id }
  });
  console.log('\nSaleRefund for TICKET-44:', JSON.stringify({
    id: refund?.id,
    status: refund?.status,
    totalAmount: Number(refund?.totalAmount),
    paymentMethod: refund?.paymentMethod,
    createdAt: refund?.createdAt,
  }, null, 2));

  // Check the PAYMENT movement
  const paymentMov = await prisma.customerAccountMovement.findFirst({
    where: { referenceId: refund?.id }
  });
  console.log('\nPAYMENT movement:', JSON.stringify({
    id: paymentMov?.id,
    businessId: paymentMov?.businessId,
    type: paymentMov?.type,
    amount: Number(paymentMov?.amount),
    isSettled: paymentMov?.isSettled,
    description: paymentMov?.description,
    createdAt: paymentMov?.createdAt,
  }, null, 2));

  // Check the Customer currentDebt
  const customer = await prisma.customer.findUnique({
    where: { id: sale?.customerId },
    select: { id: true, name: true, currentDebt: true }
  });
  console.log('\nCustomer:', JSON.stringify({ id: customer?.id, name: customer?.name, currentDebt: Number(customer?.currentDebt) }, null, 2));

  console.log('\n=== CONCLUSION ===');
  console.log('TICKET-44 SALE movement: remainingAmount =', Number(saleMovement?.remainingAmount), ', isSettled =', saleMovement?.isSettled);
  console.log('Customer.currentDebt =', Number(customer?.currentDebt));
  console.log('Frontend calculatedCurrentDebt = SUM(SALE movements where !isSettled) =', Number(saleMovement?.remainingAmount));
  console.log('');
  
  if (!saleMovement?.isSettled && Number(saleMovement?.remainingAmount) > 0) {
    console.log('🔥 ROOT CAUSE CONFIRMED:');
    console.log('   The SALE movement was NOT settled during the refund of TICKET-44.');
    console.log('   The PAYMENT movement was created correctly, but the SALE movement was not updated.');
    console.log('   The frontend uses SALE movements to calculate debt, so it shows $2200 instead of $0.');
    console.log('');
    console.log('📋 FIX NEEDED:');
    console.log('   1. Fix the data: Update SALE movement id', saleMovement?.id, 'to isSettled=true, remainingAmount=0');
    console.log('   2. Fix the code: Ensure processRefund always updates the saleMovement');
    console.log('      regardless of whether findFirst finds it with businessId or without.');
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
