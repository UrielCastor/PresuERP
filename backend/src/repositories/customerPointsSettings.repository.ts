import { prisma } from '../config/db';
import { CustomerPointsSettings } from '@prisma/client';

export class CustomerPointsSettingsRepository {
  async findByBusinessId(businessId: string, tx?: any): Promise<CustomerPointsSettings | null> {
    const client = tx || prisma;
    return client.customerPointsSettings.findUnique({
      where: { businessId },
    });
  }

  async upsert(
    businessId: string,
    data: Partial<Omit<CustomerPointsSettings, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>>,
    tx?: any
  ): Promise<CustomerPointsSettings> {
    const client = tx || prisma;
    return client.customerPointsSettings.upsert({
      where: { businessId },
      update: data,
      create: {
        ...data,
        businessId,
      } as any,
    });
  }
}
