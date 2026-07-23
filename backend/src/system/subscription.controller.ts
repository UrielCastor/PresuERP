import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from './subscription.service';

export class SubscriptionController {
  private service = new SubscriptionService();

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        businessStatus: req.query.businessStatus as string,
        subscriptionStatus: req.query.subscriptionStatus as string,
        search: req.query.search as string,
      };
      const subs = await this.service.getAll(filters);
      res.status(200).json({ success: true, data: subs });
    } catch (error) { next(error); }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await this.service.getById(req.params.id);
      res.status(200).json({ success: true, data: sub });
    } catch (error) { next(error); }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await this.service.create(
         req.body, 
         req.user?.id, 
         req.ip, 
         req.headers['user-agent']
      );
      res.status(201).json({ success: true, data: sub });
    } catch (error) { next(error); }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await this.service.update(
         req.params.id, 
         req.body,
         req.user?.id, 
         req.ip, 
         req.headers['user-agent']
      );
      res.status(200).json({ success: true, data: sub });
    } catch (error) { next(error); }
  };

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await this.service.cancel(
         req.params.id, 
         req.user?.id, 
         req.ip, 
         req.headers['user-agent']
      );
      res.status(200).json({ success: true, data: sub });
    } catch (error) { next(error); }
  };

  renew = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await this.service.renew(
         req.params.id, 
         req.user?.id, 
         req.ip, 
         req.headers['user-agent']
      );
      res.status(200).json({ success: true, data: sub });
    } catch (error) { next(error); }
  };

  changePlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { planId } = req.body;
      const sub = await this.service.changePlan(
         req.params.id, 
         planId,
         req.user?.id, 
         req.ip, 
         req.headers['user-agent']
      );
      res.status(200).json({ success: true, data: sub });
    } catch (error) { next(error); }
  };
}
