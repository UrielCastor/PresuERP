import { Request, Response, NextFunction } from 'express';
import { PointsService } from '../services/points.service';

const pointsService = new PointsService();

export class PointsController {
  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const settings = await pointsService.getSettings(businessId);
      return res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const context = {
        userId: req.user!.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      };
      const updated = await pointsService.updateSettings(businessId, req.body, context);
      return res.status(200).json({
        success: true,
        data: updated,
        message: 'Configuración de fidelización actualizada exitosamente',
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getCustomerPoints(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { customerId } = req.params;
      const balance = await pointsService.getCustomerBalance(businessId, customerId);
      return res.status(200).json({
        success: true,
        data: balance,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getPointsHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { customerId, type, reason, createdById, warehouseId, startDate, endDate, page, limit } = req.query;

      const filters: any = {
        customerId: customerId ? String(customerId) : undefined,
        type: type ? String(type) : undefined,
        reason: reason ? String(reason) : undefined,
        createdById: createdById ? String(createdById) : undefined,
        warehouseId: warehouseId ? String(warehouseId) : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      };

      if (startDate) {
        filters.startDate = new Date(String(startDate));
      }
      if (endDate) {
        filters.endDate = new Date(String(endDate));
      }

      const result = await pointsService.getPointsHistory(businessId, filters);
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

  static async adjustPoints(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const result = await pointsService.adjustPoints(businessId, req.body, userId);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Ajuste manual de puntos realizado exitosamente',
      });
    } catch (error) {
      return next(error);
    }
  }

  static async previewRedemption(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const preview = await pointsService.previewRedemption(businessId, req.body);
      return res.status(200).json({
        success: true,
        data: preview,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async previewEarn(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { customerId, totalAmount } = req.body;
      const pointsEarned = await pointsService.calculatePointsEarned(
        businessId,
        customerId || null,
        totalAmount
      );
      return res.status(200).json({
        success: true,
        data: {
          pointsEarned,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getLoyaltyDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const dashboard = await pointsService.getLoyaltyDashboard(businessId);
      return res.status(200).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async exportHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { customerId, type, reason, createdById, warehouseId, startDate, endDate } = req.query;

      const filters: any = {
        customerId: customerId ? String(customerId) : undefined,
        type: type ? String(type) : undefined,
        reason: reason ? String(reason) : undefined,
        createdById: createdById ? String(createdById) : undefined,
        warehouseId: warehouseId ? String(warehouseId) : undefined,
      };

      if (startDate) {
        filters.startDate = new Date(String(startDate));
      }
      if (endDate) {
        filters.endDate = new Date(String(endDate));
      }

      const csv = await pointsService.exportPointsToCsv(businessId, filters);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=points_history_${Date.now()}.csv`);
      return res.status(200).send(csv);
    } catch (error) {
      return next(error);
    }
  }
}
