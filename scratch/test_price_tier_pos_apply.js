const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

/**
 * Exact replica of resolveProductPrice from frontend/src/utils/priceUtils.ts
 */
function resolveProductPrice(
  product,
  priceListId,
  quantity = 1
) {
  if (!product) return 0;

  const basePrice = Number(
    product.basePrice !== undefined && product.basePrice !== null
      ? product.basePrice
      : product.originalSalePrice !== undefined && product.originalSalePrice !== null
      ? product.originalSalePrice
      : product.salePrice || 0
  );

  let matchingPriceListItem = null;
  if (priceListId && product.priceListItems && Array.isArray(product.priceListItems) && product.priceListItems.length > 0) {
    const listItems = product.priceListItems
      .filter((item) => item.priceListId === priceListId && Number(item.minQuantity) <= quantity)
      .sort((a, b) => Number(b.minQuantity) - Number(a.minQuantity));

    if (listItems.length > 0) {
      matchingPriceListItem = listItems[0];
    }
  }

  let matchingTier = null;
  if (product.priceTiers && Array.isArray(product.priceTiers) && product.priceTiers.length > 0) {
    const tiers = product.priceTiers
      .filter((tier) => (tier.isActive === undefined || tier.isActive === true) && Number(tier.minQuantity) <= quantity)
      .sort((a, b) => Number(b.minQuantity) - Number(a.minQuantity));

    if (tiers.length > 0) {
      matchingTier = tiers[0];
    }
  }

  // Evaluación combinada respetando prioridades comerciales:
  if (matchingPriceListItem && matchingTier) {
    const pliMinQty = Number(matchingPriceListItem.minQuantity) || 1;
    const tierMinQty = Number(matchingTier.minQuantity) || 1;

    // Si la lista de precios tiene una escala de cantidad propia >= a la escala global, gana la lista de precios
    if (pliMinQty > 1 && pliMinQty >= tierMinQty) {
      return Number(matchingPriceListItem.price);
    }
    // Si la escala global por cantidad abarca un volumen mayor que la tarifa base (minQty 1) de la lista, gana la escala por cantidad
    if (tierMinQty > pliMinQty) {
      return Number(matchingTier.price);
    }
    return Number(matchingPriceListItem.price);
  }

  if (matchingPriceListItem) {
    return Number(matchingPriceListItem.price);
  }

  if (matchingTier) {
    return Number(matchingTier.price);
  }

  return basePrice;
}

