import { prisma } from '../config/db';
import { calculateSessionTotals } from '../services/cash.service';

export class DashboardRepository {
  async getSalesTotal(businessId: string, startDate: Date, endDate: Date): Promise<number> {
    const aggregate = await prisma.sale.aggregate({
      _sum: {
        totalAmount: true,
      },
      _count: {
        _all: true,
      },
      where: {
        businessId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          not: 'CANCELLED',
        },
      },
    });

    const totalSales = Number(aggregate._sum.totalAmount || 0);
    const salesCount = aggregate._count._all || 0;

    console.log('[DASHBOARD QUERY]', {
      salesCount,
      totalSales,
      startDate,
      endDate,
      businessId
    });

    return totalSales;
  }

  async getNewCustomersCount(businessId: string, startDate: Date): Promise<number> {
    return prisma.customer.count({
      where: {
        businessId,
        createdAt: {
          gte: startDate,
        },
      },
    });
  }

  async getStockSummary(businessId: string) {
    const totalProducts = await prisma.product.count({
      where: {
        businessId,
        status: 'ACTIVE',
      },
    });

    const productsWithoutStock = await prisma.product.count({
      where: {
        businessId,
        status: 'ACTIVE',
        OR: [
          {
            stocks: {
              none: {}
            }
          },
          {
            stocks: {
              every: {
                quantity: { lte: 0 }
              }
            }
          }
        ]
      },
    });

    return {
      totalProducts,
      withoutStock: productsWithoutStock,
    };
  }

  async getActiveCashRegister(businessId: string) {
    // Buscar la sesión activa en cualquier caja
    const activeSession = await prisma.cashSession.findFirst({
      where: {
        businessId,
        status: 'OPEN',
      },
      include: {
        cashRegister: true,
        cashMovements: true,
      },
      orderBy: {
        openedAt: 'desc',
      },
    });

    if (!activeSession) return null;

    const totals = calculateSessionTotals(activeSession);

    return {
      active: true,
      name: activeSession.cashRegister.name,
      balance: totals.expectedCashBalance,
    };
  }

  async getRecentSales(businessId: string, limit: number = 5) {
    const sales = await prisma.sale.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        customer: true,
        payments: {
          include: {
            paymentMethod: true,
          },
        },
      },
    });

    return sales.map(s => ({
      customer: s.customer?.name || 'Consumidor Final',
      paymentMethod: s.payments[0]?.paymentMethod?.name || 'Múltiples / Efectivo',
      amount: Number(s.totalAmount),
      status: s.status,
      createdAt: s.createdAt,
    }));
  }

  async getRecentActivity(businessId: string, limit: number = 5) {
    const logs = await prisma.activityLog.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: true,
      },
    });

    return logs.map(log => ({
      action: log.actionType,
      entity: log.entityName,
      user: log.user?.name || log.user?.email || 'Sistema',
      date: log.createdAt,
      newValues: log.newValues,
    }));
  }
}
