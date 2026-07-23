import { Request, Response, NextFunction } from 'express';
import { WarehouseService } from '../services/warehouse.service';

const warehouseService = new WarehouseService();

export class WarehouseController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await warehouseService.list(req.user!.businessId);
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
      const item = await warehouseService.findById(req.params.id, req.user!.businessId);
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
      const item = await warehouseService.create(req.body, req.user!, ip, userAgent);
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
      const item = await warehouseService.update(req.params.id, req.body, req.user!, ip, userAgent);
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
      const { changeReason } = req.body;
      const result = await warehouseService.delete(req.params.id, changeReason, req.user!, ip, userAgent);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}
