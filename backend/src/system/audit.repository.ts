import { prisma } from '../config/db';

export class AuditRepository {
  async getPaginated(filters: any, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.businessId) where.businessId = filters.businessId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.entityName) where.entityName = filters.entityName;
    if (filters.actionType) where.actionType = filters.actionType;
    if (filters.search) {
       where.OR = [
          { actionType: { contains: filters.search, mode: 'insensitive' } },
          { entityName: { contains: filters.search, mode: 'insensitive' } },
          { ipAddress: { contains: filters.search, mode: 'insensitive' } },
       ];
    }

    if (filters.startDate || filters.endDate) {
       where.createdAt = {};
       if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
       if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const [data, total] = await Promise.all([
       prisma.activityLog.findMany({
          where,
          include: {
             business: { select: { id: true, name: true, taxId: true } },
             user: { select: { id: true, name: true, email: true, roleId: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
       }),
       prisma.activityLog.count({ where })
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getStats() {
    const today = new Date();
    today.setHours(0,0,0,0);

    const [
      total, 
      todayTotal, 
      logins, 
      errors, 
      payments, 
      planChanges,
      subsRenewed,
      staffActions
    ] = await Promise.all([
      prisma.activityLog.count(),
      prisma.activityLog.count({ where: { createdAt: { gte: today } } }),
      prisma.activityLog.count({ where: { actionType: 'LOGIN_SUCCESS' } }),
      prisma.activityLog.count({ where: { actionType: 'ERROR' } }),
      prisma.activityLog.count({ where: { OR: [{ actionType: 'PAYMENT_APPROVED' }, { actionType: 'PAYMENT_PENDING' }] } }),
      prisma.activityLog.count({ where: { actionType: 'PLAN_CHANGED' } }),
      prisma.activityLog.count({ where: { actionType: 'SUBSCRIPTION_RENEWED' } }),
      (prisma as any).activityLog.count({ where: { user: { is: { isStaff: true } } } }) // Staff users acting as SYSTEM
    ]);

    return { total, todayTotal, logins, errors, payments, planChanges, subsRenewed, staffActions };
  }
}
