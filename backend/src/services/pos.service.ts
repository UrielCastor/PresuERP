import { PosRepository } from '../repositories/pos.repository';
import { prisma } from '../config/db';

export class PosService {
  private posRepo = new PosRepository();

  async getDashboardSummary(businessId: string, userId: string, options?: { warehouseId?: string; cashSessionId?: string }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const warehouseId = options?.warehouseId;
    const cashSessionId = options?.cashSessionId;

    const [salesToday, revenueToday, pendingSales, sessionSalesCount] = await Promise.all([
      this.posRepo.countSalesToday(businessId, today, endOfDay, warehouseId),
      this.posRepo.sumRevenueToday(businessId, today, endOfDay, warehouseId, cashSessionId),
      this.posRepo.countPendingSales(businessId, warehouseId),
      cashSessionId ? this.posRepo.countSalesForSession(businessId, cashSessionId) : Promise.resolve(0),
    ]);

    const divisor = cashSessionId ? sessionSalesCount : salesToday;
    const averageTicket = divisor > 0 ? Math.round(revenueToday / divisor) : 0;

    // Get main warehouse
    const mainWarehouse = warehouseId
      ? await prisma.warehouse.findFirst({ where: { id: warehouseId, businessId } })
      : await prisma.warehouse.findFirst({
          where: { businessId, isMain: true, status: 'ACTIVE' },
        }) || await prisma.warehouse.findFirst({
          where: { businessId, status: 'ACTIVE' },
        });

    // Get current user active session or fallback to any active register
    const activeSession = cashSessionId
      ? await prisma.cashSession.findFirst({
          where: { id: cashSessionId, businessId },
          include: { cashRegister: true }
        })
      : await prisma.cashSession.findFirst({
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
