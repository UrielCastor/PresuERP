import { prisma } from '../config/db';
import { calculateSessionTotals } from '../services/cash.service';

export class DashboardRepository {
  async getSalesTotal(businessId: string, startDate: Date, endDate: Date, warehouseId?: string): Promise<number> {
    const cleanWarehouseId = (warehouseId && warehouseId !== 'ALL' && warehouseId !== 'undefined' && warehouseId !== 'null' && warehouseId !== '') ? warehouseId : undefined;

    // Logs temporales solicitados
    console.log('[Dashboard Venta del Día]');
    console.log('businessId:', businessId);
    console.log('warehouseId:', warehouseId);
    console.log('periodo:', `${startDate.toISOString()} - ${endDate.toISOString()}`);
    console.log('filtro aplicado:', cleanWarehouseId ? { warehouseId: cleanWarehouseId } : 'Consolidado (Todos los locales)');

    const where: any = {
      businessId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: 'COMPLETED',
    };

    if (cleanWarehouseId) {
      where.warehouseId = cleanWarehouseId;
    }

    const aggregate = await prisma.sale.aggregate({
      _sum: {
        totalAmount: true,
      },
      _count: {
        _all: true,
      },
      where,
    });

    const totalSales = Number(aggregate._sum.totalAmount || 0);
    console.log('resultado:', totalSales);
    console.log('--------------------------------------------------');

    return totalSales;
  }

  async getNewCustomersCount(businessId: string, startDate: Date, warehouseId?: string): Promise<number> {
    const where: any = {
      businessId,
      createdAt: {
        gte: startDate,
      },
    };
    if (warehouseId && warehouseId !== 'ALL') {
      where.sales = { some: { warehouseId } };
    }
    return prisma.customer.count({ where });
  }

  async getStockSummary(businessId: string, warehouseId?: string) {
    const totalProducts = await prisma.product.count({
      where: {
        businessId,
        status: 'ACTIVE',
      },
    });

    let productsWithoutStock = 0;
    if (warehouseId && warehouseId !== 'ALL') {
      productsWithoutStock = await prisma.product.count({
        where: {
          businessId,
          status: 'ACTIVE',
          OR: [
            {
              stocks: {
                none: { warehouseId }
              }
            },
            {
              stocks: {
                every: {
                  warehouseId,
                  quantity: { lte: 0 }
                }
              }
            }
          ]
        },
      });
    } else {
      productsWithoutStock = await prisma.product.count({
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
    }

    return {
      totalProducts,
      withoutStock: productsWithoutStock,
    };
  }

  async getActiveCashRegister(businessId: string, warehouseId?: string) {
    const registerWhere = warehouseId && warehouseId !== 'ALL' ? { warehouseId } : undefined;
    const activeSession = await prisma.cashSession.findFirst({
      where: {
        businessId,
        status: 'OPEN',
        ...(registerWhere && { cashRegister: registerWhere }),
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

  async getRecentSales(businessId: string, limit: number = 5, warehouseId?: string) {
    const where: any = { businessId };
    if (warehouseId && warehouseId !== 'ALL') {
      where.warehouseId = warehouseId;
    }
    const sales = await prisma.sale.findMany({
      where,
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
