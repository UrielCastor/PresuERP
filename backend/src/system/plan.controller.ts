import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

export class PlanController {
  
  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await prisma.plan.findMany({
        include: { prices: true },
        orderBy: { code: 'asc' }
      });

      // Calculate subscribed business count for each plan
      const enrichedPlans = await Promise.all(
        plans.map(async (plan) => {
          const subCount = await prisma.subscription.count({
            where: { planId: plan.id }
          });
          const bizCount = await prisma.business.count({
            where: { subscriptionPlan: plan.name }
          });
          const businessesCount = Math.max(subCount, bizCount);

          return {
            ...plan,
            businessesCount
          };
        })
      );

      res.status(200).json({ success: true, data: enrichedPlans });
    } catch (error) { next(error); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, code, maxUsers, maxProducts, features, active, isDefault, monthlyPrice, yearlyPrice } = req.body;

      // Validation 1: Name / Code uniqueness
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'El nombre del plan es obligatorio.' });
      }
      if (!code || !code.trim()) {
        return res.status(400).json({ success: false, message: 'El código del plan es obligatorio.' });
      }

      const existing = await prisma.plan.findFirst({
        where: { OR: [{ name: name.trim() }, { code: code.trim() }] }
      });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Ya existe un plan registrado con ese nombre o código.' });
      }

      // Validation 2: Non-negative limits and prices
      const usersVal = Number(maxUsers) || 0;
      const productsVal = Number(maxProducts) || 0;
      if (usersVal < 0 || productsVal < 0) {
        return res.status(400).json({ success: false, message: 'Los límites no pueden ser valores negativos.' });
      }

      const plan = await prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.plan.updateMany({
            where: { isDefault: true },
            data: { isDefault: false }
          });
        }
        const createdPlan = await tx.plan.create({
          data: {
            name: name.trim(),
            code: code.trim().toUpperCase(),
            maxUsers: usersVal,
            maxProducts: productsVal,
            features: typeof features === 'object' ? JSON.stringify(features) : features,
            active: active !== undefined ? !!active : true,
            isDefault: !!isDefault
          }
        });

        // Upsert Monthly Price
        if (monthlyPrice !== undefined && monthlyPrice !== null && Number(monthlyPrice) >= 0) {
          await tx.planPrice.create({
            data: {
              planId: createdPlan.id,
              billingCycle: 'MONTHLY',
              price: Number(monthlyPrice),
              active: true
            }
          });
        }

        // Upsert Yearly Price
        if (yearlyPrice !== undefined && yearlyPrice !== null && Number(yearlyPrice) >= 0) {
          await tx.planPrice.create({
            data: {
              planId: createdPlan.id,
              billingCycle: 'YEARLY',
              price: Number(yearlyPrice),
              active: true
            }
          });
        }

        return tx.plan.findUnique({
          where: { id: createdPlan.id },
          include: { prices: true }
        });
      });

      res.status(201).json({ success: true, data: plan });
    } catch (error) { next(error); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, code, maxUsers, maxProducts, features, active, isDefault, monthlyPrice, yearlyPrice } = req.body;
      const planId = req.params.id;

      const usersVal = Number(maxUsers) || 0;
      const productsVal = Number(maxProducts) || 0;
      if (usersVal < 0 || productsVal < 0) {
        return res.status(400).json({ success: false, message: 'Los límites no pueden ser valores negativos.' });
      }

      const plan = await prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.plan.updateMany({
            where: { isDefault: true },
            data: { isDefault: false }
          });
        }

        const updated = await tx.plan.update({
          where: { id: planId },
          data: {
            name: name ? name.trim() : undefined,
            code: code ? code.trim().toUpperCase() : undefined,
            maxUsers: usersVal,
            maxProducts: productsVal,
            features: typeof features === 'object' ? JSON.stringify(features) : features,
            active: active !== undefined ? !!active : undefined,
            isDefault: isDefault !== undefined ? !!isDefault : undefined
          }
        });

        // Upsert Monthly Price
        if (monthlyPrice !== undefined && monthlyPrice !== null && Number(monthlyPrice) >= 0) {
          const existingMonthly = await tx.planPrice.findFirst({
            where: { planId, billingCycle: 'MONTHLY' }
          });
          if (existingMonthly) {
            await tx.planPrice.update({
              where: { id: existingMonthly.id },
              data: { price: Number(monthlyPrice), active: true }
            });
          } else {
            await tx.planPrice.create({
              data: { planId, billingCycle: 'MONTHLY', price: Number(monthlyPrice), active: true }
            });
          }
        }

        // Upsert Yearly Price
        if (yearlyPrice !== undefined && yearlyPrice !== null && Number(yearlyPrice) >= 0) {
          const existingYearly = await tx.planPrice.findFirst({
            where: { planId, billingCycle: 'YEARLY' }
          });
          if (existingYearly) {
            await tx.planPrice.update({
              where: { id: existingYearly.id },
              data: { price: Number(yearlyPrice), active: true }
            });
          } else {
            await tx.planPrice.create({
              data: { planId, billingCycle: 'YEARLY', price: Number(yearlyPrice), active: true }
            });
          }
        }

        return tx.plan.findUnique({
          where: { id: planId },
          include: { prices: true }
        });
      });

      res.status(200).json({ success: true, data: plan });
    } catch (error) { next(error); }
  };

  duplicate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const originalPlan = await prisma.plan.findUnique({
        where: { id: req.params.id },
        include: { prices: true }
      });

      if (!originalPlan) {
        return res.status(404).json({ success: false, message: 'Plan original no encontrado.' });
      }

      let newName = `Copia de ${originalPlan.name}`;
      let counter = 1;
      while (await prisma.plan.findFirst({ where: { name: newName } })) {
        newName = `Copia de ${originalPlan.name} (${counter})`;
        counter++;
      }

      const newCode = `COPY_${originalPlan.code}_${Date.now().toString().slice(-4)}`;

      const duplicated = await prisma.$transaction(async (tx) => {
        const newPlan = await tx.plan.create({
          data: {
            name: newName,
            code: newCode,
            maxUsers: originalPlan.maxUsers,
            maxProducts: originalPlan.maxProducts,
            features: originalPlan.features,
            active: false,
            isDefault: false
          }
        });

        // Copy prices
        for (const priceObj of originalPlan.prices) {
          await tx.planPrice.create({
            data: {
              planId: newPlan.id,
              billingCycle: priceObj.billingCycle,
              price: priceObj.price,
              active: priceObj.active
            }
          });
        }

        return tx.plan.findUnique({
          where: { id: newPlan.id },
          include: { prices: true }
        });
      });

      res.status(201).json({ success: true, data: duplicated });
    } catch (error) { next(error); }
  };

  deletePlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.id;
      const targetPlan = await prisma.plan.findUnique({ where: { id: planId } });

      if (!targetPlan) {
        return res.status(404).json({ success: false, message: 'Plan no encontrado.' });
      }

      const subCount = await prisma.subscription.count({ where: { planId } });
      const bizCount = await prisma.business.count({ where: { subscriptionPlan: targetPlan.name } });
      const totalCount = Math.max(subCount, bizCount);

      if (totalCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Este plan está siendo utilizado por ${totalCount} empresa${totalCount > 1 ? 's' : ''}. Debe migrarlas antes de eliminarlo.`
        });
      }

      await prisma.plan.delete({ where: { id: planId } });
      res.status(200).json({ success: true, message: 'Plan eliminado correctamente.' });
    } catch (error) { next(error); }
  };

  changeBusinessPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { planName } = req.body;
      
      const business = await prisma.business.findUnique({
        where: { id: req.params.id }
      });

      if (!business) {
         return res.status(404).json({ success: false, error: 'Empresa no encontrada' });
      }

      await prisma.business.update({
        where: { id: req.params.id },
        data: { subscriptionPlan: planName }
      });

      // Registrar en audit log general (actividad de SUPER_ADMIN)
      await prisma.activityLog.create({
         data: {
             businessId: req.params.id,
             actionType: 'UPDATE',
             entityName: 'BUSINESS',
             entityId: req.params.id,
             newValues: JSON.stringify({ 
                subscriptionPlan: planName, 
                oldPlan: business.subscriptionPlan 
             })
         } as any
      });

      res.status(200).json({ success: true, data: null });
    } catch (error) { next(error); }
  };

  changeStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { active } = req.body;
      const plan = await prisma.plan.update({
        where: { id: req.params.id },
        data: { active },
        include: { prices: true }
      });
      res.status(200).json({ success: true, data: plan });
    } catch (error) { next(error); }
  };

  // --- PlanPrice Operations ---

  createPrice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { planId } = req.params;
      const { billingCycle, price, active } = req.body;

      // Check for existing price with the same cycle
      const existingPrice = await prisma.planPrice.findFirst({
        where: { planId, billingCycle }
      });

      if (existingPrice) {
        if (existingPrice.active) {
          // Already active — reject with a clear message
          res.status(409).json({
            success: false,
            message: `Este plan ya tiene configurado el ciclo ${billingCycle} con estado activo. Edite el precio existente o desactívelo primero.`
          });
          return;
        } else {
          // Inactive — reactivate with the new price
          const reactivated = await prisma.planPrice.update({
            where: { id: existingPrice.id },
            data: { price: Number(price), active: true }
          });

          // Audit Log (non-blocking)
          try {
            const adminBizId = req.user!.businessId;
            if (adminBizId) {
              await prisma.activityLog.create({
                data: {
                  userId: req.user!.id,
                  businessId: adminBizId,
                  actionType: 'PLAN_PRICE_REACTIVATED',
                  entityName: 'PLAN_PRICE',
                  entityId: reactivated.id,
                  newValues: JSON.stringify(reactivated),
                  ipAddress: req.ip,
                  userAgent: req.headers['user-agent']
                } as any
              });
            }
          } catch (logErr) {
            console.error('Failed to log PLAN_PRICE_REACTIVATED:', logErr);
          }

          res.status(200).json({ success: true, data: reactivated });
          return;
        }
      }

      const newPrice = await prisma.planPrice.create({
        data: {
          planId,
          billingCycle,
          price: Number(price),
          active: active !== undefined ? active : true
        }
      });

      // Audit Log (non-blocking)
      try {
        const adminBizId = req.user!.businessId;
        if (adminBizId) {
          await prisma.activityLog.create({
            data: {
              userId: req.user!.id,
              businessId: adminBizId,
              actionType: 'PLAN_PRICE_CREATED',
              entityName: 'PLAN_PRICE',
              entityId: newPrice.id,
              newValues: JSON.stringify(newPrice),
              ipAddress: req.ip,
              userAgent: req.headers['user-agent']
            } as any
          });
        }
      } catch (logErr) {
        console.error('Failed to log PLAN_PRICE_CREATED:', logErr);
      }

      res.status(201).json({ success: true, data: newPrice });
    } catch (error) { next(error); }
  };

  updatePrice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { priceId } = req.params;
      const { price, active, billingCycle } = req.body;

      const oldPrice = await prisma.planPrice.findUnique({ where: { id: priceId } });
      if (!oldPrice) {
        return res.status(404).json({ success: false, error: 'Precio no encontrado' });
      }

      const updatedPrice = await prisma.planPrice.update({
        where: { id: priceId },
        data: {
          price: price !== undefined ? Number(price) : undefined,
          active: active !== undefined ? active : undefined,
          billingCycle: billingCycle !== undefined ? billingCycle : undefined
        }
      });

      // Audit Log (non-blocking)
      try {
        const adminBizId = req.user!.businessId;
        if (adminBizId) {
          await prisma.activityLog.create({
            data: {
              userId: req.user!.id,
              businessId: adminBizId,
              actionType: 'PLAN_PRICE_UPDATED',
              entityName: 'PLAN_PRICE',
              entityId: priceId,
              newValues: JSON.stringify({ old: oldPrice, new: updatedPrice }),
              ipAddress: req.ip,
              userAgent: req.headers['user-agent']
            } as any
          });
        }
      } catch (logErr) {
        console.error('Failed to log PLAN_PRICE_UPDATED:', logErr);
      }

      res.status(200).json({ success: true, data: updatedPrice });
    } catch (error) { next(error); }
  };

  changePriceStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { priceId } = req.params;
      const { active } = req.body;

      const oldPrice = await prisma.planPrice.findUnique({ where: { id: priceId } });
      if (!oldPrice) {
        return res.status(404).json({ success: false, error: 'Precio no encontrado' });
      }

      const updatedPrice = await prisma.planPrice.update({
        where: { id: priceId },
        data: { active }
      });

      // Audit Log (non-blocking)
      try {
        const adminBizId = req.user!.businessId;
        if (adminBizId) {
          await prisma.activityLog.create({
            data: {
              userId: req.user!.id,
              businessId: adminBizId,
              actionType: active ? 'PLAN_PRICE_ACTIVATED' : 'PLAN_PRICE_DEACTIVATED',
              entityName: 'PLAN_PRICE',
              entityId: priceId,
              newValues: JSON.stringify({ active }),
              ipAddress: req.ip,
              userAgent: req.headers['user-agent']
            } as any
          });
        }
      } catch (logErr) {
        console.error('Failed to log PLAN_PRICE_STATUS_CHANGE:', logErr);
      }

      res.status(200).json({ success: true, data: updatedPrice });
    } catch (error) { next(error); }
  };

  deletePrice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { priceId } = req.params;

      const oldPrice = await prisma.planPrice.findUnique({ where: { id: priceId } });
      if (!oldPrice) {
        return res.status(404).json({ success: false, error: 'Precio no encontrado' });
      }

      await prisma.planPrice.delete({
        where: { id: priceId }
      });

      // Audit Log (non-blocking)
      try {
        const adminBizId = req.user!.businessId;
        if (adminBizId) {
          await prisma.activityLog.create({
            data: {
              userId: req.user!.id,
              businessId: adminBizId,
              actionType: 'PLAN_PRICE_DELETED',
              entityName: 'PLAN_PRICE',
              entityId: priceId,
              newValues: JSON.stringify(oldPrice),
              ipAddress: req.ip,
              userAgent: req.headers['user-agent']
            } as any
          });
        }
      } catch (logErr) {
        console.error('Failed to log PLAN_PRICE_DELETED:', logErr);
      }

      res.status(200).json({ success: true, data: null });
    } catch (error) { next(error); }
  };
}
