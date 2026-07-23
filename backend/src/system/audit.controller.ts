import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service';

export class AuditController {
  private service = new AuditService();

  public getLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const filters = {
         search: req.query.search,
         businessId: req.query.businessId,
         userId: req.query.userId,
         entityName: req.query.entityName,
         actionType: req.query.actionType,
         startDate: req.query.startDate,
         endDate: req.query.endDate
      };

      const auditData = await this.service.getLogs(filters, page, limit);
      res.status(200).json({ success: true, data: auditData });
    } catch (e) {
      next(e);
    }
  };

  public getStats = async (req: Request, res: Response, next: NextFunction) => {
     try {
       const stats = await this.service.getStats();
       res.status(200).json({ success: true, data: stats });
     } catch (e) {
       next(e);
     }
  }
}
