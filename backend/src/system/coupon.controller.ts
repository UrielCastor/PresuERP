import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

export class CouponController {
  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const coupons = await (prisma as any).saasCoupon.findMany({
        orderBy: { createdAt: 'desc' },
      });
      res.status(200).json({ success: true, data: coupons });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, discountPercent, startDate, endDate, applicablePlans, maxUses, active } = req.body;

      if (!code || !code.trim()) {
        return res.status(400).json({ success: false, message: 'El código del cupón es obligatorio.' });
      }

      const existing = await (prisma as any).saasCoupon.findUnique({
        where: { code: code.trim().toUpperCase() },
      });

      if (existing) {
        return res.status(400).json({ success: false, message: 'Ya existe un cupón con ese código.' });
      }

      const coupon = await (prisma as any).saasCoupon.create({
        data: {
          code: code.trim().toUpperCase(),
          discountPercent: Number(discountPercent) || 0,
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : null,
          applicablePlans: Array.isArray(applicablePlans) ? applicablePlans.join(',') : applicablePlans,
          maxUses: Number(maxUses) || 100,
          active: active !== undefined ? !!active : true,
        },
      });

      res.status(201).json({ success: true, data: coupon });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { discountPercent, endDate, applicablePlans, maxUses, active } = req.body;
      const coupon = await (prisma as any).saasCoupon.update({
        where: { id: req.params.id },
        data: {
          discountPercent: discountPercent !== undefined ? Number(discountPercent) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          applicablePlans: Array.isArray(applicablePlans) ? applicablePlans.join(',') : applicablePlans,
          maxUses: maxUses !== undefined ? Number(maxUses) : undefined,
          active: active !== undefined ? !!active : undefined,
        },
      });

      res.status(200).json({ success: true, data: coupon });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await (prisma as any).saasCoupon.delete({
        where: { id: req.params.id },
      });
      res.status(200).json({ success: true, message: 'Cupón eliminado correctamente.' });
    } catch (error) {
      next(error);
    }
  };
}
