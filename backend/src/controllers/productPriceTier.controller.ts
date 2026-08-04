import { Request, Response, NextFunction } from 'express';
import { productPriceTierService } from '../services/productPriceTier.service';

export class ProductPriceTierController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const productId = req.query.productId as string | undefined;
      const tiers = await productPriceTierService.getAll(businessId, productId);
      return res.json({ status: 'success', data: tiers });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      const tier = await productPriceTierService.getById(id, businessId);
      return res.json({ status: 'success', data: tier });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const tier = await productPriceTierService.create(businessId, req.body);
      return res.status(201).json({ status: 'success', data: tier });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      const tier = await productPriceTierService.update(id, businessId, req.body);
      return res.json({ status: 'success', data: tier });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      const result = await productPriceTierService.delete(id, businessId);
      return res.json({ status: 'success', message: result.message });
    } catch (err) {
      next(err);
    }
  }
}

export const productPriceTierController = new ProductPriceTierController();
