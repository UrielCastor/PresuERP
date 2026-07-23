import { Request, Response, NextFunction } from 'express';
import { CashService } from '../services/cash.service';

const cashService = new CashService();

export class CashController {
  static async open(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await cashService.openSession({
        businessId: req.user!.businessId,
        userId: req.user!.id,
        cashRegisterId: req.body.cashRegisterId,
        openingBalance: Number(req.body.openingBalance),
        notes: req.body.notes,
      });
      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  static async close(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await cashService.closeSession({
        businessId: req.user!.businessId,
        userId: req.user!.id,
        countedBalance: Number(req.body.countedBalance),
        notes: req.body.notes,
      });
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  static async movement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await cashService.registerManualMovement({
        businessId: req.user!.businessId,
        userId: req.user!.id,
        type: req.body.type,
        amount: Number(req.body.amount),
        concept: req.body.concept,
        notes: req.body.notes,
      });
      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  static async getActive(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await cashService.getActiveSession(req.user!.businessId, req.user!.id);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  static async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await cashService.getHistory(req.user!.businessId);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await cashService.getSessionHistoryDetail(req.params.id, req.user!.businessId);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  static async getRegisters(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await cashService.getRegisters(req.user!.businessId);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }
}
