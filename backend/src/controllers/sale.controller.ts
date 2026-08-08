import { Request, Response, NextFunction } from 'express';
import { SaleService } from '../services/sale.service';
import { WarehouseService } from '../services/warehouse.service';

const saleService = new SaleService();
const warehouseService = new WarehouseService();

export class SaleController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const {
        customerId,
        cashSessionId,
        documentTypeId,
        warehouseId,
        status,
        search,
        startDate,
        endDate,
        page,
        limit,
      } = req.query;

      // Obtener depósitos autorizados para el usuario
      const allowedWarehouses = await warehouseService.list(businessId, req.user!.id);
      const allowedIds = allowedWarehouses.map((w: any) => w.id);

      let effectiveWarehouseId: any = warehouseId ? String(warehouseId) : undefined;

      // Restricción por rol/staff
      if (!req.user!.isStaff && req.user!.role !== 'Administrator') {
        if (effectiveWarehouseId) {
          if (!allowedIds.includes(effectiveWarehouseId)) {
            effectiveWarehouseId = { in: [] };
          }
        } else {
          effectiveWarehouseId = { in: allowedIds };
        }
      }

      const filters: any = {
        customerId: customerId ? String(customerId) : undefined,
        cashSessionId: cashSessionId ? String(cashSessionId) : undefined,
        documentTypeId: documentTypeId ? String(documentTypeId) : undefined,
        warehouseId: effectiveWarehouseId,
        status: status ? String(status) : undefined,
        search: search ? String(search) : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      };

      if (startDate) {
        const dateStr = String(startDate).split('T')[0];
        filters.startDate = new Date(`${dateStr}T00:00:00.000`);
      }
      if (endDate) {
        const dateStr = String(endDate).split('T')[0];
        filters.endDate = new Date(`${dateStr}T23:59:59.999`);
      }

      const result = await saleService.list(businessId, filters);
      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const item = await saleService.findOne(req.params.id, businessId);
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
      const item = await saleService.create(businessId, userId, req.body);
      return res.status(201).json({
        success: true,
        data: item,
        message: 'Venta registrada exitosamente',
      });
    } catch (error) {
      return next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const item = await saleService.cancel(req.params.id, businessId, userId);
      return res.status(200).json({
        success: true,
        data: item,
        message: 'Venta anulada exitosamente con reversión de stock',
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getSuspended(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const warehouseId = req.query.warehouseId ? String(req.query.warehouseId) : undefined;
      console.log('[POS_SUSPENDED_CONTROLLER]', { businessId, warehouseId, query: req.query });
      const items = await saleService.getSuspendedSales(businessId, warehouseId);
      console.log('[POS_SUSPENDED_CONTROLLER_RESULT]', { count: items.length });
      return res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async recoverSuspended(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const item = await saleService.recoverSuspendedSale(req.params.id, businessId);
      return res.status(200).json({
        success: true,
        data: item,
        message: 'Venta suspendida cargada nuevamente en POS',
      });
    } catch (error) {
      return next(error);
    }
  }

  static async deleteSuspended(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      await saleService.deleteSuspendedSale(req.params.id, businessId, userId);
      return res.status(200).json({
        success: true,
        message: 'Venta suspendida eliminada correctamente',
      });
    } catch (error) {
      return next(error);
    }
  }

  static async processRefund(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const refund = await saleService.processRefund(req.params.id, businessId, userId, req.body);
      return res.status(200).json({
        success: true,
        data: refund,
        message: 'Devolución procesada exitosamente con reingreso de stock y ajuste financiero',
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getSaleReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const items = await saleService.getReturnsBySaleId(req.params.id, businessId);
      return res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getAllReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const filters = {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
        customerId: req.query.customerId ? String(req.query.customerId) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        userId: req.query.userId ? String(req.query.userId) : undefined,
      };
      const items = await saleService.getAllReturns(businessId, filters);
      return res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getReturnById(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const item = await saleService.getReturnById(req.params.id, businessId);
      return res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      return next(error);
    }
  }
}
