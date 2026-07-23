import { prisma } from '../config/db';
import { User, Role } from '@prisma/client';

export class UserRepository {
  async findById(id: string, businessId: string): Promise<(User & { role: Role | null }) | null> {
    return prisma.user.findFirst({
      where: { id, businessId },
      include: { role: true },
    });
  }

  async findByEmail(email: string): Promise<(User & { role: Role | null }) | null> {
    return prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  async create(data: Omit<User, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>): Promise<User> {
    return prisma.user.create({
      data,
    });
  }

  async update(id: string, businessId: string, data: Partial<Omit<User, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>>): Promise<User> {
    return prisma.user.update({
      where: { id, businessId },
      data,
    });
  }

  async list(businessId: string, page: number = 1, limit: number = 10): Promise<{ items: (User & { role: Role | null })[]; total: number }> {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: { businessId, deletedAt: null },
        include: { role: true },
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
