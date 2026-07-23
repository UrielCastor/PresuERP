import { SubscriptionRepository } from './subscription.repository';
import { prisma } from '../config/db';
import { AppError } from '../utils/appError';

export class SubscriptionService {
  private repository = new SubscriptionRepository();

  async getAll(filters?: { businessStatus?: string; subscriptionStatus?: string; search?: string }) {
    return this.repository.findAll(filters);
  }

  async getById(id: string) {
    const sub = await this.repository.findById(id);
    if (!sub) throw new AppError('Subscription not found', 404);
    return sub;
  }

  async getHistoryByBusiness(businessId: string) {
    return this.repository.findByBusinessId(businessId);
  }

  async create(data: any, adminUserId?: string, ipAddress?: string, userAgent?: string) {
    const sub = await this.repository.create({ ...data, status: 'ACTIVE' });
    await this.logActivity(data.businessId, adminUserId, 'SUBSCRIPTION_CREATED', sub, ipAddress, userAgent);
    return sub;
  }

  async update(id: string, data: any, adminUserId?: string, ipAddress?: string, userAgent?: string) {
    const oldSub = await this.getById(id);
    const sub = await this.repository.update(id, data);
    await this.logActivity(oldSub.businessId, adminUserId, 'SUBSCRIPTION_UPDATED', { oldStatus: oldSub.status, newStatus: sub.status }, ipAddress, userAgent);
    return sub;
  }

  async cancel(id: string, adminUserId?: string, ipAddress?: string, userAgent?: string) {
    const oldSub = await this.getById(id);
    const sub = await this.repository.update(id, { status: 'CANCELLED', endDate: new Date() });
    await this.logActivity(oldSub.businessId, adminUserId, 'SUBSCRIPTION_CANCELLED', { id }, ipAddress, userAgent);
    return sub;
  }

  async renew(id: string, adminUserId?: string, ipAddress?: string, userAgent?: string) {
    const oldSub = await this.getById(id);
    
    // Add 1 month or 1 year based on billing cycle
    let newRenewal = oldSub.renewalDate ? new Date(oldSub.renewalDate) : new Date();
    if (oldSub.billingCycle === 'YEARLY') {
       newRenewal.setFullYear(newRenewal.getFullYear() + 1);
    } else {
       newRenewal.setMonth(newRenewal.getMonth() + 1);
    }

    const sub = await this.repository.update(id, { renewalDate: newRenewal });
    await this.logActivity(oldSub.businessId, adminUserId, 'SUBSCRIPTION_RENEWED', { newRenewal }, ipAddress, userAgent);
    return sub;
  }

  async changePlan(id: string, newPlanId: string, adminUserId?: string, ipAddress?: string, userAgent?: string) {
    const oldSub = await this.getById(id);
    
    // 1. Close current subscription
    await this.repository.update(id, { status: 'EXPIRED', endDate: new Date() });
    
    const plan = await (prisma as any).plan.findUnique({ where: { id: newPlanId } });
    if (!plan) throw new AppError('Plan not found', 404);

    // 2. Create new subscription
    let nextRenewal = new Date();
    nextRenewal.setMonth(nextRenewal.getMonth() + 1);

    const newSub = await this.repository.create({
       businessId: oldSub.businessId,
       planId: newPlanId,
       status: 'ACTIVE',
       billingCycle: oldSub.billingCycle || 'MONTHLY',
       startDate: new Date(),
       renewalDate: nextRenewal,
       paymentProvider: oldSub.paymentProvider,
    });

    // 3. Keep business object in sync
    await prisma.business.update({
       where: { id: oldSub.businessId },
       data: { 
          subscriptionPlan: plan.name,
          subscriptionEndsAt: nextRenewal
       }
    });

    await this.logActivity(oldSub.businessId, adminUserId, 'PLAN_CHANGED', { oldPlan: oldSub.planId, newPlan: newPlanId }, ipAddress, userAgent);
    return newSub;
  }

  private async logActivity(businessId: string, userId: string = '0', actionType: string, values: any, ipAddress?: string, userAgent?: string) {
    if (userId === '0') return; // Edge case if no admin exists contextually
    await prisma.activityLog.create({
      data: {
         userId,
         businessId,
         actionType,
         entityName: 'SUBSCRIPTION',
         entityId: businessId, // or sub id Ideally
         newValues: JSON.stringify(values),
         ipAddress,
         userAgent
      } as any
    });
  }
}
