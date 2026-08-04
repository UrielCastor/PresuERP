const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const http = require('http');

const prisma = new PrismaClient();
const PORT = 5099;

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTest() {
  console.log('====================================================');
  console.log('🧪 VERIFICACIÓN AUTOMATIZADA DE FASE 6: ACTUALIZACIÓN MASIVA DE PRECIOS');
  console.log('====================================================\n');

  try {
    // 1. Crear Empresa A, Usuario y Proveedor de Prueba
    const testBusinessA = await prisma.business.create({
      data: {
        name: 'Empresa A - Precios Masivos ' + Date.now(),
        taxId: '3077' + Math.floor(10000000 + Math.random() * 90000000),
        subscriptionPlan: 'Professional',
        subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });

    const bcrypt = require('../backend/node_modules/bcryptjs');
    const hashedPassword = await bcrypt.hash('123456', 10);
    const userA = await prisma.user.create({
      data: {
        name: 'Operador Precios',
        email: `precios_${Date.now()}@test.com`,
        password: hashedPassword,
        businessId: testBusinessA.id,
        isActive: true,
      },
    });

    const supplierBranca = await prisma.supplier.create({
      data: {
        businessId: testBusinessA.id,
        name: 'Fratelli Branca ' + Date.now(),
      },
    });

    const categoryBebidas = await prisma.category.create({
      data: {
        businessId: testBusinessA.id,
        name: 'Bebidas ' + Date.now(),
      },
    });

    // Productos de prueba
    const p1 = await prisma.product.create({
      data: {
        businessId: testBusinessA.id,
        supplierId: supplierBranca.id,
        categoryId: categoryBebidas.id,
        name: 'Fernet Branca 750ml',
        sku: 'FER-750-' + Date.now(),
        purchasePrice: 5000,
        salePrice: 10000,
        status: 'ACTIVE',
      },
    });

    const p2 = await prisma.product.create({
      data: {
        businessId: testBusinessA.id,
        supplierId: supplierBranca.id,
        categoryId: categoryBebidas.id,
        name: 'Fernet Branca 1L',
        sku: 'FER-1L-' + Date.now(),
        purchasePrice: 6500,
        salePrice: 12500,
        status: 'ACTIVE',
      },
    });

    // Crear lista de precios y precios especiales
    const priceListMayorista = await prisma.priceList.create({
      data: {
        businessId: testBusinessA.id,
        name: 'Mayorista Especial',
        isDefault: false,
        isActive: true,
      },
    });

    const item1PL = await prisma.priceListItem.create({
      data: {
        priceListId: priceListMayorista.id,
        productId: p1.id,
        price: 9000,
      },
    });

    const docType = await prisma.documentType.create({
      data: {
        businessId: testBusinessA.id,
        name: 'Ticket',
        code: 'TK-' + Date.now(),
        isFiscal: false,
      },
    });

    // Crear Venta Histórica previa para verificar Inmutabilidad
    const historicSale = await prisma.sale.create({
      data: {
        business: { connect: { id: testBusinessA.id } },
        documentType: { connect: { id: docType.id } },
        documentNumber: 1,
        totalAmount: 10000,
        subtotal: 10000,
        status: 'COMPLETED',
        createdBy: { connect: { id: userA.id } },
        items: {
          create: {
            productId: p1.id,
            quantity: 1,
            unitPrice: 10000,
            totalAmount: 10000,
          },
        },
      },
      include: { items: true },
    });

    console.log(`✅ Creados: Empresa A (${testBusinessA.name}), 2 Productos, 1 Lista Especial, 1 Venta Histórica ($10.000)`);

    // 2. Autenticación HTTP
    const loginRes = await makeRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: userA.email, password: '123456' }
    );

    if (loginRes.status !== 200 || !loginRes.body.data?.accessToken) {
      throw new Error(`Falló autenticación: ${JSON.stringify(loginRes.body)}`);
    }

    const token = loginRes.body.data.accessToken;
    console.log('✅ Autenticación HTTP exitosa.');

    // 3. Probar POST /api/v1/product-price-updates/preview (+8% por Proveedor con Redondeo a 100)
    console.log('\n3. Verificando POST /api/v1/product-price-updates/preview (+8% Aumento con Redondeo 100)...');
    const previewRes = await makeRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/product-price-updates/preview',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      {
        filterType: 'SUPPLIER',
        filterValue: supplierBranca.id,
        type: 'INCREASE_PERCENT',
        percentage: 8,
        affectedPurchasePrice: true,
        affectedSalePrice: true,
        roundingOption: 'ROUND_100',
        priceListStrategy: 'RECALCULATE',
      }
    );

    if (previewRes.status !== 200 || !previewRes.body.success) {
      throw new Error(`Error en vista previa: ${JSON.stringify(previewRes.body)}`);
    }

    const previewItems = previewRes.body.data.items;
    console.log(`   - Productos afectados en vista previa: ${previewItems.length}`);
    const prevP1 = previewItems.find((i) => i.id === p1.id);
    console.log(`   - P1 Fernet 750ml: Venta anterior = $${prevP1.oldSalePrice} ➔ Nuevo = $${prevP1.newSalePrice} (${prevP1.differencePercentage}%)`);
    // $10.000 * 1.08 = $10.800 (Redondeo a 100 = 10800)
    if (prevP1.newSalePrice !== 10800) {
      throw new Error(`Esperado $10.800 pero se obtuvo $${prevP1.newSalePrice}`);
    }
    console.log('   ✅ Vista previa de cálculo y redondeo correctos.');

    // 4. Probar POST /api/v1/product-price-updates/apply (Aplicar actualización con RECALCULATE en listas de precios)
    console.log('\n4. Aplicando actualización masiva de precios (POST /apply)...');
    const applyRes = await makeRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/product-price-updates/apply',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      {
        filterType: 'SUPPLIER',
        filterValue: supplierBranca.id,
        type: 'INCREASE_PERCENT',
        percentage: 8,
        affectedPurchasePrice: true,
        affectedSalePrice: true,
        roundingOption: 'ROUND_100',
        priceListStrategy: 'RECALCULATE',
      }
    );

    if (applyRes.status !== 200 || !applyRes.body.success) {
      throw new Error(`Error al aplicar actualización: ${JSON.stringify(applyRes.body)}`);
    }

    console.log(`   ✅ Respuesta de aplicación: ${applyRes.body.message}`);

    // 5. Verificar estado actualizado en la base de datos
    const p1Updated = await prisma.product.findUnique({ where: { id: p1.id } });
    const plItemUpdated = await prisma.priceListItem.findUnique({ where: { id: item1PL.id } });
    console.log(`   - Nuevo Product.salePrice P1: $${p1Updated.salePrice}`);
    console.log(`   - Nuevo PriceListItem P1: $${plItemUpdated.price}`);

    if (Number(p1Updated.salePrice) !== 10800) {
      throw new Error(`Product.salePrice no se actualizó correctamente (Esperado 10800, obtenido ${p1Updated.salePrice})`);
    }
    // $9.000 * 1.08 = $9.720 -> Redondeo a 100 = $9.700
    if (Number(plItemUpdated.price) !== 9700) {
      throw new Error(`PriceListItem no se recalculó correctamente (Esperado 9700, obtenido ${plItemUpdated.price})`);
    }

    // 6. Consultar Historial (GET /api/v1/product-price-updates/history)
    console.log('\n6. Consultando Historial de Actualizaciones (GET /history)...');
    const historyRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/v1/product-price-updates/history',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (historyRes.status !== 200 || !historyRes.body.success) {
      throw new Error(`Error al consultar historial: ${JSON.stringify(historyRes.body)}`);
    }

    const historyRecords = historyRes.body.data;
    console.log(`   - Registros de historial en Empresa A: ${historyRecords.length}`);
    if (historyRecords.length === 0) {
      throw new Error('No se generó registro de historial');
    }
    console.log(`   - Detalle: Tipo=${historyRecords[0].type}, Productos=${historyRecords[0].productsAffected}, Usuario=${historyRecords[0].user?.name}`);

    // 7. Aislamiento Multi-Tenant
    console.log('\n7. Verificando Aislamiento Multi-tenant de Historial...');
    const testBusinessB = await prisma.business.create({
      data: {
        name: 'Empresa B Aislada ' + Date.now(),
        taxId: '3088' + Math.floor(10000000 + Math.random() * 90000000),
        subscriptionPlan: 'Professional',
        subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });
    const userB = await prisma.user.create({
      data: {
        name: 'Operador B',
        email: `preciosB_${Date.now()}@test.com`,
        password: hashedPassword,
        businessId: testBusinessB.id,
      },
    });
    const loginResB = await makeRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: userB.email, password: '123456' }
    );
    const tokenB = loginResB.body.data.accessToken;
    const historyResB = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/v1/product-price-updates/history',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    console.log(`   - Registros visibles para Empresa B: ${historyResB.body.data.length}`);
    if (historyResB.body.data.length !== 0) {
      throw new Error('Fallo en aislamiento multi-tenant: Empresa B pudo ver historial de Empresa A');
    }
    console.log('   ✅ Aislamiento multi-tenant validado.');

    // 8. Inmutabilidad de Ventas Históricas
    console.log('\n8. Verificando Inmutabilidad de Ventas Históricas...');
    const historicSaleCheck = await prisma.sale.findUnique({
      where: { id: historicSale.id },
      include: { items: true },
    });
    const saleItemPrice = Number(historicSaleCheck.items[0].unitPrice);
    console.log(`   - Precio de venta histórica guardado en SaleItem: $${saleItemPrice}`);
    if (saleItemPrice !== 10000) {
      throw new Error(`La venta histórica fue alterada (Esperado $10.000, obtenido $${saleItemPrice})`);
    }
    console.log('   ✅ Ventas históricas 100% inmutables.');

    // Cleanup de prueba
    await prisma.productPriceUpdateHistory.deleteMany({ where: { businessId: testBusinessA.id } });
    await prisma.priceListItem.deleteMany({ where: { priceListId: priceListMayorista.id } });
    await prisma.priceList.deleteMany({ where: { businessId: testBusinessA.id } });
    await prisma.saleItem.deleteMany({ where: { saleId: historicSale.id } });
    await prisma.sale.deleteMany({ where: { businessId: testBusinessA.id } });
    await prisma.documentType.deleteMany({ where: { businessId: testBusinessA.id } });
    await prisma.product.deleteMany({ where: { businessId: testBusinessA.id } });
    await prisma.supplier.deleteMany({ where: { businessId: testBusinessA.id } });
    await prisma.category.deleteMany({ where: { businessId: testBusinessA.id } });
    await prisma.user.deleteMany({ where: { businessId: { in: [testBusinessA.id, testBusinessB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [testBusinessA.id, testBusinessB.id] } } });

    console.log('\n====================================================');
    console.log('🎉 FASE 6: TODAS LAS PRUEBAS RESULTARON EXITOSAS (100% OK)');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ ERROR EN LA VERIFICACIÓN DE FASE 6:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
