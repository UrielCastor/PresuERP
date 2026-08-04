import { prisma } from '../config/db';
import { SaleService } from '../services/sale.service';
import { CashService } from '../services/cash.service';

async function main() {
  console.log('=== INICIANDO PRUEBA DE EJECUCIÓN REAL DE VENTA CASH ===\n');

  // 1. Obtener Empresa, Usuario, Almacén y Producto reales
  const business = await prisma.business.findFirst();
  if (!business) {
    console.error('No se encontró ninguna empresa en la BD.');
    return;
  }

  const user = await prisma.user.findFirst({ where: { businessId: business.id } });
  if (!user) {
    console.error('No se encontró ningún usuario en la BD.');
    return;
  }

  const warehouse = await prisma.warehouse.findFirst({ where: { businessId: business.id } });
  if (!warehouse) {
    console.error('No se encontró ningún depósito en la BD.');
    return;
  }

  const product = await prisma.product.findFirst({ where: { businessId: business.id } });
  if (!product) {
    console.error('No se encontró ningún producto en la BD.');
    return;
  }

  const cashService = new CashService();
  const saleService = new SaleService();

  // 2. Obtener o Abrir Sesión de Caja
  let session = await cashService.getActiveSession(business.id, user.id);
  if (!session) {
    const registers = await cashService.getRegisters(business.id);
    const registerId = registers[0].id;
    console.log(`[SETUP] Abriendo nueva sesión de caja en la registradora: ${registerId}...`);
    const warehouse = await prisma.warehouse.findFirst({ where: { businessId: business.id } });
    await cashService.openSession({
      businessId: business.id,
      userId: user.id,
      cashRegisterId: registerId,
      warehouseId: warehouse?.id || '',
      openingBalance: 1000,
      notes: 'Sesión de prueba trazabilidad real'
    });
    session = await cashService.getActiveSession(business.id, user.id);
  }

  if (!session) {
    console.error('No se pudo obtener ni abrir una sesión de caja.');
    return;
  }

  const activeSessionId = session.id;

  console.log(`[SETUP] Sesión activa identificada: ID=${activeSessionId}, openedById=${session.openedById}, businessId=${session.businessId}\n`);

  // 3. Ejecutar Venta CASH real invocando SaleService.create()
  const salePayload: any = {
    warehouseId: warehouse.id,
    cashSessionId: activeSessionId,
    paymentMethod: 'CASH',
    subtotal: 2500,
    totalAmount: 2500,
    items: [
      {
        productId: product.id,
        quantity: 1,
        unitPrice: 2500,
        totalAmount: 2500
      }
    ]
  };

  console.log('--- LOGS GENERADOS DURANTE LA VENTA (EFECTIVO $2500) ---');
  const createdSale = await saleService.create(business.id, user.id, salePayload);
  console.log('--- FIN DE LOGS DE VENTA ---\n');

  // 4. Consultar Base de Datos con Prisma
  const countMovements = await prisma.cashMovement.count({
    where: { cashSessionId: activeSessionId }
  });

  const last5Movements = await prisma.cashMovement.findMany({
    where: { cashSessionId: activeSessionId },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log('=== RESULTADO DE CONSULTAS PRISMA A LA BASE DE DATOS ===');
  console.log(`SELECT COUNT(*) FROM "CashMovement" WHERE cashSessionId = "${activeSessionId}":`, countMovements);
  console.log('SELECT * FROM "CashMovement" LIMIT 5:');
  console.log(JSON.stringify(last5Movements, null, 2));
  console.log('\n=======================================================\n');

  // 5. Invocación a GET /api/v1/cash/active (CashService.getActiveSession)
  const activeSessionResponse = await cashService.getActiveSession(business.id, user.id);

  console.log('=== RESPUESTA JSON COMPLETA DE GET /api/v1/cash/active ===');
  console.log(JSON.stringify({ success: true, data: activeSessionResponse }, null, 2));
  console.log('=========================================================\n');
}

main()
  .catch((err) => {
    console.error('Error en ejecución:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
