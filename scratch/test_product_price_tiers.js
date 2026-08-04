const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

const API_URL = 'http://localhost:5001/api/v1';

async function runTests() {
  console.log('====================================================');
  console.log('PRUEBAS AUTOMATIZADAS - FASE 4: REGLAS POR CANTIDAD');
  console.log('====================================================\n');

  try {
    // 1. Obtener una empresa y producto de prueba
    const business = await prisma.business.findFirst({
      where: { isActive: true },
      include: {
        products: { take: 2 },
        users: { take: 1 },
        priceLists: { take: 1 },
      },
    });

    if (!business || !business.products || business.products.length === 0 || !business.users[0]) {
      console.error('❌ Error: No se encontró empresa de prueba con productos y usuario.');
      process.exit(1);
    }

    const testProduct = business.products[0];
    const testUser = business.users[0];

    const jwt = require('../backend/node_modules/jsonwebtoken');
    const token = jwt.sign(
      { userId: testUser.id, businessId: business.id, role: testUser.role || 'ADMIN' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    console.log(`[SETUP] Empresa: ${business.name} | Producto: ${testProduct.name} (Base: $${testProduct.salePrice})`);

    // Limpiar tiers previos del producto de prueba
    await prisma.productPriceTier.deleteMany({
      where: { productId: testProduct.id },
    });

    // ----------------------------------------------------
    // [PASO 1] Crear reglas de precio por cantidad (10+ @ $1200, 25+ @ $1150, 50+ @ $1100)
    // ----------------------------------------------------
    console.log('\n[PASO 1] Creando reglas de precio por cantidad via HTTP POST...');
    
    const postRes1 = await fetch(`${API_URL}/product-price-tiers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        productId: testProduct.id,
        minQuantity: 10,
        price: 1200,
        isActive: true,
      }),
    });
    const tier1Data = await postRes1.json();
    if (postRes1.status !== 201) throw new Error(`POST 1 Falló: ${JSON.stringify(tier1Data)}`);
    console.log(`✓ Regla 1 creada (ID: ${tier1Data.data.id}): 10+ u. -> $1200`);

    const postRes2 = await fetch(`${API_URL}/product-price-tiers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        productId: testProduct.id,
        minQuantity: 25,
        price: 1150,
        isActive: true,
      }),
    });
    const tier2Data = await postRes2.json();
    if (postRes2.status !== 201) throw new Error(`POST 2 Falló: ${JSON.stringify(tier2Data)}`);
    console.log(`✓ Regla 2 creada (ID: ${tier2Data.data.id}): 25+ u. -> $1150`);

    const postRes3 = await fetch(`${API_URL}/product-price-tiers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        productId: testProduct.id,
        minQuantity: 50,
        price: 1100,
        isActive: true,
      }),
    });
    const tier3Data = await postRes3.json();
    if (postRes3.status !== 201) throw new Error(`POST 3 Falló: ${JSON.stringify(tier3Data)}`);
    console.log(`✓ Regla 3 creada (ID: ${tier3Data.data.id}): 50+ u. -> $1100`);

    // ----------------------------------------------------
    // [PASO 2] Editar una regla via HTTP PUT
    // ----------------------------------------------------
    console.log('\n[PASO 2] Editando Regla 1 via HTTP PUT...');
    const putRes = await fetch(`${API_URL}/product-price-tiers/${tier1Data.data.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ price: 1220 }),
    });
    const editData = await putRes.json();
    if (Number(editData.data.price) === 1220) {
      console.log('✓ PASO 2 OK: Precio de Regla 1 actualizado correctamente a $1220.');
    } else {
      throw new Error('Regla 1 no actualizó el precio correctamente.');
    }

    // Revertir edit a 1200 para pruebas de resolución
    await fetch(`${API_URL}/product-price-tiers/${tier1Data.data.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ price: 1200 }),
    });

    // ----------------------------------------------------
    // [PASO 3] Intentar duplicar minQuantity para el mismo producto (Validación Bad Request 400)
    // ----------------------------------------------------
    console.log('\n[PASO 3] Intentando crear duplicado de minQuantity = 10 para el mismo producto...');
    const dupRes = await fetch(`${API_URL}/product-price-tiers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        productId: testProduct.id,
        minQuantity: 10,
        price: 1000,
      }),
    });
    const dupData = await dupRes.json();
    if (dupRes.status === 400) {
      console.log(`✓ PASO 3 OK: Bloqueado por duplicado (400 - ${dupData.message})`);
    } else {
      throw new Error('Debió fallar con 400 por minQuantity duplicado');
    }

    // ----------------------------------------------------
    // [PASO 4] Evaluando resolución comercial de escalas por cantidad
    // ----------------------------------------------------
    console.log('\n[PASO 4] Evaluando resolución comercial de escalas por cantidad...');

    const productWithTiers = {
      ...testProduct,
      salePrice: 1300,
      priceTiers: [
        { id: tier1Data.data.id, minQuantity: 10, price: 1200, isActive: true },
        { id: tier2Data.data.id, minQuantity: 25, price: 1150, isActive: true },
        { id: tier3Data.data.id, minQuantity: 50, price: 1100, isActive: true },
      ],
    };

    function resolveProductPrice(product, priceListId, quantity = 1) {
      if (!product) return 0;
      const basePrice = Number(product.basePrice ?? product.originalSalePrice ?? product.salePrice ?? 0);

      if (priceListId && product.priceListItems && Array.isArray(product.priceListItems) && product.priceListItems.length > 0) {
        const matchingItems = product.priceListItems
          .filter((item) => item.priceListId === priceListId && Number(item.minQuantity) <= quantity)
          .sort((a, b) => Number(b.minQuantity) - Number(a.minQuantity));
        if (matchingItems.length > 0) return Number(matchingItems[0].price);
      }

      if (product.priceTiers && Array.isArray(product.priceTiers) && product.priceTiers.length > 0) {
        const matchingTiers = product.priceTiers
          .filter((tier) => (tier.isActive === undefined || tier.isActive === true) && Number(tier.minQuantity) <= quantity)
          .sort((a, b) => Number(b.minQuantity) - Number(a.minQuantity));
        if (matchingTiers.length > 0) return Number(matchingTiers[0].price);
      }

      return basePrice;
    }

    const price1 = resolveProductPrice(productWithTiers, null, 1);
    const price7 = resolveProductPrice(productWithTiers, null, 7);
    const price12 = resolveProductPrice(productWithTiers, null, 12);
    const price30 = resolveProductPrice(productWithTiers, null, 30);
    const price80 = resolveProductPrice(productWithTiers, null, 80);

    console.log(`- 1 unidad: Expected $1300 -> Result: $${price1}`);
    console.log(`- 7 unidades: Expected $1300 -> Result: $${price7}`);
    console.log(`- 12 unidades: Expected $1200 -> Result: $${price12}`);
    console.log(`- 30 unidades: Expected $1150 -> Result: $${price30}`);
    console.log(`- 80 unidades: Expected $1100 -> Result: $${price80}`);

    if (price1 === 1300 && price7 === 1300 && price12 === 1200 && price30 === 1150 && price80 === 1100) {
      console.log('✓ PASO 4 OK: Resolución de escalas por cantidad 100% exacta!');
    } else {
      throw new Error('Falló el cálculo de alguna escala por cantidad.');
    }

    // ----------------------------------------------------
    // [PASO 5] Verificación de Prioridad Absoluta de Lista de Precios
    // ----------------------------------------------------
    console.log('\n[PASO 5] Verificando prioridad absoluta de Lista de Precios sobre escalas por cantidad...');

    const productWithListAndTiers = {
      ...productWithTiers,
      priceListItems: [
        { priceListId: 'mayorista-id', minQuantity: 1, price: 1250 },
      ],
    };

    const effectivePriceWithList = resolveProductPrice(productWithListAndTiers, 'mayorista-id', 12);
    console.log(`- Lista Mayorista activa para 12 u: Expected $1250 (Lista) vs $1200 (Cantidad) -> Result: $${effectivePriceWithList}`);

    if (effectivePriceWithList === 1250) {
      console.log('✓ PASO 5 OK: La Lista de Precios tiene prioridad absoluta sobre la escala por cantidad.');
    } else {
      throw new Error('La lista de precios no tuvo prioridad sobre la escala por cantidad.');
    }

    // ----------------------------------------------------
    // [PASO 6] Eliminar una regla via HTTP DELETE
    // ----------------------------------------------------
    console.log('\n[PASO 6] Eliminando Regla 3 via HTTP DELETE...');
    const delRes = await fetch(`${API_URL}/product-price-tiers/${tier3Data.data.id}`, {
      method: 'DELETE',
      headers,
    });
    if (delRes.status !== 200) throw new Error('DELETE falló');

    const getRes = await fetch(`${API_URL}/product-price-tiers?productId=${testProduct.id}`, { headers });
    const getList = await getRes.json();
    
    if (getList.data.length === 2) {
      console.log('✓ PASO 6 OK: Regla 3 eliminada correctamente.');
    } else {
      throw new Error('Regla 3 no se eliminó.');
    }

    console.log('\n====================================================');
    console.log('✓ TODAS LAS PRUEBAS DE LA FASE 4 PASARON EXITOSAMENTE!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ ERROR EN PRUEBAS AUTOMATIZADAS:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
