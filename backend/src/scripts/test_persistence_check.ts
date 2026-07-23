import { prisma } from '../config/db';
import { CustomerService } from '../services/customer.service';

async function testPersistence() {
  console.log('=== TEST DE PERSISTENCIA DE CUENTA CORRIENTE ===\n');

  const customerService = new CustomerService();

  const business = await prisma.business.findFirst({ where: { isActive: true } });
  if (!business) throw new Error('No business found');

  // 1. Crear cliente con Cta. Cte. Habilitada ($100.000)
  const created = await customerService.createCustomer(business.id, {
    name: `Juan Pérez Persistencia ${Date.now()}`,
    type: 'PERSON',
    document: `DNI-${Math.floor(Math.random() * 100000000)}`,
    allowCreditAccount: true,
    creditLimit: 100000,
  });

  console.log('✅ 1. Cliente creado:');
  console.log('   - ID:', created.id);
  console.log('   - allowCreditAccount:', created.allowCreditAccount);
  console.log('   - creditLimit:', created.creditLimit);

  if (created.allowCreditAccount !== true || Number(created.creditLimit) !== 100000) {
    throw new Error('❌ Fallo la persistencia en la CREACIÓN');
  }

  // 2. Consultar cliente por ID (GET /customers/:id)
  const fetched = await customerService.getCustomerById(created.id, business.id);
  console.log('\n✅ 2. Cliente obtenido por ID (GET /customers/:id):');
  console.log('   - allowCreditAccount:', fetched.allowCreditAccount);
  console.log('   - creditLimit:', fetched.creditLimit);

  if (fetched.allowCreditAccount !== true || Number(fetched.creditLimit) !== 100000) {
    throw new Error('❌ Fallo la lectura por ID');
  }

  // 3. Modificar otros datos sin tocar allowCreditAccount (Simular PUT parcial)
  const updated1 = await customerService.updateCustomer(created.id, business.id, {
    phone: '+5491100000000',
  });

  if (!updated1) throw new Error('No se pudo actualizar el cliente');

  console.log('\n✅ 3. Cliente actualizado parcialmente (solo teléfono):');
  console.log('   - allowCreditAccount:', updated1.allowCreditAccount);
  console.log('   - creditLimit:', updated1.creditLimit);

  if (updated1.allowCreditAccount !== true || Number(updated1.creditLimit) !== 100000) {
    throw new Error('❌ Fallo la persistencia tras actualización parcial');
  }

  // 4. Modificar explicitamente allowCreditAccount y creditLimit (Simular PUT de formulario)
  const updated2 = await customerService.updateCustomer(created.id, business.id, {
    name: created.name,
    allowCreditAccount: true,
    creditLimit: 150000,
  });

  if (!updated2) throw new Error('No se pudo actualizar el cliente');

  console.log('\n✅ 4. Cliente actualizado con nuevo límite ($150.000):');
  console.log('   - allowCreditAccount:', updated2.allowCreditAccount);
  console.log('   - creditLimit:', updated2.creditLimit);

  if (updated2.allowCreditAccount !== true || Number(updated2.creditLimit) !== 150000) {
    throw new Error('❌ Fallo la actualización explicita de cuenta corriente');
  }

  // 5. Consultar lista de clientes (GET /customers)
  const list = await customerService.getCustomers(business.id, { search: created.name });
  const foundInList = list.data.find((c) => c.id === created.id);
  console.log('\n✅ 5. Cliente obtenido en el listado general (GET /customers):');
  console.log('   - allowCreditAccount:', foundInList?.allowCreditAccount);
  console.log('   - creditLimit:', foundInList?.creditLimit);

  if (foundInList?.allowCreditAccount !== true || Number(foundInList?.creditLimit) !== 150000) {
    throw new Error('❌ Fallo en la lectura del listado general');
  }

  // Limpiar
  await customerService.deleteCustomer(created.id, business.id);
  console.log('\n🎉 ¡TODAS LAS PRUEBAS DE PERSISTENCIA PASARON CORRECTAMENTE!');
}

testPersistence()
  .catch((err) => {
    console.error('❌ Error en prueba de persistencia:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
