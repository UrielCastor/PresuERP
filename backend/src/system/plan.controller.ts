import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

export class PlanController {
  
  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plans = await prisma.plan.findMany({
        include: { prices: true },
        orderBy: { code: 'asc' }
      });
      res.status(200).json({ success: true, data: plans });
    } catch (error) { next(error); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, code, maxUsers, maxProducts, features, active, isDefault } = req.body;
      const plan = await prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.plan.updateMany({
            where: { isDefault: true },
            data: { isDefault: false }
          });
        }
        return tx.plan.create({
          data: { name, code, maxUsers, maxProducts, features, active, isDefault: !!isDefault },
          include: { prices: true }
        });
      });
      res.status(201).json({ success: true, data: plan });
    } catch (error) { next(error); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, code, maxUsers, maxProducts, features, active, isDefault } = req.body;
      const plan = await prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.plan.updateMany({
            where: { isDefault: true },
            data: { isDefault: false }
          });
        }
        return tx.plan.update({
          where: { id: req.params.id },
          data: { name, code, maxUsers, maxProducts, features, active, isDefault: isDefault !== undefined ? !!isDefault : undefined },
          include: { prices: true }
        });
      });
      res.status(200).json({ success: true, data: plan });
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
