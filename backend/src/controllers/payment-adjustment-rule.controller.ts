import { Request, Response, NextFunction } from 'express';
import { PaymentAdjustmentRuleService } from '../services/payment-adjustment-rule.service';
import { createPaymentAdjustmentRuleSchema, updatePaymentAdjustmentRuleSchema } from '../validators/payment-adjustment-rule.validator';

export class PaymentAdjustmentRuleController {
  private service: PaymentAdjustmentRuleService;

  constructor() {
    this.service = new PaymentAdjustmentRuleService();
  }

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.businessId;
      const rules = await this.service.listRules(businessId);
      res.status(200).json({ success: true, data: rules });
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      const rule = await this.service.getRuleById(id, businessId);
      res.status(200).json({ success: true, data: rule });
    } catch (e) {
      next(e);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.businessId;
      const validated = createPaymentAdjustmentRuleSchema.parse(req.body);
      const rule = await this.service.upsertRule(businessId, validated);
      res.status(201).json({ success: true, data: rule });
    } catch (e) {
      next(e);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      const validated = updatePaymentAdjustmentRuleSchema.parse(req.body);
      const rule = await this.service.updateRule(id, businessId, validated);
      res.status(200).json({ success: true, data: rule });
    } catch (e) {
      next(e);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      await this.service.deleteRule(id, businessId);
      res.status(200).json({ success: true, message: 'Regla eliminada exitosamente' });
    } catch (e) {
      next(e);
    }
  };
}
