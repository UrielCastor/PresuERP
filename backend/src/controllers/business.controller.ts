import { Request, Response, NextFunction } from 'express';
import { BusinessService } from '../services/business.service';
import { businessValidator, updateBusinessValidator } from '../validators/business.validator';
import { prisma } from '../config/db';

export class BusinessController {
  private service: BusinessService;

  constructor() {
    this.service = new BusinessService();
  }

  getCurrent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getById(req.user!.businessId);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  updateCurrent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateBusinessValidator.parse(req.body);
      const result = await this.service.updateBusiness(req.user!.businessId, data);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const showDeleted = req.query.showDeleted === 'true';
      const data = await this.service.getAll(showDeleted);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getById(req.params.id);
      await prisma.activityLog.create({
         data: {
            userId: req.user!.id,
            businessId: req.params.id,
            actionType: 'VIEW_BUSINESS',
            entityName: 'BUSINESS',
            entityId: req.params.id,
            newValues: JSON.stringify({ name: data.name }),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
         } as any
      });
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getUsageMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id === 'current' ? req.user!.businessId : req.params.id;
      if (req.user!.businessId !== id && !req.user!.isStaff) {
        throw new Error('Access denied: You can only query your own tenant usage.');
      }
      const data = await this.service.getBusinessUsageMetrics(id);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = businessValidator.parse(req.body);
      const result = await this.service.createBusiness(data);
      res.status(201).json({ success: true, data: result });
    } catch (error) { next(error); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateBusinessValidator.parse(req.body);
      const result = await this.service.updateBusiness(req.params.id, data);
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.deleteBusiness(
         req.params.id, 
         req.user!.id, 
         req.ip, 
         req.headers['user-agent']
      );
      res.status(204).send();
    } catch (error) { next(error); }
  };

  validateDelete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.validateBusinessDeletion(req.params.id);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  suspend = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.suspendBusiness(
         req.params.id, 
         req.user!.id, 
         req.ip, 
         req.headers['user-agent']
      );
      res.status(200).json({ success: true, business: { id: result.id, status: 'SUSPENDED' } });
    } catch (error) { next(error); }
  };

  activate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.activateBusiness(
         req.params.id, 
         req.user!.id, 
         req.ip, 
         req.headers['user-agent']
      );
      res.status(200).json({ success: true, business: { id: result.id, status: 'ACTIVE' } });
    } catch (error) { next(error); }
  };

  restore = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.restoreBusiness(
         req.params.id, 
         req.user!.id, 
         req.ip, 
         req.headers['user-agent']
      );
      res.status(200).json({ success: true, business: { id: result.id, status: 'ACTIVE' } });
    } catch (error) { next(error); }
  };

  getSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: { businessId: req.user!.businessId },
        include: { plan: { include: { prices: true } } },
        orderBy: { createdAt: 'desc' }
      });
      res.status(200).json({ success: true, data: subscription });
    } catch (error) { next(error); }
  };
}
