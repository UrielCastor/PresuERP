import { Request, Response, NextFunction } from 'express';
import { StockService } from '../services/stock.service';
import { prisma } from '../config/db';

const stockService = new StockService();

export class StockController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      let warehouseIdStr = req.query.warehouseId ? String(req.query.warehouseId) : null;
      let items: any[] = [];
      const businessId = req.user!.businessId;

      if (warehouseIdStr === 'ALL') {
        items = await stockService.findAll(businessId);
      } else {
        if (!warehouseIdStr) {
          const mainWarehouse = await prisma.warehouse.findFirst({
             where: { businessId, isMain: true, status: 'ACTIVE' }
          }) || await prisma.warehouse.findFirst({
             where: { businessId, status: 'ACTIVE' }
          });
          
          if (mainWarehouse) {
            warehouseIdStr = mainWarehouse.id;
          }
        }

        if (warehouseIdStr) {
          items = await stockService.findByWarehouse(warehouseIdStr, businessId);
        }
      }
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
      const item = await stockService.findOne(req.params.id, req.user!.businessId);
      return res.status(200).json({
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
      const { quantity, changeReason, minimumStock, maximumStock, reservedQuantity } = req.body;
      
      let item;
      // If quantity is provided, we perform a manual stock adjustment
      if (quantity !== undefined) {
        item = await stockService.adjustStockQuantity(
          req.params.id,
          req.user!.businessId,
          Number(quantity),
          changeReason,
          req.user as any,
          ip,
          userAgent
        );
      } 
      
      // Always update stock levels if parameters exist
      if (minimumStock !== undefined || maximumStock !== undefined || reservedQuantity !== undefined) {
        item = await stockService.updateStockLevels(
          req.params.id,
          req.user!.businessId,
          { minimumStock, maximumStock, reservedQuantity },
          req.user as any,
          ip,
          userAgent
        );
      }

      return res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listByWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await stockService.findByWarehouse(req.params.id, req.user!.businessId);
      return res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listByProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await stockService.findByProduct(req.params.id, req.user!.businessId);
      return res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      return next(error);
    }
  }
}
