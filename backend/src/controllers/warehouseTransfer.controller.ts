import { Request, Response, NextFunction } from 'express';
import { WarehouseTransferService } from '../services/warehouseTransfer.service';

const transferService = new WarehouseTransferService();

export class WarehouseTransferController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const items = await transferService.list(businessId);
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
      const businessId = req.user!.businessId;
      const item = await transferService.findOne(req.params.id, businessId);
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
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const item = await transferService.create(businessId, userId, req.body);
      return res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const { status } = req.body;
      const item = await transferService.updateStatus(req.params.id, businessId, status, userId);
      return res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      return next(error);
    }
  }
}
