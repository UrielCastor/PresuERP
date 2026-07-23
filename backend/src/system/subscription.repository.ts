import { prisma } from '../config/db';
import { AppError } from '../utils/appError';

export class SubscriptionRepository {
  async findAll(filters?: {
    businessStatus?: string; // 'active' | 'deleted' | undefined (default: active only)
    subscriptionStatus?: string; // 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PENDING' | 'TRIAL' | undefined (all)
    search?: string;
  }) {
    const where: any = {};

    // --- Business status filter ---
    // Default: exclude subscriptions from deleted businesses
    if (filters?.businessStatus === 'deleted') {
      where.business = { deletedAt: { not: null } };
    } else if (filters?.businessStatus === 'all') {
      // No filter on business — show everything
    } else {
      // Default ('active' or undefined): only businesses that are NOT deleted
      where.business = { deletedAt: null };
    }

    // --- Subscription status filter ---
    if (filters?.subscriptionStatus) {
      where.status = filters.subscriptionStatus;
    }

    // --- Search by business name or taxId ---
    if (filters?.search) {
      // Merge with existing business condition
      where.business = {
        ...where.business,
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { taxId: { contains: filters.search } }
        ]
      };
    }

    return (prisma as any).subscription.findMany({
      where,
      include: {
        business: { select: { name: true, taxId: true, deletedAt: true, isActive: true } },
        plan: { include: { prices: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string) {
    return (prisma as any).subscription.findUnique({
      where: { id },
      include: {
        business: { select: { name: true, taxId: true, deletedAt: true, isActive: true } },
        plan: true
      }
    });
  }

  async findByBusinessId(businessId: string) {
    return (prisma as any).subscription.findMany({
      where: { businessId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async create(data: any) {
    return (prisma as any).subscription.create({ data });
  }

  async update(id: string, data: any) {
    return (prisma as any).subscription.update({
      where: { id },
      data
    });
  }
}
