import { prisma } from '../config/db';

export class SupplierRepository {
  async list(businessId: string) {
    return prisma.supplier.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, businessId: string) {
    return prisma.supplier.findFirst({
      where: { id, businessId },
    });
  }

  async findByName(name: string, businessId: string) {
    return prisma.supplier.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        businessId,
      },
    });
  }

  async findByTaxId(taxId: string, businessId: string) {
    return prisma.supplier.findFirst({
      where: { taxId, businessId },
    });
  }

  async create(data: {
    name: string;
    taxId?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    contactName?: string | null;
    isActive?: boolean;
    businessId: string;
  }) {
    return prisma.supplier.create({
      data,
    });
  }

  async update(
    id: string,
    businessId: string,
    data: {
      name?: string;
      taxId?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      contactName?: string | null;
      isActive?: boolean;
    }
  ) {
    return prisma.supplier.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, businessId: string) {
    return prisma.supplier.delete({
      where: { id },
    });
  }
}
