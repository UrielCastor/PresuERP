import { Request, Response, NextFunction } from 'express';
import { promotionService } from '../services/promotion.service';

export class PromotionController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const productId = req.query.productId as string | undefined;
      const promos = await promotionService.getAll(businessId, productId);
      return res.json({ status: 'success', data: promos });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      const promo = await promotionService.getById(id, businessId);
      return res.json({ status: 'success', data: promo });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const promo = await promotionService.create(businessId, req.body);
      return res.status(201).json({ status: 'success', data: promo });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      const promo = await promotionService.update(id, businessId, req.body);
      return res.json({ status: 'success', data: promo });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      const result = await promotionService.delete(id, businessId);
      return res.json({ status: 'success', message: result.message });
    } catch (err) {
      next(err);
    }
  }
}

export const promotionController = new PromotionController();
