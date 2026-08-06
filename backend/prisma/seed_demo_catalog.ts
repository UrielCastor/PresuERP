import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDemoCatalog() {
  console.log('🚀 Iniciando Carga de Datos de Prueba para Catálogo ERP...');

  // 1. Obtener los negocios existentes
  const businesses = await prisma.business.findMany();
  if (businesses.length === 0) {
    console.error('❌ No se encontró ningún negocio (Business) registrado.');
    return;
  }

  for (const business of businesses) {
    console.log(`\n🏢 Procesando Negocio: ${business.name} (ID: ${business.id})`);

    // ==========================================
    // 2. CREAR PROVEEDORES (4 Ficticios Argentinos)
    // ==========================================
    const suppliersData = [
      {
        name: 'Distribuidora Bebidas Express S.A.',
        contactName: 'Distribuidora Bebidas Express S.A.',
        taxId: `30-71458962-1`,
        email: 'ventas@bebidasexpress.com.ar',
        phone: '+54 11 4589-6321',
        address: 'Av. Corrientes 4520, CABA',
        isActive: true,
      },
      {
        name: 'Alimentos Secos del Sur S.R.L.',
        contactName: 'Alimentos Secos del Sur S.R.L.',
        taxId: `30-68952147-3`,
        email: 'contacto@alimentosdelsur.com.ar',
        phone: '+54 11 4785-9632',
        address: 'Av. Belgrano 1850, Avellaneda, Buenos Aires',
        isActive: true,
      },
      {
        name: 'Productos de Limpieza Global S.A.',
        contactName: 'Productos de Limpieza Global S.A.',
        taxId: `30-73265984-8`,
        email: 'pedidos@limpiezaglobal.com.ar',
        phone: '+54 11 4258-7412',
        address: 'Calle San Martín 850, Lanús, Buenos Aires',
        isActive: true,
      },
      {
        name: 'Almacén Mayorista Argentina S.A.',
        contactName: 'Almacén Mayorista Argentina S.A.',
        taxId: `30-59847123-5`,
        email: 'info@almacenmayorista.com.ar',
        phone: '+54 11 4963-8520',
        address: 'Av. Rivadavia 8900, CABA',
        isActive: true,
      },
    ];

    const createdSuppliers: Record<string, string> = {};

    for (const sup of suppliersData) {
      const existingSupplier = await prisma.supplier.findFirst({
        where: {
          taxId: sup.taxId,
          businessId: business.id,
        },
      });

      if (existingSupplier) {
        createdSuppliers[sup.name] = existingSupplier.id;
      } else {
        const created = await prisma.supplier.create({
          data: {
            ...sup,
            businessId: business.id,
          },
        });
        createdSuppliers[sup.name] = created.id;
      }
    }

    console.log(`✅ 4 Proveedores creados/verificados.`);

    // ==========================================
    // 3. CREAR CATEGORÍAS (8 Solicitadas)
    // ==========================================
    const categoriesList = [
      { name: 'Bebidas', prefix: 'BEB', supplierKey: 'Distribuidora Bebidas Express S.A.' },
      { name: 'Almacén', prefix: 'ALM', supplierKey: 'Almacén Mayorista Argentina S.A.' },
      { name: 'Lácteos', prefix: 'LAC', supplierKey: 'Alimentos Secos del Sur S.R.L.' },
      { name: 'Limpieza', prefix: 'LIM', supplierKey: 'Productos de Limpieza Global S.A.' },
      { name: 'Perfumería', prefix: 'PER', supplierKey: 'Productos de Limpieza Global S.A.' },
      { name: 'Snacks', prefix: 'SNA', supplierKey: 'Almacén Mayorista Argentina S.A.' },
      { name: 'Congelados', prefix: 'CON', supplierKey: 'Alimentos Secos del Sur S.R.L.' },
      { name: 'Descartables', prefix: 'DES', supplierKey: 'Productos de Limpieza Global S.A.' },
    ];

    const categoryMap: Record<string, { id: string; prefix: string; supplierId: string }> = {};

    for (const cat of categoriesList) {
      let existingCat = await prisma.category.findFirst({
        where: {
          name: cat.name,
          businessId: business.id,
        },
      });

      if (!existingCat) {
        existingCat = await prisma.category.create({
          data: {
            name: cat.name,
            description: `Categoría general de ${cat.name}`,
            status: 'ACTIVE',
            businessId: business.id,
          },
        });
      }

      categoryMap[cat.name] = {
        id: existingCat.id,
        prefix: cat.prefix,
        supplierId: createdSuppliers[cat.supplierKey],
      };
    }

    console.log(`✅ ${categoriesList.length} Categorías creadas/verificadas.`);

    // ==========================================
    // 4. ASEGURAR AL MENOS 2 DEPÓSITOS EXISTENTES
    // ==========================================
    let warehouses = await prisma.warehouse.findMany({
      where: { businessId: business.id },
    });

    if (warehouses.length === 0) {
      const w1 = await prisma.warehouse.create({
        data: {
          name: 'Depósito Central',
          code: 'DEP-01',
          description: 'Depósito principal de almacenamiento',
          address: 'Av. Industrial 1000',
          isMain: true,
          status: 'ACTIVE',
          businessId: business.id,
        },
      });
      const w2 = await prisma.warehouse.create({
        data: {
          name: 'Depósito Sucursal 1',
          code: 'DEP-02',
          description: 'Depósito secundario operativo',
          address: 'Av. Comercial 550',
          isMain: false,
          status: 'ACTIVE',
          businessId: business.id,
        },
      });
      warehouses = [w1, w2];
    } else if (warehouses.length === 1) {
      const w2 = await prisma.warehouse.create({
        data: {
          name: 'Depósito Sucursal 1',
          code: 'DEP-02',
          description: 'Depósito secundario operativo',
          address: 'Av. Comercial 550',
          isMain: false,
          status: 'ACTIVE',
          businessId: business.id,
        },
      });
      warehouses.push(w2);
    }

    console.log(`✅ ${warehouses.length} Depósitos disponibles para distribución de stock.`);

    // ==========================================
    // 5. PRODUCTOS DE PRUEBA (55 Productos)
    // ==========================================
    const productsSeedData = [
      // Bebidas (8)
      { cat: 'Bebidas', name: 'Coca Cola 2.25L', cost: 1800, price: 2600, uom: 'UNIT' },
      { cat: 'Bebidas', name: 'Coca Cola lata 354ml', cost: 650, price: 950, uom: 'UNIT' },
      { cat: 'Bebidas', name: 'Sprite 2.25L', cost: 1750, price: 2500, uom: 'UNIT' },
      { cat: 'Bebidas', name: 'Agua mineral 500ml', cost: 350, price: 550, uom: 'UNIT' },
      { cat: 'Bebidas', name: 'Agua mineral 2L', cost: 700, price: 1100, uom: 'UNIT' },
      { cat: 'Bebidas', name: 'Cerveza Quilmes 1L Retornable', cost: 1400, price: 2100, uom: 'UNIT' },
      { cat: 'Bebidas', name: 'Jugo de Naranja 1L Tetra', cost: 900, price: 1350, uom: 'UNIT' },
      { cat: 'Bebidas', name: 'Energizante Monster 473ml', cost: 1100, price: 1700, uom: 'UNIT' },

      // Almacén (10)
      { cat: 'Almacén', name: 'Arroz Larga Fina 1kg', cost: 950, price: 1400, uom: 'KG' },
      { cat: 'Almacén', name: 'Azúcar Blanca Tipo A 1kg', cost: 800, price: 1200, uom: 'KG' },
      { cat: 'Almacén', name: 'Harina de Trigo 000 1kg', cost: 600, price: 900, uom: 'KG' },
      { cat: 'Almacén', name: 'Aceite de Girasol 900ml', cost: 1500, price: 2200, uom: 'UNIT' },
      { cat: 'Almacén', name: 'Yerba Mate Elaborada 1kg', cost: 2800, price: 4100, uom: 'KG' },
      { cat: 'Almacén', name: 'Fideos Guiseros 500g', cost: 550, price: 850, uom: 'UNIT' },
      { cat: 'Almacén', name: 'Puré de Tomate 520g', cost: 450, price: 700, uom: 'UNIT' },
      { cat: 'Almacén', name: 'Sal Fina Parrillera 500g', cost: 380, price: 600, uom: 'UNIT' },
      { cat: 'Almacén', name: 'Atún en Lomo al Natural 170g', cost: 1600, price: 2400, uom: 'UNIT' },
      { cat: 'Almacén', name: 'Café Molido Intenso 250g', cost: 3200, price: 4800, uom: 'UNIT' },

      // Lácteos (7)
      { cat: 'Lácteos', name: 'Leche Entera 1L Tetra', cost: 850, price: 1250, uom: 'LITER' },
      { cat: 'Lácteos', name: 'Yogur Bebible Frutilla 1L', cost: 1100, price: 1650, uom: 'LITER' },
      { cat: 'Lácteos', name: 'Manteca Calidad Extra 200g', cost: 1450, price: 2100, uom: 'UNIT' },
      { cat: 'Lácteos', name: 'Queso Cremoso por kg', cost: 4500, price: 6800, uom: 'KG' },
      { cat: 'Lácteos', name: 'Dulce de Leche Repostero 400g', cost: 1200, price: 1800, uom: 'UNIT' },
      { cat: 'Lácteos', name: 'Crema de Leche 200cc', cost: 980, price: 1450, uom: 'UNIT' },
      { cat: 'Lácteos', name: 'Queso Rallado Sachet 40g', cost: 620, price: 950, uom: 'UNIT' },

      // Limpieza (8)
      { cat: 'Limpieza', name: 'Lavandina Concentrada 1L', cost: 600, price: 900, uom: 'LITER' },
      { cat: 'Limpieza', name: 'Detergente Lavavajillas 750ml', cost: 1100, price: 1600, uom: 'UNIT' },
      { cat: 'Limpieza', name: 'Jabón en Polvo Automático 3kg', cost: 4200, price: 6300, uom: 'KG' },
      { cat: 'Limpieza', name: 'Esponja de Cocina Pack x3', cost: 400, price: 650, uom: 'UNIT' },
      { cat: 'Limpieza', name: 'Limpiador de Pisos Marina 900ml', cost: 750, price: 1150, uom: 'UNIT' },
      { cat: 'Limpieza', name: 'Suavizante para Ropa 900ml', cost: 1300, price: 1950, uom: 'UNIT' },
      { cat: 'Limpieza', name: 'Rollo de Cocina 3 Unidades', cost: 950, price: 1400, uom: 'UNIT' },
      { cat: 'Limpieza', name: 'Desinfectante en Aerosol 360ml', cost: 1850, price: 2700, uom: 'UNIT' },

      // Perfumería (7)
      { cat: 'Perfumería', name: 'Jabón de Tocador 3x90g', cost: 1100, price: 1650, uom: 'UNIT' },
      { cat: 'Perfumería', name: 'Shampoo Nutrición 400ml', cost: 2100, price: 3100, uom: 'UNIT' },
      { cat: 'Perfumería', name: 'Acondicionador Humectante 400ml', cost: 2100, price: 3100, uom: 'UNIT' },
      { cat: 'Perfumería', name: 'Crema Dental Protección 90g', cost: 900, price: 1350, uom: 'UNIT' },
      { cat: 'Perfumería', name: 'Desodorante Masculino Aerosol 150ml', cost: 1950, price: 2900, uom: 'UNIT' },
      { cat: 'Perfumería', name: 'Papel Higiénico Doble Hoja x4', cost: 1600, price: 2400, uom: 'UNIT' },
      { cat: 'Perfumería', name: 'Alcohol en Gel 250ml', cost: 850, price: 1300, uom: 'UNIT' },

      // Snacks (6)
      { cat: 'Snacks', name: 'Papas Fritas Clásicas 150g', cost: 1200, price: 1800, uom: 'UNIT' },
      { cat: 'Snacks', name: 'Galletitas Surtidas 400g', cost: 1100, price: 1650, uom: 'UNIT' },
      { cat: 'Snacks', name: 'Chocolate con Leche 100g', cost: 1400, price: 2100, uom: 'UNIT' },
      { cat: 'Snacks', name: 'Maní Salado Pelado 120g', cost: 650, price: 1000, uom: 'UNIT' },
      { cat: 'Snacks', name: 'Chicle Menta Fresca Display x18', cost: 1800, price: 2700, uom: 'UNIT' },
      { cat: 'Snacks', name: 'Bizcochos de Grasa 200g', cost: 500, price: 780, uom: 'UNIT' },

      // Congelados (5)
      { cat: 'Congelados', name: 'Hamburguesas de Carne Pack x4', cost: 2400, price: 3600, uom: 'UNIT' },
      { cat: 'Congelados', name: 'Papas Prefritas Bastón 1kg', cost: 2100, price: 3150, uom: 'KG' },
      { cat: 'Congelados', name: 'Nuggets de Pollo 400g', cost: 1900, price: 2850, uom: 'UNIT' },
      { cat: 'Congelados', name: 'Pizza Muzza Congelada', cost: 2800, price: 4200, uom: 'UNIT' },
      { cat: 'Congelados', name: 'Helado Balde 3 Litros Surtido', cost: 4500, price: 6750, uom: 'UNIT' },

      // Descartables (4)
      { cat: 'Descartables', name: 'Vasos Plásticos 200cc Pack x50', cost: 900, price: 1400, uom: 'UNIT' },
      { cat: 'Descartables', name: 'Platos Descartables Pack x20', cost: 1100, price: 1650, uom: 'UNIT' },
      { cat: 'Descartables', name: 'Servilletas de Papel 80 Unidades', cost: 450, price: 700, uom: 'UNIT' },
      { cat: 'Descartables', name: 'Film Polietileno Alimentos 30m', cost: 800, price: 1250, uom: 'UNIT' },
    ];

    const skuCounters: Record<string, number> = {};
    let createdProductsCount = 0;

    for (let index = 0; index < productsSeedData.length; index++) {
      const item = productsSeedData[index];
      const catInfo = categoryMap[item.cat];
      const prefix = catInfo.prefix;

      // Contador SKU
      skuCounters[prefix] = (skuCounters[prefix] || 0) + 1;
      const sku = `${prefix}-${String(skuCounters[prefix]).padStart(4, '0')}`;

      // Código EAN-13 ficticio de 13 dígitos
      const barcode = `779123456${String(index + 1).padStart(4, '0')}`;

      // Margen de beneficio
      const profitMargin = ((item.price - item.cost) / item.cost) * 100;

      // Buscar o crear Producto
      let product = await prisma.product.findFirst({
        where: {
          sku,
          businessId: business.id,
        },
      });

      if (!product) {
        product = await prisma.product.create({
          data: {
            name: item.name,
            sku,
            barcode,
            description: `Producto de prueba ${item.name} (${item.cat})`,
            categoryId: catInfo.id,
            supplierId: catInfo.supplierId,
            unitOfMeasure: item.uom,
            purchasePrice: item.cost,
            salePrice: item.price,
            profitMargin: parseFloat(profitMargin.toFixed(2)),
            status: 'ACTIVE',
            businessId: business.id,
          },
        });
        createdProductsCount++;
      }

      // ==========================================
      // 6. CUALIFICAR STOCK EN DEPÓSITOS
      // ==========================================
      // Escenarios de stock:
      // Index % 3 === 0 -> Stock Alto (100 u. en Depósito 0, 5 u. en Depósito 1)
      // Index % 3 === 1 -> Poco Stock (5 u. en Depósito 0, 100 u. en Depósito 1)
      // Index % 3 === 2 -> Sin Stock (0 u. en Depósito 0, 50 u. en Depósito 1)

      const w0 = warehouses[0];
      const w1 = warehouses[1] || warehouses[0];

      let qtyW0 = 100;
      let qtyW1 = 5;

      if (index % 3 === 1) {
        qtyW0 = 5;
        qtyW1 = 100;
      } else if (index % 3 === 2) {
        qtyW0 = 0;
        qtyW1 = 50;
      }

      // Stock en Depósito 0
      await prisma.stock.upsert({
        where: {
          warehouseId_productId_businessId: {
            warehouseId: w0.id,
            productId: product.id,
            businessId: business.id,
          },
        },
        update: {
          quantity: qtyW0,
          minimumStock: 10,
          maximumStock: 200,
        },
        create: {
          warehouseId: w0.id,
          productId: product.id,
          quantity: qtyW0,
          minimumStock: 10,
          maximumStock: 200,
          businessId: business.id,
        },
      });

      // Stock en Depósito 1
      if (w1.id !== w0.id) {
        await prisma.stock.upsert({
          where: {
            warehouseId_productId_businessId: {
              warehouseId: w1.id,
              productId: product.id,
              businessId: business.id,
            },
          },
          update: {
            quantity: qtyW1,
            minimumStock: 10,
            maximumStock: 200,
          },
          create: {
            warehouseId: w1.id,
            productId: product.id,
            quantity: qtyW1,
            minimumStock: 10,
            maximumStock: 200,
            businessId: business.id,
          },
        });
      }
    }

    console.log(`✅ ${productsSeedData.length} Productos procesados (${createdProductsCount} nuevos creados).`);

    // Backfill legacy products without SKU or supplier
    const legacyProductsWithoutSkuOrSupplier = await prisma.product.findMany({
      where: {
        businessId: business.id,
        OR: [{ sku: null }, { barcode: null }, { supplierId: null }],
      },
    });

    const defaultCategory = Object.values(categoryMap)[0];
    for (let i = 0; i < legacyProductsWithoutSkuOrSupplier.length; i++) {
      const p = legacyProductsWithoutSkuOrSupplier[i];
      await prisma.product.update({
        where: { id: p.id },
        data: {
          sku: p.sku || `LEG-${String(i + 1).padStart(4, '0')}`,
          barcode: p.barcode || `779999999${String(i + 1).padStart(4, '0')}`,
          supplierId: p.supplierId || defaultCategory.supplierId,
          categoryId: p.categoryId || defaultCategory.id,
        },
      });
    }

    console.log(`✅ Stocks distribuidos exitosamente entre los depósitos.`);
  }

  console.log('\n🎉 Carga de datos de prueba completada exitosamente.');
}

seedDemoCatalog()
  .catch((e) => {
    console.error('❌ Error ejecutando el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
