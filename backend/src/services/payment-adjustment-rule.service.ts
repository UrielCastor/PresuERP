import { PaymentAdjustmentRuleRepository } from '../repositories/payment-adjustment-rule.repository';
import { AppError } from '../utils/appError';

export class PaymentAdjustmentRuleService {
  private repository: PaymentAdjustmentRuleRepository;

  constructor() {
    this.repository = new PaymentAdjustmentRuleRepository();
  }

  async listRules(businessId: string) {
    return this.repository.listByBusiness(businessId);
  }

  async getRuleById(id: string, businessId: string) {
    const rule = await this.repository.findById(id, businessId);
    if (!rule) {
      throw new AppError('Regla de ajuste no encontrada.', 404);
    }
    return rule;
  }

  async upsertRule(businessId: string, data: {
    paymentMethod: string;
    adjustmentType: string;
    valueType: string;
    value: number;
    active?: boolean;
  }) {
    if (data.value < 0) {
      throw new AppError('El valor del ajuste no puede ser negativo.', 400);
    }
    return this.repository.upsert(businessId, {
      paymentMethod: data.paymentMethod,
      adjustmentType: data.adjustmentType,
      valueType: data.valueType,
      value: data.value,
      active: data.active ?? true
    });
  }

  async updateRule(id: string, businessId: string, data: {
    adjustmentType?: string;
    valueType?: string;
    value?: number;
    active?: boolean;
  }) {
    if (data.value !== undefined && data.value < 0) {
      throw new AppError('El valor del ajuste no puede ser negativo.', 400);
    }

    const existing = await this.repository.findById(id, businessId);
    if (!existing) {
      throw new AppError('Regla de ajuste no encontrada.', 404);
    }

    return this.repository.update(id, businessId, data);
  }

  async deleteRule(id: string, businessId: string) {
    const existing = await this.repository.findById(id, businessId);
    if (!existing) {
      throw new AppError('Regla de ajuste no encontrada.', 404);
    }
    return this.repository.delete(id, businessId);
  }
}
