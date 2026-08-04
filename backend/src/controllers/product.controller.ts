import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/product.service';

const productService = new ProductService();

export class ProductController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const supplierId = req.query.supplierId ? String(req.query.supplierId) : undefined;
      const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined;
      const items = await productService.list(req.user!.businessId, supplierId, warehouseId);
      return res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await productService.findById(req.params.id, req.user!.businessId);
      return res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const item = await productService.create(req.body, req.user!, ip, userAgent);
      return res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const item = await productService.update(req.params.id, req.body, req.user!, ip, userAgent);
      return res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const result = await productService.delete(req.params.id, req.user!, ip, userAgent);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}
