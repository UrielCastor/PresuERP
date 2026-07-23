import { prisma } from '../config/db';
import { PurchaseService } from '../services/purchase.service';
import { WarehouseTransferService } from '../services/warehouseTransfer.service';
import { StockMovementService } from '../services/stockMovement.service';

async function runTests() {
  console.log('=====================================================');
  console.log('🚀 INICIANDO PRUEBAS DE INTEGRACIÓN: NUEVO FLUJO');
  console.log('=====================================================');

  const purchaseService = new PurchaseService();
  const transferService = new WarehouseTransferService();
  const stockMovementService = new StockMovementService();

  // 1. SETUP - Crear entidades temporales de prueba
  console.log('\n⚙️ Preparando escenario de pruebas...');
  const randNum = Math.floor(Math.random() * 90000000) + 10000000;
  const business = await prisma.business.create({
    data: {
      name: `Empresa Test Estados y Traspasos ${randNum}`,
      taxId: `80-${randNum}-9`,
      isActive: true,
    },
  });

  const role = await prisma.role.create({
    data: {
      name: 'Admin Test',
      businessId: business.id,
    },
  });

  const user = await prisma.user.create({
    data: {
      name: 'Operador Test',
      email: `test-states-transfer-${randNum}@presuerp.com`,
      password: 'hashedpassword',
      businessId: business.id,
      roleId: role.id,
    },
  });

  const supplier = await prisma.supplier.create({
    data: {
      name: 'Proveedor Test',
      taxId: `30-${randNum}-1`,
      businessId: business.id,
      isActive: true,
    },
  });

  const warehouseOrigin = await prisma.warehouse.create({
    data: {
      name: 'Almacen Origen',
      code: `W-ORI-${randNum}`,
      businessId: business.id,
      status: 'ACTIVE',
    },
  });

  const warehouseDestination = await prisma.warehouse.create({
    data: {
      name: 'Almacen Destino',
      code: `W-DST-${randNum}`,
      businessId: business.id,
      status: 'ACTIVE',
    },
  });

  const category = await prisma.category.create({
    data: {
      name: 'Categoria Test',
      businessId: business.id,
      status: 'ACTIVE',
    },
  });

  const product = await prisma.product.create({
    data: {
      name: 'Articulo Test',
      sku: 'ART-TEST-ZZ',
      businessId: business.id,
      categoryId: category.id,
      supplierId: supplier.id,
      status: 'ACTIVE',
      purchasePrice: 100.00,
      salePrice: 130.00,
      profitMargin: 30.00,
    },
  });

  console.log('✅ Entidades de configuración inicial listas.');

  // ==========================================
  // PRUEBA A: FLUJO DE COMPRAS POR ESTADOS
  // ==========================================
  console.log('\n--- PRUEBA A: FLUJO DE COMPRAS POR ESTADOS ---');
  
  // 1. Crear compra en DRAFT
  console.log('1. Creando compra en DRAFT...');
  const purchase = await purchaseService.create(business.id, user.id, {
    supplierId: supplier.id,
    warehouseId: warehouseOrigin.id,
    documentType: 'FACTURA',
    documentNumber: '0001-00002233',
    notes: 'Prueba de estados de compras',
    hasInvoiceTaxes: false,
    discount: 0,
    invoicedTotal: 1000.00,
    forceDifference: false,
    items: [
      {
        productId: product.id,
        quantity: 10,
        unitCost: 100.00,
      },
    ],
  });

  if (purchase.status !== 'DRAFT') {
    throw new Error(`Error: El estado inicial debería ser DRAFT, se obtuvo: ${purchase.status}`);
  }
  console.log('✅ Compra creada en borrador (DRAFT) exitosamente.');

  // 2. Enviar a Aprobación
  console.log('2. Enviando compra a aprobación (submitForApproval)...');
  const submitted = await purchaseService.submitForApproval(purchase.id, business.id, user.id);
  if (submitted.status !== 'PENDIENTE_APROBACION') {
    throw new Error(`Error. Estado esperado: PENDIENTE_APROBACION, se obtuvo: ${submitted.status}`);
  }
  console.log('✅ Compra enviada a aprobación correctamente.');

  // 3. Aprobar Compra (APPROVED) - No debería modificar stock aún
  console.log('3. Aprobando compra (approve)...');
  const approved = await purchaseService.approve(purchase.id, business.id, user.id);
  if (approved.status !== 'APPROVED') {
    throw new Error(`Error. Estado esperado: APPROVED, se obtuvo: ${approved.status}`);
  }

  // Comprobar stock en Almacen Origen (debe seguir en 0)
  const stockPreReceive = await prisma.stock.findUnique({
    where: {
      warehouseId_productId_businessId: {
        warehouseId: warehouseOrigin.id,
        productId: product.id,
        businessId: business.id,
      },
    },
  });
  const qtyPreReceive = stockPreReceive ? Number(stockPreReceive.quantity) : 0;
  if (qtyPreReceive !== 0) {
    throw new Error(`Error: El stock no debió ingresar al aprobar. Cantidad: ${qtyPreReceive}`);
  }
  console.log('✅ Compra aprobada (APPROVED) con éxito, sin registrar stock todavía.');

  // 4. Recibir Mercadería (RECEIVED) - Incrementa stock e ingresa a Kardex
  console.log('4. Recibiendo mercadería (receive)...');
  const received = await purchaseService.receive(purchase.id, business.id, user.id);
  if (received.status !== 'RECEIVED') {
    throw new Error(`Error. Estado esperado: RECEIVED, se obtuvo: ${received.status}`);
  }

  // Comprobar stock incrementado a 10
  const stockPostReceive = await prisma.stock.findUnique({
    where: {
      warehouseId_productId_businessId: {
        warehouseId: warehouseOrigin.id,
        productId: product.id,
        businessId: business.id,
      },
    },
  });
  const qtyPostReceive = stockPostReceive ? Number(stockPostReceive.quantity) : 0;
  if (qtyPostReceive !== 10) {
    throw new Error(`Error: El stock esperado era 10, pero se obtuvo: ${qtyPostReceive}`);
  }

  // Ver movimiento de Kardex
  const movement = await prisma.stockMovement.findFirst({
    where: {
      businessId: business.id,
      productId: product.id,
      warehouseId: warehouseOrigin.id,
      movementType: 'ENTRY',
    },
  });
  if (!movement || Number(movement.quantity) !== 10) {
    throw new Error('Error: No se registró el movimiento Kardex ENTRY cargando 10 unidades.');
  }
  console.log('✅ Mercadería recibida (RECEIVED) de forma exitosa. Stock y Kardex actualizados.');

  // ==========================================
  // PRUEBA B: TRASPASO DE MERCADERÍA
  // ==========================================
  console.log('\n--- PRUEBA B: TRASPASO DE MERCADERÍA ---');

  // 1. Traspaso fallido por stock insuficiente (Intentar mover 15 cuando origen tiene 10)
  console.log('1. Intentado crear traspaso de 15 unidades (debe fallar)...');
  try {
    await transferService.create(business.id, user.id, {
      sourceWarehouseId: warehouseOrigin.id,
      targetWarehouseId: warehouseDestination.id,
      comments: 'Falla por stock',
      items: [
        {
          productId: product.id,
          quantity: 15,
        },
      ],
    });
    throw new Error('Fallo: La creación del traspaso de 15 unidades debió fallar.');
  } catch (error: any) {
    console.log(`✅ Falla controlada con éxito: "${error.message}"`);
  }

  // 2. Traspaso fallido por mismo depósito
  console.log('2. Intentando traspasar al mismo depósito (debe fallar)...');
  try {
    await transferService.create(business.id, user.id, {
      sourceWarehouseId: warehouseOrigin.id,
      targetWarehouseId: warehouseOrigin.id,
      comments: 'Mismo deposito',
      items: [
        {
          productId: product.id,
          quantity: 5,
        },
      ],
    });
    throw new Error('Fallo: El traspaso al mismo depósito debió fallar.');
  } catch (error: any) {
    console.log(`✅ Falla controlada con éxito: "${error.message}"`);
  }

  // 3. Crear traspaso exitoso de 4 unidades
  console.log('3. Creando traspaso de 4 unidades...');
  const transfer = await transferService.create(business.id, user.id, {
    sourceWarehouseId: warehouseOrigin.id,
    targetWarehouseId: warehouseDestination.id,
    comments: 'Traspaso de test',
    items: [
      {
        productId: product.id,
        quantity: 4,
      },
    ],
  });
  if (!transfer) {
    throw new Error('Error: Ocurrió un error al instanciar el traspaso.');
  }
  if (transfer.status !== 'PENDING') {
    throw new Error(`Error: El traspaso nuevo debió crearse como PENDING, se obtuvo: ${transfer.status}`);
  }
  console.log('✅ Traspaso registrado en estado PENDING.');

  // 4. Completar traspaso (Recibir) - Afecta stock y Kardex
  console.log('4. Confirmando traspaso (recepción / COMPLETING)...');
  const completedTransfer = await transferService.updateStatus(transfer.id, business.id, 'COMPLETED', user.id);
  if (completedTransfer.status !== 'COMPLETED') {
    throw new Error(`Error: Estado esperado COMPLETED, obtenido: ${completedTransfer.status}`);
  }

  // Comprobar stock decrementado en origen a 6 (10 - 4)
  const stockOrigin = await prisma.stock.findUnique({
    where: {
      warehouseId_productId_businessId: {
        warehouseId: warehouseOrigin.id,
        productId: product.id,
        businessId: business.id,
      },
    },
  });
  const qtyOrigin = stockOrigin ? Number(stockOrigin.quantity) : 0;
  if (qtyOrigin !== 6) {
    throw new Error(`Error: El stock restante en origen debe ser 6, se obtuvo: ${qtyOrigin}`);
  }

  // Comprobar stock incrementado en destino a 4
  const stockDest = await prisma.stock.findUnique({
    where: {
      warehouseId_productId_businessId: {
        warehouseId: warehouseDestination.id,
        productId: product.id,
        businessId: business.id,
      },
    },
  });
  const qtyDest = stockDest ? Number(stockDest.quantity) : 0;
  if (qtyDest !== 4) {
    throw new Error(`Error: El stock en destino debe ser 4, se obtuvo: ${qtyDest}`);
  }

  // Verificar movimientos Kardex generados: TRANSFER_OUT en origen, TRANSFER_IN en destino
  const mvOut = await prisma.stockMovement.findFirst({
    where: {
      businessId: business.id,
      productId: product.id,
      warehouseId: warehouseOrigin.id,
      movementType: 'TRANSFER_OUT',
      referenceId: transfer.id,
    },
  });
  if (!mvOut || Number(mvOut.quantity) !== -4) {
    throw new Error(`Error: Movimiento TRANSFER_OUT no registrado o incorrecto: ${JSON.stringify(mvOut)}`);
  }

  const mvIn = await prisma.stockMovement.findFirst({
    where: {
      businessId: business.id,
      productId: product.id,
      warehouseId: warehouseDestination.id,
      movementType: 'TRANSFER_IN',
      referenceId: transfer.id,
    },
  });
  if (!mvIn || Number(mvIn.quantity) !== 4) {
    throw new Error(`Error: Movimiento TRANSFER_IN no registrado o incorrecto: ${JSON.stringify(mvIn)}`);
  }

  console.log('✅ Traspaso completado. Origen: 6 unidades, Destino: 4 unidades. Kardex verificado.');

  // ==========================================
  // CLEANUP - Eliminar entidades temporales
  // ==========================================
  console.log('\n🧹 Limpiando base de datos...');
  await prisma.stockMovement.deleteMany({ where: { businessId: business.id } });
  await prisma.warehouseTransferItem.deleteMany({ where: { transferId: transfer.id } });
  await prisma.warehouseTransfer.deleteMany({ where: { businessId: business.id } });
  await prisma.stock.deleteMany({ where: { businessId: business.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchaseId: purchase.id } });
  await prisma.purchase.deleteMany({ where: { businessId: business.id } });
  await prisma.product.deleteMany({ where: { businessId: business.id } });
  await prisma.category.deleteMany({ where: { businessId: business.id } });
  await prisma.warehouse.deleteMany({ where: { businessId: business.id } });
  await prisma.supplier.deleteMany({ where: { businessId: business.id } });
  await prisma.activityLog.deleteMany({ where: { businessId: business.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.role.delete({ where: { id: role.id } });
  await prisma.business.delete({ where: { id: business.id } });

  console.log('\n=====================================================');
  console.log('🎉 TODAS LAS PRUEBAS DE INTEGRACIÓN PASARON EXITOSAMENTE!');
  console.log('=====================================================');
}

runTests().catch((error) => {
  console.error('\n❌ ERROR EJECUTANDO LAS PRUEBAS DE INTEGRACIÓN:');
  console.error(error);
  process.exit(1);
});
