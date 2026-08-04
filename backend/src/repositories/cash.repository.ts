import { prisma } from '../config/db';

export class CashRepository {
  async findActiveSessionByUser(userId: string, businessId: string, warehouseId?: string) {
    if (warehouseId && warehouseId !== 'ALL') {
      return prisma.cashSession.findFirst({
        where: {
          businessId,
          warehouseId,
          status: 'OPEN',
        },
        include: {
          warehouse: true,
          cashRegister: { include: { warehouse: true } },
        },
      });
    }

    return prisma.cashSession.findFirst({
      where: {
        businessId,
        status: 'OPEN',
      },
      include: {
        warehouse: true,
        cashRegister: { include: { warehouse: true } },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async findActiveSessionWithDetails(businessId: string, userId?: string, warehouseId?: string) {
    const validWhId = warehouseId && warehouseId !== 'ALL' ? warehouseId : undefined;
    
    // 1. Search OPEN session directly for specified warehouseId
    if (validWhId) {
      const sessionByWh = await prisma.cashSession.findFirst({
        where: {
          businessId,
          status: 'OPEN',
          OR: [
            { warehouseId: validWhId },
            { cashRegister: { warehouseId: validWhId } }
          ]
        },
        include: {
          cashRegister: { include: { warehouse: true } },
          warehouse: true,
          openedBy: { select: { id: true, name: true, email: true } },
          cashMovements: {
            include: {
              paymentMethodRel: true,
              createdByUser: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          sales: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { openedAt: 'desc' },
      });
      if (sessionByWh) return sessionByWh;
    }

    // 2. Fallback: Search OPEN session across authorized warehouses for the user
    if (userId) {
      const userWarehouses = await prisma.userWarehouse.findMany({
        where: { userId },
        select: { warehouseId: true },
      });
      if (userWarehouses.length > 0) {
        const allowedWhIds = userWarehouses.map((uw) => uw.warehouseId);
        const sessionByUserWh = await prisma.cashSession.findFirst({
          where: {
            businessId,
            warehouseId: { in: allowedWhIds },
            status: 'OPEN',
          },
          include: {
            cashRegister: { include: { warehouse: true } },
            warehouse: true,
            openedBy: { select: { id: true, name: true, email: true } },
            cashMovements: {
              include: {
                paymentMethodRel: true,
                createdByUser: { select: { id: true, name: true, email: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
            sales: {
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { openedAt: 'desc' },
        });
        if (sessionByUserWh) return sessionByUserWh;
      }
    }

    // 3. Global fallback for business
    return prisma.cashSession.findFirst({
      where: {
        businessId,
        status: 'OPEN',
      },
      include: {
        cashRegister: { include: { warehouse: true } },
        warehouse: true,
        openedBy: { select: { id: true, name: true, email: true } },
        cashMovements: {
          include: {
            paymentMethodRel: true,
            createdByUser: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        sales: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async findActiveSessionByRegister(cashRegisterId: string, businessId: string) {
    return prisma.cashSession.findFirst({
      where: {
        businessId,
        cashRegisterId,
        status: 'OPEN',
      },
      include: {
        warehouse: true,
        cashRegister: { include: { warehouse: true } },
      },
    });
  }

  async openSession(data: any, tx?: any) {
    const db = tx || prisma;
    return db.cashSession.create({
      data,
      include: {
        warehouse: true,
        cashRegister: { include: { warehouse: true } },
      },
    });
  }

  async closeSession(sessionId: string, data: any) {
    return prisma.cashSession.update({
      where: { id: sessionId },
      data,
    });
  }

  async createMovement(data: any, tx?: any) {
    const db = tx || prisma;
    return db.cashMovement.create({
      data,
    });
  }

  async incrementSessionTransactions(sessionId: string, amount: number, tx?: any) {
    const db = tx || prisma;
    return db.cashSession.update({
      where: { id: sessionId },
      data: {
        cashTransactionsTotal: {
          increment: amount,
        },
      },
    });
  }

  async listSessions(businessId: string, filters: any = {}, warehouseId?: string) {
    const registerWhere = warehouseId && warehouseId !== 'ALL' ? { warehouseId } : undefined;
    return prisma.cashSession.findMany({
      where: {
        businessId,
        ...(registerWhere && { cashRegister: registerWhere }),
        ...filters,
      },
      include: {
        cashRegister: { include: { warehouse: true } },
        warehouse: true,
        openedBy: true,
        closedBy: true,
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async getSessionWithDetails(sessionId: string, businessId: string, tx?: any) {
    const db = tx || prisma;
    return db.cashSession.findFirst({
      where: { id: sessionId, businessId },
      include: {
        cashRegister: { include: { warehouse: true } },
        warehouse: true,
        openedBy: true,
        cashMovements: {
          include: {
            paymentMethodRel: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        sales: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async listRegisters(businessId: string, warehouseId?: string) {
    const where: any = { businessId, isActive: true };
    if (warehouseId && warehouseId !== 'ALL') {
      where.warehouseId = warehouseId;
    }
    return prisma.cashRegister.findMany({ where });
  }
}
