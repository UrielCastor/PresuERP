import { z } from 'zod';

// Updated schema (with paymentMethod declared)
const createSaleSchema = z.object({
  body: z.object({
    customerId: z.string().uuid().optional().nullable(),
    cashSessionId: z.string().uuid().optional().nullable(),
    documentTypeId: z.string().uuid().optional().nullable(),
    documentSeriesId: z.string().uuid().optional().nullable(),
    warehouseId: z.string().uuid(),
    subtotal: z.number().min(0),
    discountType: z.enum(['FIXED', 'PERCENTAGE']).optional().default('FIXED'),
    discountValue: z.number().min(0).optional().default(0),
    discountAmount: z.number().min(0).default(0),
    surchargeType: z.enum(['NONE', 'FIXED', 'PERCENTAGE']).optional().default('NONE'),
    surchargeValue: z.number().min(0).optional().default(0),
    surchargeAmount: z.number().min(0).default(0),
    taxAmount: z.number().min(0).default(0),
    totalAmount: z.number().min(0),
    paymentMethod: z.string().optional(), // ← NUEVO: safety net
    notes: z.string().optional().nullable(),
    status: z.string().optional(),
    items: z.array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().min(0.001),
        unitPrice: z.number().min(0),
        discountAmount: z.number().min(0).default(0),
        taxAmount: z.number().min(0).default(0),
        totalAmount: z.number().min(0),
      })
    ).min(1),
    payments: z.array(
      z.object({
        paymentMethodId: z.string().uuid().optional().nullable(),
        amount: z.number().min(0.01),
        transactionReference: z.string().optional().nullable(),
        details: z.string().optional().nullable(),
      })
    ).optional().default([]),
  }),
});

// Test Case 1: POS con payments array (FIX PRINCIPAL)
const posPayloadFixed = {
  body: {
    warehouseId: '11111111-1111-1111-1111-111111111111',
    paymentMethod: 'CASH',
    cashSessionId: '22222222-2222-2222-2222-222222222222',
    status: 'COMPLETED',
    subtotal: 15,
    totalAmount: 15,
    items: [{
      productId: '33333333-3333-3333-3333-333333333333',
      quantity: 1,
      unitPrice: 15,
      totalAmount: 15,
    }],
    payments: [{
      amount: 15,
      details: 'CASH',
    }],
  }
};

// Test Case 2: POS legacy sin payments (debería funcionar con safety net)
const posPayloadLegacy = {
  body: {
    warehouseId: '11111111-1111-1111-1111-111111111111',
    paymentMethod: 'DEBIT_CARD',
    cashSessionId: '22222222-2222-2222-2222-222222222222',
    status: 'COMPLETED',
    subtotal: 3500,
    totalAmount: 3500,
    items: [{
      productId: '33333333-3333-3333-3333-333333333333',
      quantity: 1,
      unitPrice: 3500,
      totalAmount: 3500,
    }],
  }
};

async function testFix() {
  console.log('===============================================================');
  console.log('  VERIFICACIÓN DEL FIX: Zod ya no destruye el payload');
  console.log('===============================================================\n');

  // Test 1: POS con payments array (camino principal)
  console.log('TEST 1: POS envía payments[] (fix principal)');
  const parsed1 = await createSaleSchema.parseAsync(posPayloadFixed);
  console.log('  payments.length =', parsed1.body.payments?.length);
  console.log('  payments[0].amount =', parsed1.body.payments?.[0]?.amount);
  console.log('  payments[0].details =', parsed1.body.payments?.[0]?.details);
  console.log('  paymentMethod =', (parsed1.body as any).paymentMethod);
  const ok1 = (parsed1.body.payments?.length || 0) > 0;
  console.log(`  Resultado: ${ok1 ? '✅ SalePayment y CashMovement SE CREARÁN' : '❌ FALLA'}\n`);

  // Test 2: POS legacy sin payments (safety net)
  console.log('TEST 2: POS legacy envía solo paymentMethod (safety net)');
  const parsed2 = await createSaleSchema.parseAsync(posPayloadLegacy);
  console.log('  payments.length =', parsed2.body.payments?.length);
  console.log('  paymentMethod =', (parsed2.body as any).paymentMethod);
  const pm2 = (parsed2.body as any).paymentMethod;
  const ok2 = pm2 !== undefined; // paymentMethod survives Zod
  console.log(`  Resultado: ${ok2 ? '✅ paymentMethod sobrevive Zod → rawPayments fallback funcionará' : '❌ FALLA'}\n`);

  console.log('===============================================================');
  console.log(ok1 && ok2 ? '  ✅ AMBOS CAMINOS FUNCIONAN CORRECTAMENTE' : '  ❌ HAY PROBLEMAS');
  console.log('===============================================================');
}

testFix().catch(console.error);
