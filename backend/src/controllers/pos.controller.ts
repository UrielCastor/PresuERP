import { Request, Response, NextFunction } from 'express';
import { PosService } from '../services/pos.service';

const posService = new PosService();

export class PosController {
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string | undefined;
      const cashSessionId = req.query.cashSessionId as string | undefined;
      const summary = await posService.getDashboardSummary(req.user!.businessId, req.user!.id, { warehouseId, cashSessionId });
      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      return next(error);
    }
  }
}
