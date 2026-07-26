import { prisma } from '../config/db';
import { CashService } from '../services/cash.service';

async function main() {
  console.log('=== INVESTIGACIÓN TÉCNICA COMPLETA DE CAJA & VENTAS ===\n');

  const business = await prisma.business.findFirst();
  if (!business) {
    console.error('Sin empresa');
    return;
  }

  const users = await prisma.user.findMany({ where: { businessId: business.id } });
  console.log('Usuarios en la empresa:', users.map(u => ({ id: u.id, name: u.name, roleId: u.roleId })));

  // 1. Obtener todas las cajas abiertas
  const openSessions = await prisma.cashSession.findMany({
    where: { businessId: business.id, status: 'OPEN' },
    include: { cashRegister: true, openedBy: true }
  });

  console.log(`\n=== CAJAS ABIERTAS (Total: ${openSessions.length}) ===`);
  openSessions.forEach(s => {
    console.log(`=== CAJA ACTIVA ===`);
    console.log(`cashSession.id: ${s.id}`);
    console.log(`openedById: ${s.openedById} (${s.openedBy?.name})`);
    console.log(`businessId: ${s.businessId}`);
    console.log(`status: ${s.status}`);
    console.log(`cashRegister: ${s.cashRegister.name} (${s.cashRegister.code})`);
    console.log(`openedAt: ${s.openedAt}`);
    console.log('--------------------------------------------------');
  });

  // 2. Para cada sesión abierta, listar sus ventas y sus movimientos
  for (const s of openSessions) {
    console.log(`\n=== DETALLE DE SESIÓN ACTIVA ${s.id} ===`);
    
    const salesInSession = await prisma.sale.findMany({
      where: { cashSessionId: s.id },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`=== VENTAS DE LA SESIÓN (${salesInSession.length}) ===`);
    salesInSession.forEach(v => {
      console.log({
        id: v.id,
        cashSessionId: v.cashSessionId,
        createdAt: v.createdAt,
        status: v.status,
        totalAmount: Number(v.totalAmount)
      });
    });

    const movementsInSession = await prisma.cashMovement.findMany({
      where: { cashSessionId: s.id },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n=== MOVIMIENTOS DE LA SESIÓN (${movementsInSession.length}) ===`);
    movementsInSession.forEach(m => {
      console.log({
        id: m.id,
        saleId: m.referenceId,
        cashSessionId: m.cashSessionId,
        paymentMethod: m.paymentMethod,
        amount: Number(m.amount),
        type: m.type,
        reason: m.reason
      });
    });
  }

  // 3. Revisar si existen ventas HUÉRFANAS sin cashSessionId o asociadas a sesiones cerradas
  const salesWithoutSession = await prisma.sale.findMany({
    where: { businessId: business.id, cashSessionId: null },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log(`\n=== VENTAS SIN CASHSESSIONID (${salesWithoutSession.length}) ===`);
  salesWithoutSession.forEach(v => {
    console.log({
      id: v.id,
      businessId: v.businessId,
      cashSessionId: v.cashSessionId,
      createdAt: v.createdAt,
      status: v.status,
      totalAmount: Number(v.totalAmount)
    });
  });

  // 4. Invocación a CashService.getActiveSession para cada usuario de la empresa
  const cashService = new CashService();
  console.log('\n=== RESPUESTAS DE CAJA ACTIVA SEGÚN USUARIO (GET /api/v1/cash/active) ===');
  for (const u of users) {
    const res = await cashService.getActiveSession(business.id, u.id);
    console.log(`Usuario: ${u.name} (id: ${u.id})`);
    console.log(JSON.stringify(res ? {
      sessionId: res.id,
      cashRegisterName: res.cashRegister?.name,
      openedById: res.openedById,
      movementsCount: res.cashMovements?.length || 0,
      salesCount: res.sales?.length || 0,
      totals: res.totals
    } : 'SIN SESIÓN ACTIVA DE CAJA', null, 2));
    console.log('--------------------------------------------------');
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
