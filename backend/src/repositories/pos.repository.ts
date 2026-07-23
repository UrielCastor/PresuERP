import { prisma } from '../config/db';

export class PosRepository {
  async countSalesToday(businessId: string, start: Date, end: Date) {
    return prisma.sale.count({
      where: {
        businessId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });
  }

  async sumRevenueToday(businessId: string, start: Date, end: Date) {
    const aggregate = await prisma.sale.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: {
        businessId,
        createdAt: {
          gte: start,
          lte: end,
        },
        // We consider all non-cancelled sales as revenue, or only CONFIRMED?
        // Usually CONFIRMED/COMPLETED
        status: {
          not: 'CANCELLED'
        }
      },
    });
    return Number(aggregate._sum.totalAmount || 0);
  }

  async countPendingSales(businessId: string) {
    return prisma.sale.count({
      where: {
        businessId,
        status: {
          in: ['PENDING', 'DRAFT', 'WAITING_PAYMENT'],
        },
      },
    });
  }
}
