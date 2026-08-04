import { ProductPriceUpdateRepository } from '../repositories/productPriceUpdate.repository';

export interface PriceUpdateParams {
  businessId: string;
  userId: string;
  filterType: 'SUPPLIER' | 'CATEGORY' | 'BRAND' | 'SELECTED' | 'ALL';
  filterValue?: string;
  productIds?: string[];
  type: 'INCREASE_PERCENT' | 'DECREASE_PERCENT' | 'INCREASE_FIXED' | 'REPLACE' | 'MULTIPLY';
  percentage?: number;
  fixedAmount?: number;
  multiplyFactor?: number;
  affectedPurchasePrice: boolean;
  affectedSalePrice: boolean;
  roundingOption?: 'NONE' | 'ROUND_10' | 'ROUND_100' | 'ROUND_500' | 'ROUND_1000';
  priceListStrategy?: 'KEEP_SPECIAL' | 'RECALCULATE' | 'NO_MODIFY_LISTS';
}

export class ProductPriceUpdateService {
  private repository = new ProductPriceUpdateRepository();

  private applyRounding(val: number, option?: string): number {
    if (isNaN(val) || val < 0) return 0;
    switch (option) {
      case 'ROUND_10':
        return Math.round(val / 10) * 10;
      case 'ROUND_100':
        return Math.round(val / 100) * 100;
      case 'ROUND_500':
        return Math.round(val / 500) * 500;
      case 'ROUND_1000':
        return Math.round(val / 1000) * 1000;
      case 'NONE':
      default:
        return Math.round(val * 100) / 100;
    }
  }

  private calculateNewValue(
    currentVal: number,
    type: string,
    percentage?: number,
    fixedAmount?: number,
    multiplyFactor?: number,
    roundingOption?: string
  ): number {
    let result = currentVal;
    switch (type) {
      case 'INCREASE_PERCENT':
        result = currentVal * (1 + (percentage || 0) / 100);
        break;
      case 'DECREASE_PERCENT':
        result = currentVal * (1 - (percentage || 0) / 100);
        break;
      case 'INCREASE_FIXED':
        result = currentVal + (fixedAmount || 0);
        break;
      case 'REPLACE':
        result = fixedAmount !== undefined ? fixedAmount : currentVal;
        break;
      case 'MULTIPLY':
        result = currentVal * (multiplyFactor || 1);
        break;
      default:
        break;
    }
    return Math.max(0, this.applyRounding(result, roundingOption));
  }

  async preview(params: PriceUpdateParams) {
    const products = await this.repository.findTargetProducts(
      params.businessId,
      params.filterType,
      params.filterValue,
      params.productIds
    );

    const items = products.map((p) => {
      const oldPurchase = Number(p.purchasePrice || 0);
      const oldSale = Number(p.salePrice || 0);

      const newPurchase = params.affectedPurchasePrice
        ? this.calculateNewValue(
            oldPurchase,
            params.type,
            params.percentage,
            params.fixedAmount,
            params.multiplyFactor,
            params.roundingOption
          )
        : oldPurchase;

      const newSale = params.affectedSalePrice
        ? this.calculateNewValue(
            oldSale,
            params.type,
            params.percentage,
            params.fixedAmount,
            params.multiplyFactor,
            params.roundingOption
          )
        : oldSale;

      let differencePercentage = 0;
      if (params.affectedSalePrice && oldSale > 0) {
        differencePercentage = Math.round(((newSale - oldSale) / oldSale) * 10000) / 100;
      } else if (params.affectedPurchasePrice && oldPurchase > 0) {
        differencePercentage = Math.round(((newPurchase - oldPurchase) / oldPurchase) * 10000) / 100;
      }

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        oldPurchasePrice: oldPurchase,
        newPurchasePrice: newPurchase,
        oldSalePrice: oldSale,
        newSalePrice: newSale,
        differencePercentage,
      };
    });

