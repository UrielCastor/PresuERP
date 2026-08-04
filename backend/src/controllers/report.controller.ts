import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service';
import { AppError } from '../utils/appError';
import { reportQuerySchema } from '../validators/report.validator';
import { prisma } from '../config/db';

export class ReportController {
  private reportService: ReportService;

  constructor() {
    this.reportService = new ReportService();
  }

  getExecutiveSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.businessId) throw new AppError('Business ID is missing from Context', 400);
      const filters = reportQuerySchema.parse(req.query);
      const data = await this.reportService.getExecutiveSummary(req.user.businessId, filters);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getSales = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.businessId) throw new AppError('Business ID is missing from Context', 400);
      const filters = reportQuerySchema.parse(req.query);
      const data = await this.reportService.getSalesReport(req.user.businessId, filters);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getPurchases = async (req: Request, res: Response, next: NextFunction) => {
    try {
       if (!req.user || !req.user.businessId) throw new AppError('Business ID is missing from Context', 400);
       const filters = reportQuerySchema.parse(req.query);
       const data = await this.reportService.getPurchasesReport(req.user.businessId, filters);
       res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getCash = async (req: Request, res: Response, next: NextFunction) => {
    try {
       if (!req.user || !req.user.businessId) throw new AppError('Business ID is missing from Context', 400);
       const filters = reportQuerySchema.parse(req.query);
       const data = await this.reportService.getCashReport(req.user.businessId, filters);
       res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getInventory = async (req: Request, res: Response, next: NextFunction) => {
    try {
       if (!req.user || !req.user.businessId) throw new AppError('Business ID is missing from Context', 400);
       const filters = reportQuerySchema.parse(req.query);
       const data = await this.reportService.getInventoryReport(req.user.businessId, filters);
       res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getKardex = async (req: Request, res: Response, next: NextFunction) => {
    try {
       if (!req.user || !req.user.businessId) throw new AppError('Business ID is missing from Context', 400);
       const filters = reportQuerySchema.parse(req.query);
       const data = await this.reportService.getKardexReport(req.user.businessId, filters);
       res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getFinancial = async (req: Request, res: Response, next: NextFunction) => {
    try {
       if (!req.user || !req.user.businessId) throw new AppError('Business ID is missing from Context', 400);
       const filters = reportQuerySchema.parse(req.query);
       const data = await this.reportService.getFinancialReport(req.user.businessId, filters);
       res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getCustomers = async (req: Request, res: Response, next: NextFunction) => {
    try {
       if (!req.user || !req.user.businessId) throw new AppError('Business ID is missing from Context', 400);
       const filters = reportQuerySchema.parse(req.query);
       const data = await this.reportService.getCustomersReport(req.user.businessId, filters);
       res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
       if (!req.user || !req.user.businessId) throw new AppError('Business ID is missing from Context', 400);
       const filters = reportQuerySchema.parse(req.query);
       const data = await this.reportService.getProductsReport(req.user.businessId, filters);
       res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
       if (!req.user || !req.user.businessId) throw new AppError('Business ID is missing from Context', 400);
       const filters = reportQuerySchema.parse(req.query);
       const data = await this.reportService.getUsersReport(req.user.businessId, filters);
       res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getAudit = async (req: Request, res: Response, next: NextFunction) => {
    try {
       if (!req.user || !req.user.businessId) throw new AppError('Business ID is missing from Context', 400);
       const data = await this.reportService.getAuditReport(req.user.businessId, req.query);
       res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  exportReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
       const { report, type, dateFrom, dateTo } = req.body;
       if (!req.user || !req.user.businessId) throw new AppError('Business ID is missing', 400);

       // Registrar en Activity Log
       await prisma.activityLog.create({
         data: {
           businessId: req.user.businessId,
           userId: req.user.id,
           entityName: 'REPORT',
           entityId: report,
           actionType: 'EXPORT',
           newValues: JSON.stringify({ format: type, dateFrom, dateTo })
         }
       });

       res.setHeader('Content-Type', type === 'CSV' ? 'text/csv' : type === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
       res.setHeader('Content-Disposition', `attachment; filename="export_${report}_${new Date().getTime()}.${type.toLowerCase()}"`);
       res.send(`Exported ${report} as ${type} from ${dateFrom} to ${dateTo}`);
    } catch (error) { next(error); }
  };
}
