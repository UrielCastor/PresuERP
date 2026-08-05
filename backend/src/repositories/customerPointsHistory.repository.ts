import { prisma } from '../config/db';
import { Prisma, CustomerPointsHistory } from '@prisma/client';

export interface PointsHistoryFilters {
  customerId?: string;
  type?: string;
  reason?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class CustomerPointsHistoryRepository {
  async create(data: Prisma.CustomerPointsHistoryUncheckedCreateInput, tx?: any): Promise<CustomerPointsHistory> {
    const client = tx || prisma;
    return client.customerPointsHistory.create({
      data,
    });
  }

  async findAll(businessId: string, filters: PointsHistoryFilters) {
    const {
      customerId,
      type,
      reason,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.CustomerPointsHistoryWhereInput = {
      businessId,
      ...(customerId && { customerId }),
      ...(type && { type }),
      ...(reason && { reason }),
      ...((startDate || endDate) && {
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      }),
    };

    const [total, items] = await prisma.$transaction([
      prisma.customerPointsHistory.count({ where }),
      prisma.customerPointsHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          customer: { select: { id: true, name: true } },
          sale: { select: { id: true, documentNumber: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  async findBySaleId(saleId: string, tx?: any): Promise<CustomerPointsHistory[]> {
    const client = tx || prisma;
    return client.customerPointsHistory.findMany({
      where: { saleId },
    });
  }
}