    return {
      productsAffected: items.length,
      items,
    };
  }

  async apply(params: PriceUpdateParams) {
    const products = await this.repository.findTargetProducts(
      params.businessId,
      params.filterType,
      params.filterValue,
      params.productIds
    );

    const productUpdates = products.map((p) => {
      const oldPurchase = Number(p.purchasePrice || 0);
      const oldSale = Number(p.salePrice || 0);

      const newPurchase = params.affectedPurchasePrice
        ? this.calculateNewValue(
            oldPurchase,
            params.type,
            params.percentage,
            params.fixedAmount,
            params.multiplyFactor,
            params.roundingOption
          )
        : undefined;

      const newSale = params.affectedSalePrice
        ? this.calculateNewValue(
            oldSale,
            params.type,
            params.percentage,
            params.fixedAmount,
            params.multiplyFactor,
            params.roundingOption
          )
        : undefined;

      const priceListUpdates: { priceListItemId: string; newPrice: number }[] = [];

      if (params.priceListStrategy === 'RECALCULATE' && p.priceListItems && p.priceListItems.length > 0) {
        for (const item of p.priceListItems) {
          const currentItemPrice = Number(item.price || 0);
          const newItemPrice = this.calculateNewValue(
            currentItemPrice,
            params.type,
            params.percentage,
            params.fixedAmount,
            params.multiplyFactor,
            params.roundingOption
          );
          priceListUpdates.push({
            priceListItemId: item.id,
            newPrice: newItemPrice,
          });
        }
      }

      return {
        productId: p.id,
        newPurchasePrice: newPurchase,
        newSalePrice: newSale,
        priceListUpdates,
      };
    });

    return this.repository.executePriceUpdateTransaction({
      businessId: params.businessId,
      userId: params.userId,
      type: params.type,
      filterType: params.filterType,
      filterValue: params.filterValue,
      percentage: params.percentage,
      fixedAmount: params.fixedAmount,
      multiplyFactor: params.multiplyFactor,
      affectedPurchasePrice: params.affectedPurchasePrice,
      affectedSalePrice: params.affectedSalePrice,
      productUpdates,
    });
  }

  async getHistory(businessId: string) {
    return this.repository.getHistory(businessId);
  }

  async applyCustom(params: {
    businessId: string;
    userId: string;
    supplierId?: string;
    priceListStrategy?: 'KEEP_SPECIAL' | 'RECALCULATE' | 'NO_MODIFY_LISTS';
    items: {
      productId: string;
      newPurchasePrice?: number;
      newSalePrice?: number;
    }[];
  }) {
    const { businessId, userId, supplierId, priceListStrategy = 'RECALCULATE', items } = params;
    if (!items || items.length === 0) {
      return { productsAffected: 0 };
    }

    const { prisma } = require('../config/db');
    const productIds = items.map((i) => i.productId);
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId },
      select: {
        id: true,
        purchasePrice: true,
        salePrice: true,
        priceListItems: {
          select: {
            id: true,
            price: true,
          },
        },
      },
    });

    const productMap = new Map(existingProducts.map((p: any) => [p.id, p]));
    const productUpdates: {
      productId: string;
      newPurchasePrice?: number;
      newSalePrice?: number;
      priceListUpdates?: { priceListItemId: string; newPrice: number }[];
    }[] = [];

    let affectedPurchase = false;
    let affectedSale = false;

    for (const item of items) {
      const prod: any = productMap.get(item.productId);
      if (!prod) continue;

      const upd: any = { productId: item.productId };

      if (item.newPurchasePrice !== undefined && Number(prod.purchasePrice) !== Number(item.newPurchasePrice)) {
        upd.newPurchasePrice = item.newPurchasePrice;
        affectedPurchase = true;
      }

      if (item.newSalePrice !== undefined && Number(prod.salePrice) !== Number(item.newSalePrice)) {
        upd.newSalePrice = item.newSalePrice;
        affectedSale = true;

        if (priceListStrategy === 'RECALCULATE' && prod.priceListItems.length > 0 && Number(prod.salePrice) > 0) {
          const ratio = item.newSalePrice / Number(prod.salePrice);
          upd.priceListUpdates = prod.priceListItems.map((pli: any) => ({
            priceListItemId: pli.id,
            newPrice: Math.round(Number(pli.price) * ratio * 100) / 100,
          }));
        }
      }

      if (upd.newPurchasePrice !== undefined || upd.newSalePrice !== undefined) {
        productUpdates.push(upd);
      }
    }

    if (productUpdates.length === 0) {
      return { productsAffected: 0 };
    }

    return this.repository.executePriceUpdateTransaction({
      businessId,
      userId,
      type: 'CUSTOM_BULK',
      filterType: supplierId ? 'SUPPLIER' : 'CUSTOM',
      filterValue: supplierId || undefined,
      affectedPurchasePrice: affectedPurchase,
      affectedSalePrice: affectedSale,
      productUpdates,
    });
  }
}
