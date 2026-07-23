import { prisma } from '../config/db';

export class BusinessIntegrationRepository {
  async findByBusinessAndProvider(businessId: string, provider: string) {
    return (prisma as any).businessIntegration.findUnique({
      where: {
        businessId_provider: {
          businessId,
          provider
        }
      }
    });
  }

  async findAllByBusiness(businessId: string) {
    return (prisma as any).businessIntegration.findMany({
      where: { businessId }
    });
  }

  async upsert(businessId: string, provider: string, type: string, credentials: any, status: string = 'ACTIVE', webhookSecret?: string) {
    const updateData: any = {
      type,
      credentials,
      status
    };
    if (webhookSecret !== undefined) {
      updateData.webhookSecret = webhookSecret;
    }

    const createData: any = {
      businessId,
      provider,
      type,
      credentials,
      status,
      ...(webhookSecret ? { webhookSecret } : {})
    };

    return (prisma as any).businessIntegration.upsert({
      where: {
        businessId_provider: {
          businessId,
          provider
        }
      },
      update: updateData,
      create: createData
    });
  }

  async updateTestStatus(id: string, testStatus: 'SUCCESS' | 'FAILED', version: string = '2.0.x') {
    return (prisma as any).businessIntegration.update({
      where: { id },
      data: {
        lastTestStatus: testStatus,
        lastTestAt: new Date()
      }
    });
  }
}
