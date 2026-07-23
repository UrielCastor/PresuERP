import { prisma } from '../config/db';

export class ProductRepository {
  async list(businessId: string, supplierId?: string) {
    return prisma.product.findMany({
      where: {
        businessId,
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        stocks: {
          select: { quantity: true, warehouseId: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, businessId: string) {
    return prisma.product.findFirst({
      where: { id, businessId },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        stocks: {
          select: { quantity: true, warehouseId: true },
        },
      },
    });
  }

  async findBySku(sku: string, businessId: string) {
    return prisma.product.findFirst({
      where: { sku, businessId },
    });
  }

  async create(data: {
    name: string;
    sku?: string | null;
    barcode?: string | null;
    categoryId: string;
    supplierId?: string | null;
    status: string;
    description?: string | null;
    purchasePrice?: number | null;
    salePrice?: number | null;
    profitMargin?: number | null;
    businessId: string;
  }) {
    return prisma.product.create({
      data: data as any,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        stocks: {
          select: { quantity: true, warehouseId: true },
        },
      },
    });
  }

  async update(
    id: string,
    businessId: string,
    data: {
      name?: string;
      sku?: string | null;
      barcode?: string | null;
      categoryId?: string;
      supplierId?: string | null;
      status?: string;
      description?: string | null;
      purchasePrice?: number | null;
      salePrice?: number | null;
      profitMargin?: number | null;
    }
  ) {
    return prisma.product.update({
      where: { id },
      data: data as any,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        stocks: {
          select: { quantity: true, warehouseId: true },
        },
      },
    });
  }

  async delete(id: string, businessId: string) {
    return prisma.product.delete({
      where: { id },
    });
  }
}
