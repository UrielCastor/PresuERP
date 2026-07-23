import { prisma } from '../config/db';
import { PurchaseService } from '../services/purchase.service';

async function runTests() {
  console.log('=====================================================');
  console.log('🚀 INICIANDO PRUEBAS DE INTEGRACIÓN: COMPRAS Y PROVEEDORES');
  console.log('=====================================================');

  const purchaseService = new PurchaseService();

  // 1. SETUP - Crear entidades temporales de prueba
  console.log('\n⚙️ Preparando escenario de pruebas...');
  const business = await prisma.business.create({
    data: {
      name: 'Empresa Test Validaciones',
      taxId: '99-99999999-9',
      isActive: true,
    },
  });

  const businessOther = await prisma.business.create({
    data: {
      name: 'Empresa Test Isolation',
      taxId: '99-88888888-8',
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
      email: 'test-validation@presuerp.com',
      password: 'hashedpassword',
      businessId: business.id,
      roleId: role.id,
    },
  });

  const supplierA = await prisma.supplier.create({
    data: {
      name: 'Proveedor Test A',
      taxId: '11-11111111-1',
      businessId: business.id,
      isActive: true,
    },
  });

  const supplierB = await prisma.supplier.create({
    data: {
      name: 'Proveedor Test B',
      taxId: '22-22222222-2',
      businessId: business.id,
      isActive: true,
    },
  });

  const category = await prisma.category.create({
    data: {
      name: 'Categoria Test',
      businessId: business.id,
    },
  });

  const productCompatible = await prisma.product.create({
    data: {
      name: 'Producto de Proveedor A',
      categoryId: category.id,
      supplierId: supplierA.id,
      businessId: business.id,
      status: 'ACTIVE',
    },
  });

  const productIncompatible = await prisma.product.create({
    data: {
      name: 'Producto de Proveedor B',
      categoryId: category.id,
      supplierId: supplierB.id,
      businessId: business.id,
      status: 'ACTIVE',
    },
  });

  const productNoSupplier = await prisma.product.create({
    data: {
      name: 'Producto Sin Proveedor',
      categoryId: category.id,
      supplierId: null,
      businessId: business.id,
      status: 'ACTIVE',
    },
  });

  const warehouse = await prisma.warehouse.create({
    data: {
      name: 'Deposito Central Test',
      businessId: business.id,
      isMain: true,
      status: 'ACTIVE',
    },
  });

  let passedTests = 0;
  let failedTests = 0;

  function assertTest(name: string, success: boolean, info?: string) {
    if (success) {
      console.log(`✅ TEST PASADO: ${name}`);
      passedTests++;
    } else {
      console.error(`❌ TEST FALLADO: ${name}`);
      if (info) console.error(`   Detalle: ${info}`);
      failedTests++;
    }
  }

  try {
    // -----------------------------------------------------------------
    // TEST 1: Producto pertenece al proveedor (Flujo normal exitoso)
    // -----------------------------------------------------------------
    try {
      const res = await purchaseService.create(business.id, user.id, {
        supplierId: supplierA.id,
        warehouseId: warehouse.id,
        documentType: 'FACTURA',
        documentNumber: 'TST-0001',
        items: [
          {
            productId: productCompatible.id,
            quantity: 10,
            unitCost: 15.5,
          },
        ],
      });
      assertTest('Producto pertenece al proveedor', !!res && res.status === 'DRAFT');
    } catch (err: any) {
      assertTest('Producto pertenece al proveedor', false, err.message);
    }

    // -----------------------------------------------------------------
    // TEST 2: Producto no pertenece al proveedor (Debe fallar)
    // -----------------------------------------------------------------
    try {
      await purchaseService.create(business.id, user.id, {
        supplierId: supplierA.id,
        warehouseId: warehouse.id,
        documentType: 'FACTURA',
        documentNumber: 'TST-0002',
        items: [
          {
            productId: productIncompatible.id,
            quantity: 5,
            unitCost: 20,
          },
        ],
      });
      assertTest('Producto no pertenece al proveedor', false, 'Se esperaba un error pero la compra se guardó.');
    } catch (err: any) {
      const expectedMsg = 'pertenece al proveedor seleccionado';
      const isExpected = err.message.includes(expectedMsg);
      assertTest('Producto no pertenece al proveedor', isExpected, `Mensaje obtenido: "${err.message}"`);
    }

    // -----------------------------------------------------------------
    // TEST 3: Producto sin proveedor (Debe fallar)
    // -----------------------------------------------------------------
    try {
      await purchaseService.create(business.id, user.id, {
        supplierId: supplierA.id,
        warehouseId: warehouse.id,
        documentType: 'FACTURA',
        documentNumber: 'TST-0003',
        items: [
          {
            productId: productNoSupplier.id,
            quantity: 1,
            unitCost: 10,
          },
        ],
      });
      assertTest('Producto sin proveedor', false, 'Se esperaba un error pero la compra se guardó.');
    } catch (err: any) {
      const expectedMsg = 'no tiene asignado un proveedor';
      const isExpected = err.message.includes(expectedMsg);
      assertTest('Producto sin proveedor', isExpected, `Mensaje obtenido: "${err.message}"`);
    }

    // -----------------------------------------------------------------
    // TEST 4: Productos duplicados en líneas de compra (Debe fallar)
    // -----------------------------------------------------------------
    try {
      await purchaseService.create(business.id, user.id, {
        supplierId: supplierA.id,
        warehouseId: warehouse.id,
        documentType: 'FACTURA',
        documentNumber: 'TST-0004',
        items: [
          { productId: productCompatible.id, quantity: 1, unitCost: 10 },
          { productId: productCompatible.id, quantity: 2, unitCost: 10 },
        ],
      });
      assertTest('Productos duplicados en items', false, 'Se esperaba un error pero la compra se guardó.');
    } catch (err: any) {
      const expectedMsg = 'No se permiten productos duplicados';
      const isExpected = err.message.includes(expectedMsg);
      assertTest('Productos duplicados en items', isExpected, `Mensaje obtenido: "${err.message}"`);
    }

    // -----------------------------------------------------------------
    // TEST 5: Aislamiento Multi-tenant (Debe fallar al buscar en otra empresa)
    // -----------------------------------------------------------------
    try {
      await purchaseService.create(businessOther.id, user.id, {
        supplierId: supplierA.id, // pertenece a business, no a businessOther
        warehouseId: warehouse.id,
        items: [{ productId: productCompatible.id, quantity: 1, unitCost: 10 }],
      });
      assertTest('Multi-tenant isolation', false, 'Se creó compra vinculando registros de otro tenant.');
    } catch (err: any) {
      const isExpected = err.message.includes('no pertenece a la empresa') || err.message.includes('no existe');
      assertTest('Multi-tenant isolation', isExpected, `Mensaje obtenido: "${err.message}"`);
    }

  } catch (globalError: any) {
    console.error('💥 Falla crítica durante las pruebas:', globalError);
  } finally {
    // 9. TEARDOWN - Limpiar la base de datos de test
    console.log('\n🧹 Limpiando escenario de pruebas de la base de datos...');
    try {
      // Eliminar registros temporales asociados al test en cascada
      await prisma.purchaseItem.deleteMany({
        where: { product: { businessId: business.id } },
      });
      await prisma.purchase.deleteMany({
        where: { businessId: business.id },
      });
      await prisma.activityLog.deleteMany({
        where: { businessId: { in: [business.id, businessOther.id] } },
      });
      await prisma.product.deleteMany({
        where: { businessId: business.id },
      });
      await prisma.warehouse.deleteMany({
        where: { businessId: business.id },
      });
      await prisma.category.deleteMany({
        where: { businessId: business.id },
      });
      await prisma.supplier.deleteMany({
        where: { businessId: business.id },
      });
      await prisma.user.deleteMany({
        where: { businessId: business.id },
      });
      await prisma.role.deleteMany({
        where: { businessId: business.id },
      });
      await prisma.business.deleteMany({
        where: { id: { in: [business.id, businessOther.id] } },
      });
      console.log('✨ Cleanup completado con éxito.');
    } catch (cleanupErr: any) {
      console.error('⚠️ Error al limpiar base de datos:', cleanupErr.message);
    }
  }

  console.log('\n=====================================================');
  console.log(`📊 RESUMEN: Pasados: ${passedTests} | Fallados: ${failedTests}`);
  console.log('=====================================================');
}

runTests().catch(console.error);
