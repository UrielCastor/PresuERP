import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../utils/appError';

export class PaymentRequiredError extends AppError {
  constructor(message: string = 'La suscripción de su empresa ha vencido. Por favor, renueve su plan para continuar utilizando el sistema.') {
    super(message, 402);
  }
}

/**
 * Middleware to enforce SaaS subscription validity.
 * Staff (SuperAdmins) bypass this check.
 * Tenant users are blocked with HTTP 402 Payment Required if subscription has expired or business is inactive/suspended.
 */
export const requireActiveSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next();
    }

    // Global SaaS Staff bypasses tenant subscription checks
    if (req.user.isStaff) {
      return next();
    }

    const businessId = req.user.businessId;
    if (!businessId) {
      return next();
    }

    console.log('🔍 [REQUIRE_ACTIVE_SUBSCRIPTION] Incoming BusinessID:', businessId);
    console.log('🕒 [TIMEZONE DEBUG]', {
      now: new Date(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    // 1. Fetch business status and expiration date
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        isActive: true,
        subscriptionPlan: true,
        subscriptionEndsAt: true,
      },
    });

    if (!business) {
      return next(new AppError('Empresa no encontrada', 404));
    }

    if (!business.isActive) {
      console.log('[SUBSCRIPTION BLOCK]', {
        reason: 'business.isActive is false',
        business,
      });
      return next(new PaymentRequiredError('Su empresa se encuentra inactiva o suspendida. Por favor, contacte al soporte del sistema.'));
    }

    // 2. Verify subscriptionEndsAt expiration date
    if (business.subscriptionEndsAt && new Date(business.subscriptionEndsAt) < new Date()) {
      console.log('[SUBSCRIPTION BLOCK]', {
        reason: 'business.subscriptionEndsAt < now',
        subscriptionEndsAt: business.subscriptionEndsAt,
        now: new Date(),
      });
      return next(new PaymentRequiredError('La suscripción de su empresa ha vencido. Por favor, renueve su plan para continuar utilizando el sistema.'));
    }

    // 3. Verify Subscription table record status if present
    // Exact Prisma Query: prisma.subscription.findFirst({ where: { businessId: business.id }, orderBy: { createdAt: 'desc' } })
    const latestSub = await (prisma as any).subscription.findFirst({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
    });

    console.log('[SUBSCRIPTION DB RECORD RECUPERADO]', {
      businessId,
      query: "prisma.subscription.findFirst({ where: { businessId: business.id }, orderBy: { createdAt: 'desc' } })",
      subscription: latestSub,
      dateComparison: latestSub ? {
        startDate: latestSub.startDate,
        renewalDate: latestSub.renewalDate,
        endDate: latestSub.endDate,
        now: new Date(),
        isEndDateBeforeNow: latestSub.endDate ? new Date(latestSub.endDate) < new Date() : false,
      } : null,
    });

    if (latestSub) {
      if (['EXPIRED', 'CANCELLED', 'SUSPENDED'].includes(latestSub.status)) {
        console.log('[SUBSCRIPTION BLOCK]', {
          reason: `status !== ACTIVE (status is ${latestSub.status})`,
          subscription: latestSub,
        });
        return next(new PaymentRequiredError(`La suscripción de su empresa se encuentra en estado ${latestSub.status}. Por favor, renueve su plan para continuar.`));
      }
      if (latestSub.endDate && new Date(latestSub.endDate) < new Date()) {
        console.log('[SUBSCRIPTION BLOCK]', {
          reason: 'endDate < new Date()',
          subscription: latestSub,
          endDate: latestSub.endDate,
          now: new Date(),
        });
        return next(new PaymentRequiredError('La suscripción de su empresa ha vencido. Por favor, renueve su plan para continuar utilizando el sistema.'));
      }
    }

    return next();
  } catch (error) {
    next(error);
  }
};
