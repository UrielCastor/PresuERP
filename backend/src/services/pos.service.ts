import { PosRepository } from '../repositories/pos.repository';
import { prisma } from '../config/db';

export class PosService {
  private posRepo = new PosRepository();

  async getDashboardSummary(businessId: string, userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [salesToday, revenueToday, pendingSales] = await Promise.all([
      this.posRepo.countSalesToday(businessId, today, endOfDay),
      this.posRepo.sumRevenueToday(businessId, today, endOfDay),
      this.posRepo.countPendingSales(businessId),
    ]);

    const averageTicket = salesToday > 0 ? Math.round(revenueToday / salesToday) : 0;

    // Get main warehouse
    const mainWarehouse = await prisma.warehouse.findFirst({
      where: { businessId, isMain: true, status: 'ACTIVE' },
    }) || await prisma.warehouse.findFirst({
      where: { businessId, status: 'ACTIVE' },
    });

    // Get current user active session or fallback to any active register
    const activeSession = await prisma.cashSession.findFirst({
      where: { businessId, status: 'OPEN', openedById: userId },
      include: { cashRegister: true },
    });

    const cashRegister = activeSession?.cashRegister || await prisma.cashRegister.findFirst({
      where: { businessId, isActive: true },
    });

    return {
      salesToday,
      revenueToday,
      averageTicket,
      pendingSales,
      warehouse: mainWarehouse ? { id: mainWarehouse.id, name: mainWarehouse.name } : null,
      cashRegister: cashRegister ? { id: cashRegister.id, name: cashRegister.name } : null,
    };
  }
}
