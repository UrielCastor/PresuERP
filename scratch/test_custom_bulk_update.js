const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const http = require('http');

const prisma = new PrismaClient();
const PORT = 5099;

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTest() {
  console.log('====================================================');
  console.log('🧪 VERIFICACIÓN AUTOMATIZADA: BULK CUSTOM PRICE UPDATE');
  console.log('====================================================\n');

  try {
    // 1. Crear Empresa y Proveedor de Prueba
    const testBusiness = await prisma.business.create({
      data: {
        name: 'Empresa Custom Bulk ' + Date.now(),
        taxId: '3078' + Math.floor(10000000 + Math.random() * 90000000),
        subscriptionPlan: 'Professional',
        subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });

    const supplier = await prisma.supplier.create({
      data: {
        business: { connect: { id: testBusiness.id } },
        name: 'Distribuidor Fernet ' + Date.now(),
      },
    });

    const category = await prisma.category.create({
      data: {
        business: { connect: { id: testBusiness.id } },
        name: 'Bebidas ' + Date.now(),
      },
    });

    const p1 = await prisma.product.create({
      data: {
        business: { connect: { id: testBusiness.id } },
        category: { connect: { id: category.id } },
        supplier: { connect: { id: supplier.id } },
        name: 'Fernet Branca 750ml',
        sku: 'FER-750-' + Date.now(),
        purchasePrice: 9800,
        salePrice: 12740,
        status: 'ACTIVE',
      },
    });

    const p2 = await prisma.product.create({
      data: {
        business: { connect: { id: testBusiness.id } },
        category: { connect: { id: category.id } },
        supplier: { connect: { id: supplier.id } },
        name: 'Fernet Menta 750ml',
        sku: 'FER-MEN-' + Date.now(),
        purchasePrice: 8500,
        salePrice: 11050,
        status: 'ACTIVE',
      },
    });

    const bcrypt = require('../backend/node_modules/bcryptjs');
    const hashedPassword = await bcrypt.hash('123456', 10);
    const user = await prisma.user.create({
      data: {
        email: `custom_${Date.now()}@test.com`,
        password: hashedPassword,
        name: 'Operador Bulk',
        business: { connect: { id: testBusiness.id } },
        isActive: true,
      },
    });

    console.log('1. Creados datos de prueba (Empresa, Proveedor, 2 Productos).');

    // 2. Login HTTP
    const loginRes = await makeRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: user.email, password: '123456' }
    );

    const token = loginRes.body.data?.accessToken;
    if (!token) {
      throw new Error(`Falló login: ${JSON.stringify(loginRes.body)}`);
    }
    console.log('2. Autenticación HTTP exitosa.');

    // 3. Probar POST /api/v1/product-price-updates/bulk-custom
    console.log('\n3. Ejecutando POST /bulk-custom (Granular per-product update)...');
    const bulkRes = await makeRequest(
      {
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/product-price-updates/bulk-custom',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      {
        supplierId: supplier.id,
        priceListStrategy: 'RECALCULATE',
        items: [
          { productId: p1.id, newPurchasePrice: 10584, newSalePrice: 13759 },
          { productId: p2.id, newPurchasePrice: 9180, newSalePrice: 11934 },
        ],
      }
    );

    if (bulkRes.status !== 200 || !bulkRes.body.success) {
      throw new Error(`Error en bulk-custom: ${JSON.stringify(bulkRes.body)}`);
    }

    console.log(`   ✅ ${bulkRes.body.message}`);

    // 4. Verificar base de datos
    const updatedP1 = await prisma.product.findUnique({ where: { id: p1.id } });
    const updatedP2 = await prisma.product.findUnique({ where: { id: p2.id } });

    console.log(`   - P1 Fernet 750ml: Compra $${updatedP1.purchasePrice} | Venta $${updatedP1.salePrice}`);
    console.log(`   - P2 Fernet Menta: Compra $${updatedP2.purchasePrice} | Venta $${updatedP2.salePrice}`);

    if (Number(updatedP1.salePrice) !== 13759 || Number(updatedP2.salePrice) !== 11934) {
      throw new Error('Los precios actualizados no coinciden con lo esperado.');
    }
    console.log('   ✅ Precios verificados correctamente en la base de datos.');

    // 5. Cleanup
    await prisma.product.deleteMany({ where: { businessId: testBusiness.id } });
    await prisma.supplier.deleteMany({ where: { businessId: testBusiness.id } });
    await prisma.category.deleteMany({ where: { businessId: testBusiness.id } });
    await prisma.productPriceUpdateHistory.deleteMany({ where: { businessId: testBusiness.id } });
    await prisma.user.deleteMany({ where: { businessId: testBusiness.id } });
    await prisma.business.deleteMany({ where: { id: testBusiness.id } });

    console.log('\n====================================================');
    console.log('🎉 REFACTOR UX DE ACTUALIZACIÓN MASIVA: 100% OK');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ ERROR EN PRUEBA:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
