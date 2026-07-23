import { prisma } from '../config/db';

export class PaymentAdjustmentRuleRepository {
  async listByBusiness(businessId: string) {
    return (prisma as any).paymentAdjustmentRule.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findByMethod(businessId: string, paymentMethod: string) {
    return (prisma as any).paymentAdjustmentRule.findFirst({
      where: {
        businessId,
        paymentMethod
      }
    });
  }

  async findById(id: string, businessId: string) {
    return (prisma as any).paymentAdjustmentRule.findFirst({
      where: { id, businessId }
    });
  }

  async upsert(businessId: string, data: {
    paymentMethod: string;
    adjustmentType: string;
    valueType: string;
    value: number;
    active: boolean;
  }) {
    const existing = await this.findByMethod(businessId, data.paymentMethod);
    if (existing) {
      await (prisma as any).paymentAdjustmentRule.update({
        where: { id: existing.id },
        data: {
          adjustmentType: data.adjustmentType,
          valueType: data.valueType,
          value: data.value,
          active: data.active
        }
      });
      return (prisma as any).paymentAdjustmentRule.findUnique({ where: { id: existing.id } });
    }

    return (prisma as any).paymentAdjustmentRule.create({
      data: {
        businessId,
        paymentMethod: data.paymentMethod,
        adjustmentType: data.adjustmentType,
        valueType: data.valueType,
        value: data.value,
        active: data.active
      }
    });
  }

  async update(id: string, businessId: string, data: {
    adjustmentType?: string;
    valueType?: string;
    value?: number;
    active?: boolean;
  }) {
    await (prisma as any).paymentAdjustmentRule.updateMany({
      where: { id, businessId },
      data
    });
    return this.findById(id, businessId);
  }

  async delete(id: string, businessId: string) {
    return (prisma as any).paymentAdjustmentRule.deleteMany({
      where: { id, businessId }
    });
  }
}
