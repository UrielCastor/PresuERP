import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

export type LimitResourceType =
  | 'users'
  | 'products'
  | 'warehouses'
  | 'customers'
  | 'suppliers'
  | 'cashRegisters'
  | 'roles';

export const checkPlanLimit = (resource: LimitResourceType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next();
      if (req.user.isStaff) return next(); // Staff bypasses tenant limits

      const businessId = req.user.businessId;
      if (!businessId) return next();

      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { subscriptionPlan: true }
      });

      if (!business) return next();

      // Find plan details
      const plan = await prisma.plan.findFirst({
        where: { name: business.subscriptionPlan }
      }) || await prisma.plan.findFirst({ where: { isDefault: true } });

      if (!plan) return next();

      // Parse structured limits from features JSON or fallback to model columns
      let limits: Record<string, number | null> = {
        maxUsers: plan.maxUsers === 0 ? null : plan.maxUsers,
        maxProducts: plan.maxProducts === 0 ? null : plan.maxProducts,
        maxWarehouses: null,
        maxCustomers: null,
        maxSuppliers: null,
        maxCashRegisters: null,
        maxRoles: null,
      };

      if (plan.features) {
        try {
          const parsed = JSON.parse(plan.features);
          if (parsed && parsed.limits) {
            limits = { ...limits, ...parsed.limits };
          }
        } catch (e) {
          // Fallback
        }
      }

      let maxLimit: number | null = null;
      let currentCount = 0;
      let resourceLabel = '';

      switch (resource) {
        case 'users':
          maxLimit = limits.maxUsers ?? (plan.maxUsers === 0 ? null : plan.maxUsers);
          currentCount = await prisma.user.count({ where: { businessId } });
          resourceLabel = 'usuarios';
          break;

        case 'products':
          maxLimit = limits.maxProducts ?? (plan.maxProducts === 0 ? null : plan.maxProducts);
          currentCount = await prisma.product.count({ where: { businessId } });
          resourceLabel = 'productos';
          break;

        case 'warehouses':
          maxLimit = limits.maxWarehouses ?? null;
          currentCount = await prisma.warehouse.count({ where: { businessId } });
          resourceLabel = 'depósitos';
          break;

        case 'customers':
          maxLimit = limits.maxCustomers ?? null;
          currentCount = await prisma.customer.count({ where: { businessId } });
          resourceLabel = 'clientes';
          break;

        case 'suppliers':
          maxLimit = limits.maxSuppliers ?? null;
          currentCount = await prisma.supplier.count({ where: { businessId } });
          resourceLabel = 'proveedores';
          break;

        case 'cashRegisters':
          maxLimit = limits.maxCashRegisters ?? null;
          currentCount = await prisma.cashRegister.count({ where: { businessId } });
          resourceLabel = 'cajas de cobro';
          break;

        case 'roles':
          maxLimit = limits.maxRoles ?? null;
          currentCount = await prisma.role.count({ where: { businessId } });
          resourceLabel = 'roles';
          break;
      }

      // If limit is not null and current count >= maxLimit, block request!
      if (maxLimit !== null && maxLimit !== undefined && maxLimit > 0 && currentCount >= maxLimit) {
        return res.status(403).json({
          success: false,
          code: 'PLAN_LIMIT_REACHED',
          limitType: resource,
          currentCount,
          maxLimit,
          planName: plan.name,
          message: `Has alcanzado el límite de ${resourceLabel} (${currentCount}/${maxLimit}) de tu plan ${plan.name}. Actualiza tu suscripción para continuar.`
        });
      }

      return next();
    } catch (error) {
      next(error);
    }
  };
};
