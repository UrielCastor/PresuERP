import { prisma } from '../config/db';
import { CustomerService } from '../services/customer.service';
import { SaleService } from '../services/sale.service';

async function runCustomerModuleTests() {
  console.log('=== TEST INTEGRAL DEL MÓDULO DE CLIENTES ===\n');

  const customerService = new CustomerService();
  const saleService = new SaleService();

  // Fetch business and user
  const business = await prisma.business.findFirst({ where: { isActive: true } });
  if (!business) throw new Error('No se encontró una empresa activa en la BD');

  const user = await prisma.user.findFirst({ where: { businessId: business.id } });
  if (!user) throw new Error('No se encontró un usuario para la prueba');

  const warehouse = await prisma.warehouse.findFirst({ where: { businessId: business.id } });
  if (!warehouse) throw new Error('No se encontró un depósito');

  const product = await prisma.product.findFirst({ where: { businessId: business.id, status: 'ACTIVE' } });
  if (!product) throw new Error('No se encontró un producto activo');

  let session = await prisma.cashSession.findFirst({ where: { businessId: business.id, status: 'OPEN' } });
  if (!session) {
    const register = await prisma.cashRegister.findFirst({ where: { businessId: business.id, isActive: true } });
    if (register) {
      session = await prisma.cashSession.create({
        data: {
          businessId: business.id,
          cashRegisterId: register.id,
          openedById: user.id,
          openingBalance: 500,
          status: 'OPEN',
        },
      });
    }
  }

  // 1. Crear Cliente Persona
  const personaData = {
    name: `Juan Pérez Test ${Date.now()}`,
    type: 'PERSON',
    document: `DNI-${Math.floor(Math.random() * 100000000)}`,
    taxCondition: 'Consumidor Final',
    phone: '+5491112345678',
    email: `juan.test${Date.now()}@gmail.com`,
    address: 'Av. Libertador 500',
    city: 'CABA',
    province: 'Buenos Aires',
    notes: 'Cliente de prueba automatizada',
  };

  const createdPersona = await customerService.createCustomer(business.id, personaData);
  console.log('✅ 1. Cliente Persona creado:', createdPersona.name, '| ID:', createdPersona.id);

  // 2. Crear Cliente Empresa
  const empresaData = {
    name: `Tech Argentina S.A. ${Date.now()}`,
    type: 'COMPANY',
    document: `30-${Math.floor(Math.random() * 100000000)}-7`,
    taxCondition: 'Responsable Inscripto',
    phone: '+5491187654321',
    email: `contacto.tech${Date.now()}@empresa.com`,
    address: 'Av. Corrientes 1000',
    city: 'CABA',
    province: 'Buenos Aires',
  };

  const createdEmpresa = await customerService.createCustomer(business.id, empresaData);
  console.log('✅ 2. Cliente Empresa creado:', createdEmpresa.name, '| Documento:', createdEmpresa.document);

  // 3. Editar Cliente
  const updatedCustomer = await customerService.updateCustomer(createdPersona.id, business.id, {
    phone: '+5491199998888',
    notes: 'Notas actualizadas',
  });
  console.log('✅ 3. Cliente editado correctamente:', updatedCustomer?.name, '| Nuevo Tel:', updatedCustomer?.phone);

  // 4. Listar y Buscar Clientes
  const listResult = await customerService.getCustomers(business.id, { search: createdPersona.name });
  console.log('✅ 4. Búsqueda de clientes por nombre:', listResult.data.length, 'resultados encontrados');

  let pm = await prisma.paymentMethod.findFirst({ where: { businessId: business.id } });
  if (!pm) {
    pm = await prisma.paymentMethod.create({
      data: { businessId: business.id, name: 'Efectivo', type: 'CASH' },
    });
  }
  const pmId = pm.id;

  const docType = await prisma.documentType.findFirst({ where: { businessId: business.id } });

  // 5. Venta asociada a Cliente en POS
  const saleWithCustomer = await saleService.create(
    business.id,
    user.id,
    {
      warehouseId: warehouse.id,
      customerId: createdPersona.id,
      cashSessionId: session?.id,
      documentTypeId: docType?.id,
      subtotal: 15000,
      totalAmount: 15000,
      items: [
        {
          productId: product.id,
          quantity: 1,
          unitPrice: 15000,
          totalAmount: 15000,
        },
      ],
      payments: [{ paymentMethodId: pmId, amount: 15000, details: 'CASH' }],
    }
  );

  console.log('✅ 5. Venta con cliente creada:', saleWithCustomer.documentNumber, '| customerId:', saleWithCustomer.customerId);

  // 6. Venta Consumidor Final (Sin Cliente)
  const saleConsumidorFinal = await saleService.create(
    business.id,
    user.id,
    {
      warehouseId: warehouse.id,
      customerId: null,
      cashSessionId: session?.id,
      documentTypeId: docType?.id,
      subtotal: 8000,
      totalAmount: 8000,
      items: [
        {
          productId: product.id,
          quantity: 1,
          unitPrice: 8000,
          totalAmount: 8000,
        },
      ],
      payments: [{ paymentMethodId: pmId, amount: 8000, details: 'CASH' }],
    }
  );

  console.log('✅ 6. Venta sin cliente (Consumidor Final) creada:', saleConsumidorFinal.documentNumber, '| customerId:', saleConsumidorFinal.customerId);

  // 7. Detalle del Cliente e Historial Comercial
  const detail = await customerService.getCustomerById(createdPersona.id, business.id);
  console.log('✅ 7. Métrica Cliente:', detail.name, '| Compras Totales:', detail.metrics?.totalSalesCount, '| Total Gastado:', detail.metrics?.totalSpent);

  // 8. Desactivación de Cliente (Soft delete)
  await customerService.deleteCustomer(createdPersona.id, business.id);
  console.log('✅ 8. Cliente desactivado exitosamente.');

  console.log('\n🎉 ¡TODAS LAS PRUEBAS INTEGRALES DEL MÓDULO CLIENTES PASARON CON ÉXITO!');
}

runCustomerModuleTests()
  .catch((err) => {
    console.error('❌ Error durante las pruebas:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
