import { prisma } from '../config/db';

export class ProductPriceTierRepository {
  async findAll(businessId: string, productId?: string) {
    return prisma.productPriceTier.findMany({
      where: {
        businessId,
        ...(productId ? { productId } : {}),
      },
      include: {
        product: { select: { id: true, name: true, sku: true, salePrice: true } },
      },
      orderBy: { minQuantity: 'asc' },
    });
  }

  async findById(id: string, businessId: string) {
    return prisma.productPriceTier.findFirst({
      where: { id, businessId },
      include: {
        product: { select: { id: true, name: true, sku: true, salePrice: true } },
      },
    });
  }

  async findDuplicate(businessId: string, productId: string, minQuantity: number, excludeId?: string) {
    return prisma.productPriceTier.findFirst({
      where: {
        businessId,
        productId,
        minQuantity: minQuantity,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async create(data: {
    businessId: string;
    productId: string;
    minQuantity: number;
    price: number;
    isActive?: boolean;
  }) {
    return prisma.productPriceTier.create({
      data: {
        businessId: data.businessId,
        productId: data.productId,
        minQuantity: data.minQuantity,
        price: data.price,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: {
        product: { select: { id: true, name: true, sku: true, salePrice: true } },
      },
    });
  }

  async update(
    id: string,
    businessId: string,
    data: {
      minQuantity?: number;
      price?: number;
      isActive?: boolean;
    }
  ) {
    return prisma.productPriceTier.updateMany({
      where: { id, businessId },
      data,
    });
  }

  async delete(id: string, businessId: string) {
    return prisma.productPriceTier.deleteMany({
      where: { id, businessId },
    });
  }
}

export const productPriceTierRepository = new ProductPriceTierRepository();
