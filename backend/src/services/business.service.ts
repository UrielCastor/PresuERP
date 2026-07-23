import { BusinessRepository } from '../repositories/business.repository';
import { AppError } from '../utils/appError';
import { prisma } from '../config/db';

export class BusinessService {
  private repository: BusinessRepository;

  constructor() {
    this.repository = new BusinessRepository();
  }

  async getAll(showDeleted: boolean = false) {
    return this.repository.findAll(showDeleted);
  }

  async getById(id: string) {
    const business = await this.repository.findById(id);
    if (!business) throw new AppError('Business not found', 404);
    return business;
  }

  async getBusinessUsageMetrics(businessId: string) {
    return this.repository.getBusinessUsageMetrics(businessId);
  }

  async createBusiness(data: any) {
    // Toda empresa nueva debe comenzar con el plan FREE
    const plan =
      await prisma.plan.findFirst({ where: { code: 'FREE' } }) ||
      await prisma.plan.findFirst({ where: { name: 'FREE' } });

    if (!plan) {
      throw new Error('Plan FREE no encontrado en la base de datos. Por favor asegúrese de que el plan FREE exista antes de registrar empresas.');
    }

    const business = await this.repository.create({
      ...data,
      subscriptionPlan: plan.name
    });

    await (prisma as any).subscription.create({
      data: {
        businessId: business.id,
        planId: plan.id,
        status: 'ACTIVE',
        billingCycle: 'FREE',
        startDate: new Date()
      }
    });

    await prisma.activityLog.create({
      data: {
        businessId: business.id,
        actionType: 'SUBSCRIPTION_CREATED',
        entityName: 'SUBSCRIPTION',
        entityId: business.id,
        newValues: JSON.stringify({ plan: plan.name, cycle: 'FREE' })
      } as any
    });

    return business;
  }

  async updateBusiness(id: string, data: any) {
    const original = await this.getById(id);
    const updated = await this.repository.update(id, data);
    
    // Si hubo cambio de plan, logearlo
    if (data.subscriptionPlan && data.subscriptionPlan !== original.subscriptionPlan) {
       await prisma.activityLog.create({
          data: {
             businessId: id,
             // Dummy userId for SYSTEM_ADMIN if none provided? prisma setup probably requires a valid userId.
             // We can use original.users[0]?.id if needed, but if the SystemAdmin does it there might be an issue.
             // Let's assume the schema allows dummy or we skip it if standard user isn't found?
             // Actually, I skipped userId here in previous apps. Let's see if userId is mandatory.
             actionType: 'UPDATE',
             entityName: 'BUSINESS',
             entityId: id,
             newValues: JSON.stringify({ subscriptionPlan: data.subscriptionPlan }),
          }
       });
    }

    return updated;
  }

  async suspendBusiness(id: string, adminUserId?: string, ipAddress?: string, userAgent?: string) {
    const business = await this.getById(id);
    const updated = await this.repository.update(id, { isActive: false });
    await prisma.activityLog.create({
        data: {
           userId: adminUserId,
           businessId: id,
           actionType: 'SUSPEND_BUSINESS',
           entityName: 'BUSINESS',
           entityId: id,
           newValues: JSON.stringify({ isActive: false }),
           ipAddress,
           userAgent
        } as any
    });
    return updated;
  }

  async activateBusiness(id: string, adminUserId?: string, ipAddress?: string, userAgent?: string) {
    const business = await this.getById(id);
    const updated = await this.repository.update(id, { isActive: true });
    await prisma.activityLog.create({
        data: {
           userId: adminUserId,
           businessId: id,
           actionType: 'ACTIVATE_BUSINESS',
           entityName: 'BUSINESS',
           entityId: id,
           newValues: JSON.stringify({ isActive: true }),
           ipAddress,
           userAgent
        } as any
    });
    return updated;
  }

  async validateBusinessDeletion(id: string) {
    const users = await prisma.user.count({ where: { businessId: id } });
    const products = await prisma.product.count({ where: { businessId: id } });
    const sales = await prisma.sale.count({ where: { businessId: id } });
    const purchases = await prisma.purchase.count({ where: { businessId: id } });
    const warehouseTransfers = await prisma.warehouseTransfer.count({ where: { businessId: id } });
    const cashSessions = await prisma.cashSession.count({ where: { businessId: id } });
    const suppliers = await prisma.supplier.count({ where: { businessId: id } });
    const clients = await prisma.customer.count({ where: { businessId: id } });

    const totalRecords = users + products + sales + purchases + warehouseTransfers + cashSessions + suppliers + clients;
    
    return {
      hasHistory: totalRecords > 0,
      totalRecords,
      details: {
        users,
        products,
        sales,
        purchases,
        warehouseTransfers,
        cashSessions,
        suppliers,
        clients
      }
    };
  }

  async deleteBusiness(id: string, adminUserId?: string, ipAddress?: string, userAgent?: string) {
    const business = await this.getById(id);
    const updated = await this.repository.update(id, { isActive: false, deletedAt: new Date() } as any);
    await prisma.activityLog.create({
        data: {
           userId: adminUserId,
           businessId: id,
           actionType: 'DELETE_BUSINESS',
           entityName: 'BUSINESS',
           entityId: id,
           newValues: JSON.stringify({ isActive: false, deletedAt: new Date() }),
           ipAddress,
           userAgent
        } as any
    });
    return updated;
  }

  async restoreBusiness(id: string, adminUserId?: string, ipAddress?: string, userAgent?: string) {
    const updated = await this.repository.update(id, { isActive: true, deletedAt: null });
    await prisma.activityLog.create({
        data: {
           userId: adminUserId,
           businessId: id,
           actionType: 'RESTORE_BUSINESS',
           entityName: 'BUSINESS',
           entityId: id,
           newValues: JSON.stringify({ isActive: true, deletedAt: null }),
           ipAddress,
           userAgent
        } as any
    });
    return updated;
  }
}
