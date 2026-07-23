import { prisma } from '../config/db';

export class CategoryRepository {
  async list(businessId: string) {
    return prisma.category.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, businessId: string) {
    return prisma.category.findFirst({
      where: { id, businessId },
    });
  }

  async findByName(name: string, businessId: string) {
    return prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, businessId },
    });
  }

  async create(data: { name: string; description?: string | null; status?: string; businessId: string }) {
    return prisma.category.create({ data });
  }

  async update(id: string, businessId: string, data: { name?: string; description?: string | null; status?: string }) {
    return prisma.category.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, businessId: string) {
    return prisma.category.delete({
      where: { id },
    });
  }
}
