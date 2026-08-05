import { prisma } from '../config/db';

export class PosRepository {
  async countSalesToday(businessId: string, start: Date, end: Date, warehouseId?: string) {
    const where: any = {
      businessId,
      createdAt: {
        gte: start,
        lte: end,
      },
    };
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }
    return prisma.sale.count({ where });
  }

  async sumRevenueToday(businessId: string, start: Date, end: Date, warehouseId?: string, cashSessionId?: string) {
    const where: any = {
      businessId,
      status: {
        not: 'CANCELLED'
      }
    };

    if (cashSessionId) {
      where.cashSessionId = cashSessionId;
    } else {
      where.createdAt = {
        gte: start,
        lte: end,
      };
      if (warehouseId) {
        where.warehouseId = warehouseId;
      }
    }

    const aggregate = await prisma.sale.aggregate({
      _sum: {
        totalAmount: true,
      },
      where,
    });
    return Number(aggregate._sum.totalAmount || 0);
  }

  async countSalesForSession(businessId: string, cashSessionId: string) {
    return prisma.sale.count({
      where: {
        businessId,
        cashSessionId,
        status: {
          not: 'CANCELLED'
        }
      }
    });
  }

  async countPendingSales(businessId: string, warehouseId?: string) {
    const where: any = {
      businessId,
      status: {
        in: ['PENDING', 'DRAFT', 'WAITING_PAYMENT'],
      },
    };
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }
    return prisma.sale.count({ where });
  }
}
