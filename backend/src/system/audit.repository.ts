import { prisma } from '../config/db';

export class AuditRepository {
  async getPaginated(filters: any, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [
        {
          OR: [
            { businessId: 'SYSTEM' },
            { entityName: { in: ['PLAN', 'SUBSCRIPTION', 'INVOICE', 'PLAN_PRICE'] } },
            { actionType: { in: [
              'CREATE_STAFF', 'REMOVE_STAFF',
              'VIEW_BUSINESS', 'VIEW_USER', 'SUSPEND_USER', 'RESTORE_USER', 'DELETE_USER_FORCED', 'DELETE_USER',
              'PLAN_PRICE_REACTIVATED', 'PLAN_PRICE_CREATED', 'PLAN_PRICE_UPDATED', 'PLAN_PRICE_ACTIVATED', 'PLAN_PRICE_DEACTIVATED', 'PLAN_PRICE_DELETED',
              'PAYMENT_APPROVED', 'PAYMENT_PENDING', 'SUBSCRIPTION_RENEWED', 'PLAN_CHANGED', 'LOGIN_SUCCESS', 'ERROR'
            ] } }
          ]
        }
      ]
    };

    if (filters.businessId) where.AND.push({ businessId: filters.businessId });
    if (filters.userId) where.AND.push({ userId: filters.userId });
    if (filters.entityName) where.AND.push({ entityName: filters.entityName });
    if (filters.actionType) where.AND.push({ actionType: filters.actionType });

    if (filters.search) {
       where.AND.push({
         OR: [
            { actionType: { contains: filters.search, mode: 'insensitive' } },
            { entityName: { contains: filters.search, mode: 'insensitive' } },
            { ipAddress: { contains: filters.search, mode: 'insensitive' } },
         ]
       });
    }

    if (filters.startDate || filters.endDate) {
       const dateFilter: any = {};
       if (filters.startDate) dateFilter.gte = new Date(filters.startDate);
       if (filters.endDate) dateFilter.lte = new Date(filters.endDate);
       where.AND.push({ createdAt: dateFilter });
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
