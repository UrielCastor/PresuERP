import { Request, Response, NextFunction } from 'express';
import { PurchaseService } from '../services/purchase.service';

const purchaseService = new PurchaseService();

export class PurchaseController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const {
        supplierId,
        warehouseId,
        status,
        paymentStatus,
        startDate,
        endDate,
        search,
        page,
        limit,
        orderByCreatedAtDesc,
      } = req.query;

      const filters: any = {
        supplierId: supplierId ? String(supplierId) : undefined,
        warehouseId: warehouseId ? String(warehouseId) : undefined,
        status: status ? String(status) : undefined,
        paymentStatus: paymentStatus ? String(paymentStatus) : undefined,
        search: search ? String(search) : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        orderByCreatedAtDesc: String(orderByCreatedAtDesc) === 'true' ? true : undefined,
      };

      if (startDate) {
        filters.startDate = new Date(String(startDate));
      }
      if (endDate) {
        filters.endDate = new Date(String(endDate));
      }

      const result = await purchaseService.list(businessId, filters);
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
      const item = await purchaseService.findOne(req.params.id, businessId);
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
      const item = await purchaseService.create(businessId, userId, req.body);
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
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const item = await purchaseService.update(req.params.id, businessId, userId, req.body);
      return res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async submitForApproval(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const item = await purchaseService.submitForApproval(req.params.id, businessId, userId);
      return res.status(200).json({
        success: true,
        data: item,
        message: 'Compra enviada a aprobación con éxito.',
      });
    } catch (error) {
      return next(error);
    }
  }

  static async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const item = await purchaseService.reject(req.params.id, businessId, userId);
      return res.status(200).json({
        success: true,
        data: item,
        message: 'Compra devuelta a borrador con éxito.',
      });
    } catch (error) {
      return next(error);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const item = await purchaseService.approve(req.params.id, businessId, userId);
      return res.status(200).json({
        success: true,
        data: item,
        message: 'Compra aprobada con éxito, pendiente de recibir mercadería.',
      });
    } catch (error) {
      return next(error);
    }
  }

  static async receive(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const item = await purchaseService.receive(req.params.id, businessId, userId);
      return res.status(200).json({
        success: true,
        data: item,
        message: 'Mercadería recibida con éxito, stock y costo actualizados.',
      });
    } catch (error) {
      return next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const item = await purchaseService.cancel(req.params.id, businessId, userId);
      return res.status(200).json({
        success: true,
        data: item,
        message: 'Compra cancelada con éxito.',
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getProductPurchaseHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { productId } = req.params;
      const stats = await purchaseService.getProductPurchaseHistory(productId, businessId);
      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      return next(error);
    }
  }
}
