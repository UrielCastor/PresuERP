import { prisma } from '../config/db';
import { User, Role } from '@prisma/client';

export class UserRepository {
  async findById(id: string, businessId: string): Promise<any> {
    return prisma.user.findFirst({
      where: { id, businessId },
      include: {
        role: true,
        defaultWarehouse: true,
        userWarehouses: {
          include: {
            warehouse: true,
          },
        },
      },
    });
  }

  async findByEmail(email: string): Promise<any> {
    return prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        defaultWarehouse: true,
        userWarehouses: {
          include: {
            warehouse: true,
          },
        },
      },
    });
  }

  async create(data: any): Promise<User> {
    return prisma.user.create({
      data,
    });
  }

  async update(id: string, businessId: string, data: any): Promise<User> {
    return prisma.user.update({
      where: { id, businessId },
      data,
    });
  }

  async list(businessId: string, page: number = 1, limit: number = 10): Promise<{ items: any[]; total: number }> {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: { businessId, deletedAt: null },
        include: {
          role: true,
          defaultWarehouse: true,
          userWarehouses: {
            include: {
              warehouse: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: { businessId, deletedAt: null } }),
    ]);

    return { items, total };
  }

  async delete(id: string, businessId: string): Promise<User> {
    return prisma.user.delete({
      where: { id, businessId },
    });
  }
}
