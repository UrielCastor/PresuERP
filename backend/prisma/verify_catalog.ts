import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyCatalog() {
  console.log('🔍 Ejecutando Verificaciones del Catálogo...');

  const businesses = await prisma.business.findMany();

  for (const business of businesses) {
    console.log(`\n🏢 Auditando Business: ${business.name}`);

    const suppliersCount = await prisma.supplier.count({
      where: { businessId: business.id },
    });
    console.log(`- Total Proveedores: ${suppliersCount}`);

    const categoriesCount = await prisma.category.count({
      where: { businessId: business.id },
    });
    console.log(`- Total Categorías: ${categoriesCount}`);

    const products = await prisma.product.findMany({
      where: { businessId: business.id },
      include: {
        category: true,
        supplier: true,
        stocks: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    console.log(`- Total Productos: ${products.length}`);

    let missingSku = 0;
    let missingBarcode = 0;
    let missingCategory = 0;
    let missingSupplier = 0;
    let missingStock = 0;

    const skus = new Set<string>();
    const barcodes = new Set<string>();
    let duplicateSkus = 0;
    let duplicateBarcodes = 0;

    for (const p of products) {
      if (!p.sku) missingSku++;
      else {
        if (skus.has(p.sku)) duplicateSkus++;
        skus.add(p.sku);
      }

      if (!p.barcode) missingBarcode++;
      else {
        if (barcodes.has(p.barcode)) duplicateBarcodes++;
        barcodes.add(p.barcode);
      }

      if (!p.categoryId || !p.category) missingCategory++;
      if (!p.supplierId || !p.supplier) missingSupplier++;
      if (p.stocks.length === 0) missingStock++;
    }

    console.log(`  ✓ Productos sin SKU: ${missingSku}`);
    console.log(`  ✓ Productos sin Código de Barras: ${missingBarcode}`);
    console.log(`  ✓ SKUs Duplicados: ${duplicateSkus}`);
    console.log(`  ✓ Códigos de Barras Duplicados: ${duplicateBarcodes}`);
    console.log(`  ✓ Productos sin Categoría: ${missingCategory}`);
    console.log(`  ✓ Productos sin Proveedor: ${missingSupplier}`);
    console.log(`  ✓ Productos sin registros de Stock: ${missingStock}`);

    const totalStockRecords = await prisma.stock.count({
      where: { businessId: business.id },
    });
    console.log(`- Registros de Stock creados: ${totalStockRecords}`);
  }

  console.log('\n✅ AUDITORÍA DE VERIFICACIÓN FINALIZADA CON ÉXITO.');
}

verifyCatalog()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
