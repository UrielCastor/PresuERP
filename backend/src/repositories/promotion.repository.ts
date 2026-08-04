import { prisma } from '../config/db';

export class PromotionRepository {
  async findAll(businessId: string, productId?: string) {
    const where: any = { businessId };
    if (productId) {
      where.productId = productId;
    }
    return prisma.promotion.findMany({
      where,
      include: {
        product: {
          select: { id: true, name: true, sku: true, salePrice: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, businessId: string) {
    return prisma.promotion.findFirst({
      where: { id, businessId },
      include: {
        product: {
          select: { id: true, name: true, sku: true, salePrice: true },
        },
      },
    });
  }

  async create(data: {
    businessId: string;
    name: string;
    type: 'TWO_FOR_ONE' | 'SECOND_UNIT_DISCOUNT' | 'SPECIAL_PACK';
    productId: string;
    minQuantity: number;
    discountPercentage?: number | null;
    specialPrice?: number | null;
    isActive?: boolean;
  }) {
    return prisma.promotion.create({
      data: {
        businessId: data.businessId,
        name: data.name,
        type: data.type,
        productId: data.productId,
        minQuantity: data.minQuantity,
        discountPercentage: data.discountPercentage,
        specialPrice: data.specialPrice,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, salePrice: true },
        },
      },
    });
  }

  async update(
    id: string,
    businessId: string,
    data: {
      name?: string;
      type?: 'TWO_FOR_ONE' | 'SECOND_UNIT_DISCOUNT' | 'SPECIAL_PACK';
      minQuantity?: number;
      discountPercentage?: number | null;
      specialPrice?: number | null;
      isActive?: boolean;
    }
  ) {
    return prisma.promotion.updateMany({
      where: { id, businessId },
      data,
    });
  }

  async delete(id: string, businessId: string) {
    return prisma.promotion.deleteMany({
      where: { id, businessId },
    });
  }
}

export const promotionRepository = new PromotionRepository();
