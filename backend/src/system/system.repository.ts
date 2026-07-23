import { prisma } from '../config/db';

export class SystemRepository {
  async getSystemMetrics() {
    const totalBusinesses = await prisma.business.count();
    const activeBusinesses = await prisma.business.count({ where: { isActive: true } });
    const suspendedBusinesses = await prisma.business.count({ where: { isActive: false } });
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { isActive: true } });
    const totalProducts = await prisma.product.count();
    const totalCustomers = await prisma.customer.count();

    const salesAgg = await prisma.sale.aggregate({
      _sum: { totalAmount: true }
    });

    const purchasesAgg = await prisma.purchase.aggregate({
      _sum: { total: true }
    });

    // Subscriptions logic
    const subs = await (prisma as any).subscription.groupBy({
       by: ['status'],
       _count: { id: true }
    });
    
    let activeSubs = 0; let pendingSubs = 0; let expiredSubs = 0;
    subs.forEach((s: any) => {
       if (s.status === 'ACTIVE' || s.status === 'TRIAL') activeSubs += s._count.id;
       if (s.status === 'PENDING') pendingSubs += s._count.id;
       if (s.status === 'EXPIRED') expiredSubs += s._count.id;
    });

    const activePlansSubs = await (prisma as any).subscription.findMany({
       where: { status: 'ACTIVE' },
       include: { plan: { include: { prices: true } } }
    });

    // Invoice logic (Paid this month & pending/overdue)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const invoices = await (prisma as any).invoice.groupBy({
       by: ['status'],
       _count: { id: true },
    });

    const incomeThisMonth = await (prisma as any).invoice.aggregate({
       _sum: { amount: true },
       where: { status: 'PAID', paidAt: { gte: firstDay, lte: lastDay } }
    });

    let pendingInv = 0; let paidInv = 0; let overdueInv = 0;
    invoices.forEach((i: any) => {
       if (i.status === 'PENDING') pendingInv += i._count.id;
       if (i.status === 'PAID') paidInv += i._count.id;
       if (i.status === 'OVERDUE') overdueInv += i._count.id;
    });

    let mrrSum = 0;
    for (const sub of activePlansSubs) {
       if (sub.plan && sub.plan.prices) {
          const planPrice = sub.plan.prices.find((p: any) => p.billingCycle === sub.billingCycle && p.active);
          if (planPrice) {
             const price = Number(planPrice.price);
             if (sub.billingCycle === 'MONTHLY') mrrSum += price;
             else if (sub.billingCycle === 'QUARTERLY') mrrSum += price / 3;
             else if (sub.billingCycle === 'SEMIANNUAL') mrrSum += price / 6;
             else if (sub.billingCycle === 'YEARLY') mrrSum += price / 12;
             else if (sub.billingCycle === 'LIFETIME') mrrSum += price / 12;
          }
       }
    }
    const arr = mrrSum * 12;

    const churnCount = await (prisma as any).business.count({
       where: { OR: [{ isActive: false }, { deletedAt: { not: null } }] }
    });
    const churnPercent = totalBusinesses > 0 ? ((churnCount / totalBusinesses) * 100).toFixed(1) : '0';

    const newCompanies = await (prisma as any).business.count({
       where: { createdAt: { gte: firstDay, lte: lastDay } }
    });

    return {
      tenants: {
        total: totalBusinesses,
        active: activeBusinesses,
        suspended: suspendedBusinesses,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      revenue: {
        mrr: mrrSum,
        arr: arr,
        monthlyCollected: Number(incomeThisMonth._sum.amount || 0)
      },
      invoices: {
        pending: pendingInv,
        paid: paidInv,
        overdue: overdueInv
      },
      churn: {
        count: churnCount,
        percent: Number(churnPercent)
      },
      newCompanies: newCompanies,
      sales: {
        totalAmount: salesAgg._sum.totalAmount || 0,
      },
      products: {
        total: totalProducts,
      },
      clients: {
        total: totalCustomers,
      },
      subs: {
        active: activeSubs,
        expired: expiredSubs,
        pending: pendingSubs
      }
    };
  }

  async getBusinessOverview(id: string) {
    const business = await prisma.business.findUnique({
      where: { id }
    });

    if (!business) throw new Error('Tenant no encontrado en el ecosistema');

    const plan = await (prisma as any).plan.findFirst({
      where: { name: business.subscriptionPlan }
    });

    const usersCount = await prisma.user.count({ where: { businessId: id } });
    const productsCount = await prisma.product.count({ where: { businessId: id } });
    const salesCount = await prisma.sale.count({ where: { businessId: id } });
    const purchasesCount = await prisma.purchase.count({ where: { businessId: id } });
    const invoicesCount = await (prisma as any).invoice.count({ where: { subscription: { businessId: id } } });
    const subscriptionsCount = await (prisma as any).subscription.count({ where: { businessId: id } });
    const stocksCount = await prisma.stock.count({ where: { businessId: id } });
    const stockMovementsCount = await prisma.stockMovement.count({ where: { businessId: id } });

    // Try finding the last login of any user of this business
    const lastLoginUser = await prisma.user.findFirst({
       where: { businessId: id },
       orderBy: { updatedAt: 'desc' }
    });

    // Try finding the last activity log related to this business
    const lastActivity = await prisma.activityLog.findFirst({
       where: { businessId: id },
       orderBy: { createdAt: 'desc' }
    });

    // Get users registered info
    const dbUsers = await prisma.user.findMany({
       where: { businessId: id },
       select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          role: {
             select: { name: true }
          }
       }
    });

    let status = business.isActive ? 'ACTIVE' : 'SUSPENDED';
    if ((business as any).deletedAt) status = 'CANCELLED';

    // Mocking subscription details based natively on business defaults
    const subscription = {
      planName: plan?.name || business.subscriptionPlan || 'Free',
      status: status,
      startDate: business.createdAt,
      endsAt: business.subscriptionEndsAt || null,
      paymentMethod: 'No disponible'
    };

    return {
      business: {
        id: business.id,
        name: business.name,
        taxId: business.taxId,
        status,
        createdAt: business.createdAt,
        deletedAt: business.deletedAt
      },
      plan: {
        name: plan?.name || business.subscriptionPlan || 'Free',
        usersLimit: plan?.maxUsers || 10,
        productsLimit: plan?.maxProducts || 5000
      },
      subscription,
      usersList: dbUsers.map(u => ({
         id: u.id,
         name: u.name,
         email: u.email,
         isActive: u.isActive,
         roleName: u.role?.name || 'Administrador'
      })),
      usage: {
        users: usersCount,
        products: productsCount,
        sales: salesCount,
        purchases: purchasesCount,
        invoices: invoicesCount,
        subscriptions: subscriptionsCount,
        stocks: stocksCount,
        stockMovements: stockMovementsCount,
        storage: null
      },
      activity: {
        lastLogin: (lastLoginUser as any)?.updatedAt || null,
        lastActivity: lastActivity?.createdAt || null
      }
    };
  }

  async listAllUsers(filters: {
    search?: string;
    businessId?: string;
    roleId?: string;
    isActive?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: any = {};

    // --- Status filter (replaces old isActive-only approach) ---
    // 'active'    → isActive=true AND deletedAt=null
    // 'suspended' → isActive=false AND deletedAt=null
    // 'deleted'   → deletedAt IS NOT null
    // default (no status) → deletedAt=null  (exclude deleted from normal listing)
    if (filters.status === 'deleted') {
      where.deletedAt = { not: null };
    } else if (filters.status === 'active') {
      where.deletedAt = null;
      where.isActive = true;
    } else if (filters.status === 'suspended') {
      where.deletedAt = null;
      where.isActive = false;
    } else {
      // Default: only non-deleted users
      where.deletedAt = null;

      // Legacy isActive filter (backward-compatible)
      if (filters.isActive !== undefined && filters.isActive !== '') {
        where.isActive = filters.isActive === 'true';
      }
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters.businessId) {
      where.businessId = filters.businessId === 'unassigned' ? null : filters.businessId;
    }

    if (filters.roleId) {
      if (filters.roleId === 'staff') {
        where.isStaff = true;
      } else {
        // Combine with existing OR if present (search)
        const roleConditions = [
          { roleId: filters.roleId },
          { role: { name: { contains: filters.roleId, mode: 'insensitive' } } }
        ];
        if (where.OR) {
          // Wrap both search and role into AND so they don't conflict
          where.AND = [
            { OR: where.OR },
            { OR: roleConditions }
          ];
          delete where.OR;
        } else {
          where.OR = roleConditions;
        }
      }
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        business: {
          select: {
            id: true,
            name: true,
            subscriptionPlan: true,
            deletedAt: true
          }
        },
        role: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return users.map(u => ({
      ...u,
      displayName: u.deletedAt ? (u.originalName || u.name) : u.name,
      originalEmail: u.deletedAt ? (u.originalEmail || u.email) : u.email,
      name: u.deletedAt ? (u.originalName || u.name) : u.name,
      email: u.deletedAt ? (u.originalEmail || u.email) : u.email,
      deletedEmail: u.deletedAt ? u.email : undefined
    }));
  }

  async getUserDetails(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            subscriptionPlan: true,
            deletedAt: true
          }
        },
        role: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!user) return null;

    const loginCount = await prisma.refreshToken.count({
      where: { userId: id }
    });

    const lastLoginToken = await prisma.refreshToken.findFirst({
      where: { userId: id },
      orderBy: { createdAt: 'desc' }
    });

    const recentActivity = await prisma.activityLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    return {
      user: {
        id: user.id,
        name: user.deletedAt ? (user.originalName || user.name) : user.name,
        email: user.deletedAt ? (user.originalEmail || user.email) : user.email,
        isActive: user.isActive,
        isStaff: user.isStaff,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        deletedAt: user.deletedAt,
        displayName: user.deletedAt ? (user.originalName || user.name) : user.name,
        originalEmail: user.deletedAt ? (user.originalEmail || user.email) : user.email,
        deletedEmail: user.deletedAt ? user.email : undefined,
        business: user.business,
        role: user.role
      },
      loginCount,
      lastLogin: lastLoginToken ? lastLoginToken.createdAt : null,
      recentActivity
    };
  }

  async updateUserStatus(id: string, isActive: boolean) {
    if (isActive) {
      const user = await prisma.user.findUnique({ where: { id } });
      if (user && user.deletedAt) {
        // Restaurar usuario eliminado a su estado activo con sus datos originales
        return prisma.user.update({
          where: { id },
          data: {
            isActive: true,
            name: user.originalName || user.name,
            email: user.originalEmail || user.email,
            deletedAt: null,
            originalName: null,
            originalEmail: null
          }
        });
      }
    }
    return prisma.user.update({
      where: { id },
      data: { isActive }
    });
  }

  async deleteUser(id: string, forceSoftDelete: boolean = false) {
    return prisma.$transaction(async (tx) => {
      // 1. Delete user refresh tokens
      await tx.refreshToken.deleteMany({ where: { userId: id } });

      // 2. Delete user notifications
      await tx.notification.deleteMany({ where: { userId: id } });

      // 3. Delete user favorites
      await tx.favorite.deleteMany({ where: { userId: id } });

      if (forceSoftDelete) {
        const user = await tx.user.findUnique({ where: { id } });
        if (!user) return null;

        // GUARD: If user is already soft-deleted, do NOT re-anonymize.
        // This prevents nested names like "Usuario Eliminado (Usuario Eliminado (QA Admin))".
        if (user.deletedAt) {
          return user; // Already deleted, return as-is
        }

        const timestamp = Date.now();
        const deletedEmail = `deleted_${timestamp}_${user.email}`;

        // Soft delete: keep the row (preserving historical references) and flag as deleted.
        return tx.user.update({
          where: { id },
          data: {
            name: `Usuario Eliminado (${user.name})`,
            email: deletedEmail,
            password: `DELETED_${timestamp}`,
            isActive: false,
            // Keep roleId intact for historical role reporting
            deletedAt: new Date(),
            originalName: user.originalName || user.name,
            originalEmail: user.originalEmail || user.email
          }
        });
      } else {
        // Finally, physically delete the user record
        return tx.user.delete({
          where: { id }
        });
      }
    });
  }
}

