import { prisma } from '../config/db';

export class BrandRepository {
  async list(businessId: string) {
    return prisma.brand.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, businessId: string) {
    return prisma.brand.findFirst({
      where: { id, businessId },
    });
  }

  async findByName(name: string, businessId: string) {
    return prisma.brand.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, businessId },
    });
  }

  async create(data: { name: string; description?: string | null; businessId: string }) {
    return prisma.brand.create({ data });
  }

  async update(id: string, businessId: string, data: { name?: string; description?: string | null }) {
    return prisma.brand.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, businessId: string) {
    return prisma.brand.delete({
      where: { id },
    });
  }
}
