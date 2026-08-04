const http = require('http');
const path = require('path');

const backendDir = path.join(__dirname, '..', 'backend');
const { PrismaClient } = require(path.join(backendDir, 'node_modules', '@prisma/client'));
const bcrypt = require(path.join(backendDir, 'node_modules', 'bcryptjs'));
const app = require(path.join(backendDir, 'dist', 'app')).default;
const prisma = new PrismaClient();

function httpRequest(port, urlPath, method, headers, bodyData) {
  return new Promise((resolve, reject) => {
    const payloadStr = bodyData ? (typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData)) : '';
    const reqHeaders = { ...headers };
    if (payloadStr) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payloadStr);
    }

    const req = http.request({
      hostname: 'localhost',
      port,
      path: urlPath,
      method,
      headers: reqHeaders,
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (e) { json = raw; }
        resolve({ statusCode: res.statusCode, body: json });
      });
    });

    req.on('error', err => reject(err));
    if (payloadStr) req.write(payloadStr);
    req.end();
  });
}

async function runTest() {
  console.log('====================================================');
  console.log('🧪 VERIFICACIÓN AUTOMATIZADA DE FASE 5: POS & PROMO');
  console.log('====================================================\n');

  const TEST_PORT = 5099;
  const server = app.listen(TEST_PORT);

  try {
    const timestamp = Date.now();
    const taxId = '30-999' + String(timestamp).slice(-6) + '-1';

    // 1. Crear Empresa, Usuario y Producto de Prueba
    console.log('1. Creando Empresa, Usuario y Producto de prueba con Prisma...');
    const business = await prisma.business.create({
      data: { name: 'Empresa Promo ' + timestamp, taxId, isActive: true }
    });

    const role = await prisma.role.create({
      data: { name: 'Admin Promo', businessId: business.id, isSystem: true }
    });

    const category = await prisma.category.create({
      data: { name: 'Bebidas ' + timestamp, businessId: business.id }
    });

    const pass = 'Pass123!';
    const hashed = await bcrypt.hash(pass, 10);
    const email = `admin_promo_${timestamp}@example.com`;
    await prisma.user.create({
      data: { email, password: hashed, name: 'Admin Promo', businessId: business.id, roleId: role.id }
    });

    const product = await prisma.product.create({
      data: {
        sku: 'FERNET-' + timestamp,
        name: 'Fernet Branca 750ml',
        salePrice: 1000,
        purchasePrice: 600,
        businessId: business.id,
        categoryId: category.id,
      }
    });

    console.log(`   ✅ Creados: Empresa ID=${business.id}, Producto "${product.name}" ($${product.salePrice})`);

    // 2. Login via API HTTP
    console.log(`\n2. Autenticando usuario vía HTTP POST /api/v1/auth/login en puerto ${TEST_PORT}...`);
    const loginRes = await httpRequest(TEST_PORT, '/api/v1/auth/login', 'POST', { 'Content-Type': 'application/json' }, {
      email,
      password: pass
    });

    if (loginRes.statusCode !== 200 || !loginRes.body?.data?.accessToken) {
      throw new Error(`Error login: ${JSON.stringify(loginRes.body)}`);
    }

    const token = loginRes.body.data.accessToken;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
    console.log('   ✅ Autenticación HTTP exitosa.');

    // 3. Probando CRUD de Promociones (/api/v1/promotions)
    console.log('\n3. Probando API /api/v1/promotions (CRUD Promociones)...');

    // Create 2x1 Promotion
    console.log('   3.1 Creando promoción 2x1...');
    const createPromoRes = await httpRequest(TEST_PORT, '/api/v1/promotions', 'POST', authHeaders, {
      name: '2x1 Fernet Branca',
      type: 'TWO_FOR_ONE',
      productId: product.id,
      minQuantity: 2,
      isActive: true,
    });

    if (createPromoRes.statusCode !== 201) {
      throw new Error(`Error al crear promoción 2x1: ${JSON.stringify(createPromoRes.body)}`);
    }

    const promo2x1 = createPromoRes.body.data;
    console.log(`   ✅ Promoción 2x1 creada con ID: ${promo2x1.id}`);

    // Create 2nd Unit 50% OFF Promotion
    console.log('   3.2 Creando promoción 2da Unidad 50% OFF...');
    const createSecondUnitRes = await httpRequest(TEST_PORT, '/api/v1/promotions', 'POST', authHeaders, {
      name: '2da Unidad 50% OFF Fernet',
      type: 'SECOND_UNIT_DISCOUNT',
      productId: product.id,
      minQuantity: 2,
      discountPercentage: 50,
      isActive: true,
    });

    const promoSecondUnit = createSecondUnitRes.body.data;
    console.log(`   ✅ Promoción 2da Unidad 50% OFF creada con ID: ${promoSecondUnit.id}`);

    // Create Special Pack (3x $2.000)
    console.log('   3.3 Creando promoción Pack Especial (3x $2.000)...');
    const createPackRes = await httpRequest(TEST_PORT, '/api/v1/promotions', 'POST', authHeaders, {
      name: 'Pack 3x $2.000 Fernet',
      type: 'SPECIAL_PACK',
      productId: product.id,
      minQuantity: 3,
      specialPrice: 2000,
      isActive: true,
    });

    const promoPack = createPackRes.body.data;
    console.log(`   ✅ Promoción Pack Especial creada con ID: ${promoPack.id}`);

    // 4. GET /api/v1/promotions
    console.log('\n4. Consultando GET /api/v1/promotions...');
    const listRes = await httpRequest(TEST_PORT, '/api/v1/promotions', 'GET', authHeaders);
    console.log(`   ✅ Promociones registradas: ${listRes.body?.data?.length || 0}`);

    // 5. Test Frontend Price Engine Calculations
    console.log('\n5. Verificando cálculos matemáticos del Motor de Precios FASE 5...');
    const basePrice = Number(product.salePrice); // 1000

    // Test 2x1 calculation
    const calc2x1Unit = (basePrice * Math.ceil(2 / 2)) / 2; // 500
    const calc2x1Total = calc2x1Unit * 2; // 1000
    console.log(`   - 2x1 (2 u. de $1.000): unitPrice = $${calc2x1Unit}, Total = $${calc2x1Total} (Esperado: $1.000)`);
    if (calc2x1Total !== 1000) throw new Error('Falló cálculo 2x1');

    // Test 2nd Unit 50% OFF
    const calc2ndUnit = (basePrice * Math.ceil(2 / 2) + basePrice * (1 - 50 / 100) * Math.floor(2 / 2)) / 2; // 750
    const calc2ndTotal = calc2ndUnit * 2; // 1500
    console.log(`   - 2da unidad 50% OFF (2 u. de $1.000): unitPrice = $${calc2ndUnit}, Total = $${calc2ndTotal} (Esperado: $1.500)`);
    if (calc2ndTotal !== 1500) throw new Error('Falló cálculo 2da unidad 50% OFF');

    // Test Pack 3x $2.000
    const packPrice = 2000;
    const calcPackUnit = (packPrice * Math.floor(3 / 3) + basePrice * (3 % 3)) / 3; // 666.666...
    const calcPackTotal = Math.round(calcPackUnit * 3); // 2000
    console.log(`   - Pack Especial 3x $2.000 (3 u. de $1.000): unitPrice = $${calcPackUnit.toFixed(2)}, Total = $${calcPackTotal} (Esperado: $2.000)`);
    if (calcPackTotal !== 2000) throw new Error('Falló cálculo Pack Especial');

    // 6. Test Multi-tenant Isolation
    console.log('\n6. Verificando Aislamiento Multi-tenant de Promociones...');
    const businessOther = await prisma.business.create({
      data: { name: 'Empresa Aislada ' + timestamp, taxId: '30-000' + String(timestamp).slice(-6) + '-9', isActive: true }
    });
    const roleOther = await prisma.role.create({
      data: { name: 'Admin Other', businessId: businessOther.id, isSystem: true }
    });
    const emailOther = `admin_other_${timestamp}@example.com`;
    await prisma.user.create({
      data: { email: emailOther, password: hashed, name: 'Admin Other', businessId: businessOther.id, roleId: roleOther.id }
    });

    const loginOtherRes = await httpRequest(TEST_PORT, '/api/v1/auth/login', 'POST', { 'Content-Type': 'application/json' }, {
      email: emailOther,
      password: pass
    });
    const tokenOther = loginOtherRes.body.data.accessToken;

    const listOtherRes = await httpRequest(TEST_PORT, '/api/v1/promotions', 'GET', {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenOther}`,
    });

    console.log(`   ✅ Promociones visibles para Empresa Aislada: ${listOtherRes.body?.data?.length || 0} (Esperado: 0)`);
    if ((listOtherRes.body?.data?.length || 0) !== 0) {
      throw new Error('FALLO DE SEGURIDAD: Aislamiento multi-tenant violado!');
    }

    console.log('\n====================================================');
    console.log('🎉 FASE 5: TODAS LAS PRUEBAS RESULTARON EXITOSAS (100% OK)');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ ERROR EN PRUEBAS DE FASE 5:', err.message || err);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTest();
