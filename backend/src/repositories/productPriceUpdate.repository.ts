import { prisma } from '../config/db';

export class ProductPriceUpdateRepository {
  async findTargetProducts(
    businessId: string,
    filterType: 'SUPPLIER' | 'CATEGORY' | 'BRAND' | 'SELECTED' | 'ALL',
    filterValue?: string,
    productIds?: string[]
  ) {
    const where: any = { businessId, status: 'ACTIVE' };

    if (filterType === 'SUPPLIER' && filterValue) {
      where.supplierId = filterValue;
    } else if (filterType === 'CATEGORY' && filterValue) {
      where.categoryId = filterValue;
    } else if (filterType === 'BRAND' && filterValue) {
      where.brandId = filterValue;
    } else if (filterType === 'SELECTED' && Array.isArray(productIds) && productIds.length > 0) {
      where.id = { in: productIds };
    }

    return prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        purchasePrice: true,
        salePrice: true,
        supplierId: true,
        categoryId: true,
        brandId: true,
        priceListItems: {
          select: {
            id: true,
            priceListId: true,
            price: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async executePriceUpdateTransaction(data: {
    businessId: string;
    userId: string;
    type: string;
    filterType: string;
    filterValue?: string;
    percentage?: number;
    fixedAmount?: number;
    multiplyFactor?: number;
    affectedPurchasePrice: boolean;
    affectedSalePrice: boolean;
    productUpdates: {
      productId: string;
      newPurchasePrice?: number;
      newSalePrice?: number;
      priceListUpdates?: { priceListItemId: string; newPrice: number }[];
    }[];
  }) {
    return prisma.$transaction(async (tx) => {
      let totalProductsUpdated = 0;

      for (const update of data.productUpdates) {
        const productData: any = {};
        if (data.affectedPurchasePrice && update.newPurchasePrice !== undefined) {
          productData.purchasePrice = update.newPurchasePrice;
        }
        if (data.affectedSalePrice && update.newSalePrice !== undefined) {
          productData.salePrice = update.newSalePrice;
        }

        if (Object.keys(productData).length > 0) {
          await tx.product.update({
            where: { id: update.productId },
            data: productData,
          });
          totalProductsUpdated++;
        }

        if (update.priceListUpdates && update.priceListUpdates.length > 0) {
          for (const plUpd of update.priceListUpdates) {
            await tx.priceListItem.update({
              where: { id: plUpd.priceListItemId },
              data: { price: plUpd.newPrice },
            });
          }
        }
      }

      const historyRecord = await tx.productPriceUpdateHistory.create({
        data: {
          businessId: data.businessId,
          userId: data.userId,
          type: data.type,
          filterType: data.filterType,
          filterValue: data.filterValue || null,
          percentage: data.percentage !== undefined ? data.percentage : null,
          fixedAmount: data.fixedAmount !== undefined ? data.fixedAmount : null,
          multiplyFactor: data.multiplyFactor !== undefined ? data.multiplyFactor : null,
          affectedPurchasePrice: data.affectedPurchasePrice,
          affectedSalePrice: data.affectedSalePrice,
          productsAffected: totalProductsUpdated,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return {
        productsAffected: totalProductsUpdated,
        historyRecord,
      };
    });
  }

  async getHistory(businessId: string) {
    return prisma.productPriceUpdateHistory.findMany({
      where: { businessId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