async function runTests() {
  console.log('====================================================');
  console.log('PRUEBA AUTOMATIZADA POS: REGLAS DE PRECIO POR CANTIDAD');
  console.log('====================================================\n');

  try {
    // SETUP: Create test business and product (salchicha fela1)
    const suffix = Date.now();
    const business = await prisma.business.create({
      data: {
        name: `Empresa Test POS Tier ${suffix}`,
        taxId: `TAX-${suffix}`,
        isActive: true,
      },
    });

    const category = await prisma.category.create({
      data: {
        name: 'Embutidos',
        businessId: business.id,
      },
    });

    const product = await prisma.product.create({
      data: {
        name: 'salchicha fela1',
        sku: `SKU_FELA_${suffix}`,
        salePrice: 1300,
        purchasePrice: 800,
        categoryId: category.id,
        businessId: business.id,
        status: 'ACTIVE',
      },
    });

    console.log(`[SETUP OK] Producto creado: "${product.name}" - Precio base: $${product.salePrice}`);

    // PASO 1: Producto sin reglas - 10 unidades
    const price1 = resolveProductPrice(product, null, 10);
    console.log(`\n[PASO 1] 10 unidades sin reglas: Expected $1300 -> Result: $${price1}`);
    if (price1 !== 1300) throw new Error(`Paso 1 falló: Esperaba $1300 pero obtuvo $${price1}`);

    // PASO 2 & 3 & 4: Crear regla Cantidad 5 -> $1.200 y probar 10 unidades
    const tier1 = await prisma.productPriceTier.create({
      data: {
        businessId: business.id,
        productId: product.id,
        minQuantity: 5,
        price: 1200,
        isActive: true,
      },
    });

    // Simulated product object in POS state (with included priceTiers)
    const productWithTier1 = {
      ...product,
      basePrice: 1300,
      priceTiers: [
        { id: tier1.id, minQuantity: 5, price: 1200, isActive: true },
      ],
    };

    const price10u = resolveProductPrice(productWithTier1, null, 10);
    const total10u = price10u * 10;
    console.log(`[PASO 2,3,4] Regla (5+ u -> $1.200) - Carrito 10 u: Expected $1200 c/u (Total $12.000) -> Result: $${price10u} c/u (Total $${total10u})`);
    if (price10u !== 1200 || total10u !== 12000) {
      throw new Error(`Paso 4 falló: Se esperaba $1.200 c/u y Total $12.000, se obtuvo $${price10u} y $${total10u}`);
    }

    // PASO 5 & 6: Cambiar cantidad a 3 unidades (menor a minQuantity 5)
    const price3u = resolveProductPrice(productWithTier1, null, 3);
    const total3u = price3u * 3;
    console.log(`[PASO 5,6] Carrito 3 u (debajo de escala 5): Expected $1300 c/u (Total $3.900) -> Result: $${price3u} c/u (Total $${total3u})`);
    if (price3u !== 1300 || total3u !== 3900) {
      throw new Error(`Paso 6 falló: Se esperaba $1.300 c/u y Total $3.900, se obtuvo $${price3u} y $${total3u}`);
    }

    // PASO 7,8,9: Crear regla Cantidad 20 -> $1.100 y comprar 25 unidades
    const tier2 = await prisma.productPriceTier.create({
      data: {
        businessId: business.id,
        productId: product.id,
        minQuantity: 20,
        price: 1100,
        isActive: true,
      },
    });

    const productWithTiers = {
      ...productWithTier1,
      priceTiers: [
        { id: tier1.id, minQuantity: 5, price: 1200, isActive: true },
        { id: tier2.id, minQuantity: 20, price: 1100, isActive: true },
      ],
    };

    const price25u = resolveProductPrice(productWithTiers, null, 25);
    const total25u = price25u * 25;
    console.log(`[PASO 7,8,9] Regla (20+ u -> $1.100) - Carrito 25 u: Expected $1100 c/u (Total $27.500) -> Result: $${price25u} c/u (Total $${total25u})`);
    if (price25u !== 1100 || total25u !== 27500) {
      throw new Error(`Paso 9 falló: Se esperaba $1.100 c/u y Total $27.500, se obtuvo $${price25u} y $${total25u}`);
    }

    // PASO 10: Confirmar Prioridad Absoluta: PriceListItem > ProductPriceTier > salePrice
    const priceList = await prisma.priceList.create({
      data: {
        name: 'Lista Mayorista Especial',
        businessId: business.id,
      },
    });

    // PriceListItem con escala específica 20+ u a $1050
    const priceListItem = await prisma.priceListItem.create({
      data: {
        priceListId: priceList.id,
        productId: product.id,
        minQuantity: 20,
        price: 1050,
      },
    });

    const productWithListAndTiers = {
      ...productWithTiers,
      priceListItems: [
        { priceListId: priceList.id, minQuantity: 20, price: 1050 },
      ],
    };

    const priorityPrice = resolveProductPrice(productWithListAndTiers, priceList.id, 25);
    console.log(`[PASO 10] Evaluando Prioridad (Lista Mayorista $1050 vs Tier $1100 vs Base $1300): Expected $1050 -> Result: $${priorityPrice}`);
    if (priorityPrice !== 1050) {
      throw new Error(`Paso 10 falló: Prioridad PriceListItem no prevaleció. Obtenido: $${priorityPrice}`);
    }

    console.log('\n====================================================');
    console.log('✓ PRUEBA AUTOMATIZADA POS COMPLETADA CON 100% ÉXITO!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ ERROR EN PRUEBA AUTOMATIZADA POS:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
