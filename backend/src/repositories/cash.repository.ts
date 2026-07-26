import { prisma } from '../config/db';

export class CashRepository {
  async findActiveSessionByUser(userId: string, businessId: string) {
    return prisma.cashSession.findFirst({
      where: {
        businessId,
        openedById: userId,
        status: 'OPEN',
      },
      include: {
        cashRegister: true,
      },
    });
  }

  async findActiveSessionWithDetails(businessId: string, userId?: string) {
    let session = null;
    if (userId) {
      session = await prisma.cashSession.findFirst({
        where: {
          businessId,
          openedById: userId,
          status: 'OPEN',
        },
        include: {
          cashRegister: true,
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
      });
    }

    if (!session) {
      session = await prisma.cashSession.findFirst({
        where: {
          businessId,
          status: 'OPEN',
        },
        include: {
          cashRegister: true,
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

    return session;
  }

  async findActiveSessionByRegister(cashRegisterId: string, businessId: string) {
    return prisma.cashSession.findFirst({
      where: {
        businessId,
        cashRegisterId,
        status: 'OPEN',
      },
    });
  }

  async openSession(data: any) {
    return prisma.cashSession.create({
      data,
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

  async listSessions(businessId: string, filters: any = {}) {
    return prisma.cashSession.findMany({
      where: {
        businessId,
        ...filters,
      },
      include: {
        cashRegister: true,
        openedBy: true,
        closedBy: true,
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async getSessionWithDetails(sessionId: string, businessId: string) {
    return prisma.cashSession.findFirst({
      where: { id: sessionId, businessId },
      include: {
        cashRegister: true,
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

  async listRegisters(businessId: string) {
    return prisma.cashRegister.findMany({
      where: { businessId, isActive: true },
    });
  }
}
