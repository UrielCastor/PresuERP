import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service';

const dashboardService = new DashboardService();

export class DashboardController {
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await dashboardService.getDashboardData(req.user!.businessId);
      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      return next(error);
    }
  }
}
