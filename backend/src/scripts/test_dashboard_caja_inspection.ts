import { prisma } from '../config/db';
import { DashboardService } from '../services/dashboard.service';
import { CashService } from '../services/cash.service';
import { startOfDay, endOfDay } from 'date-fns';

async function main() {
  console.log('=== INSPECCIÓN DE BACKEND: DASHBOARD & CAJA ===\n');

  const business = await prisma.business.findFirst();
  if (!business) {
    console.error('Sin empresa en BD');
    return;
  }

  const user = await prisma.user.findFirst({ where: { businessId: business.id } });
  if (!user) {
    console.error('Sin usuario en BD');
    return;
  }

  const dashboardService = new DashboardService();
  const cashService = new CashService();

  console.log('--- 1. EJECUTANDO DASHBOARD SERVICE ---');
  const dashboardData = await dashboardService.getDashboardData(business.id);
  console.log('Resultado de getDashboardData():', JSON.stringify(dashboardData.salesToday, null, 2));

  console.log('\n--- 2. ANALIZANDO FECHAS Y VENTAS EN DB ---');
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  console.log('Fechas calculadas por date-fns:', {
    now: now.toISOString(),
    todayStart: todayStart.toISOString(),
    todayEnd: todayEnd.toISOString()
  });

  const salesTodayInDb = await prisma.sale.findMany({
    where: {
      businessId: business.id,
      createdAt: {
        gte: todayStart,
        lte: todayEnd,
      },
      status: { not: 'CANCELLED' }
    },
    select: {
      id: true,
      documentNumber: true,
      totalAmount: true,
      status: true,
      createdAt: true,
      cashSessionId: true
    }
  });
  console.log(`Ventas encontradas en DB entre ${todayStart.toISOString()} y ${todayEnd.toISOString()}: ${salesTodayInDb.length}`);
  console.log(JSON.stringify(salesTodayInDb, null, 2));

  const totalSalesAllTime = await prisma.sale.findMany({
    where: { businessId: business.id },
    select: {
      id: true,
      documentNumber: true,
      totalAmount: true,
      status: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log('\nÚltimas 10 ventas en BD (sin filtro de fecha):');
  console.log(JSON.stringify(totalSalesAllTime, null, 2));

  console.log('\n--- 3. EJECUTANDO CAJA SERVICE ---');
  const cajaData = await cashService.getActiveSession(business.id, user.id);
  console.log('Resultado de getActiveSession():', JSON.stringify(cajaData ? { id: cajaData.id, totals: cajaData.totals } : null, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
