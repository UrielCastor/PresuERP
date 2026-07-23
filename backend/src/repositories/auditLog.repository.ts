import { prisma } from '../config/db';
import { AuditLog } from '@prisma/client';

export class AuditLogRepository {
  async log(data: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    return prisma.auditLog.create({
      data,
    });
  }

  async list(
    businessId: string,
    filters: { userId?: string; module?: string; page?: number; limit?: number } = {}
  ): Promise<{ items: AuditLog[]; total: number }> {
    const { userId, module, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { businessId };
    if (userId) where.userId = userId;
    if (module) where.module = module;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
