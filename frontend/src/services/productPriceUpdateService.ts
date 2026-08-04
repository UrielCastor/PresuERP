import { api } from './api';

export interface PriceUpdateFilter {
  filterType: 'SUPPLIER' | 'CATEGORY' | 'BRAND' | 'SELECTED' | 'ALL';
  filterValue?: string;
  productIds?: string[];
}

export interface PriceUpdatePayload extends PriceUpdateFilter {
  type: 'INCREASE_PERCENT' | 'DECREASE_PERCENT' | 'INCREASE_FIXED' | 'REPLACE' | 'MULTIPLY';
  percentage?: number;
  fixedAmount?: number;
  multiplyFactor?: number;
  affectedPurchasePrice: boolean;
  affectedSalePrice: boolean;
  roundingOption?: 'NONE' | 'ROUND_10' | 'ROUND_100' | 'ROUND_500' | 'ROUND_1000';
  priceListStrategy?: 'KEEP_SPECIAL' | 'RECALCULATE' | 'NO_MODIFY_LISTS';
}

export interface PreviewItem {
  id: string;
  name: string;
  sku: string;
  oldPurchasePrice: number;
  newPurchasePrice: number;
  oldSalePrice: number;
  newSalePrice: number;
  differencePercentage: number;
}

export interface PreviewResult {
  productsAffected: number;
  items: PreviewItem[];
}

export interface PriceUpdateHistoryRecord {
  id: string;
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
  productsAffected: number;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CustomPriceUpdateItem {
  productId: string;
  newPurchasePrice?: number;
  newSalePrice?: number;
}

export const productPriceUpdateService = {
  preview: async (payload: PriceUpdatePayload): Promise<PreviewResult> => {
    const res = await api.post('/product-price-updates/preview', payload);
    return res.data.data;
  },

  apply: async (payload: PriceUpdatePayload): Promise<{ productsAffected: number; historyRecord: PriceUpdateHistoryRecord }> => {
    const res = await api.post('/product-price-updates/apply', payload);
    return res.data.data;
  },

  applyCustom: async (data: {
    supplierId?: string;
    priceListStrategy?: 'KEEP_SPECIAL' | 'RECALCULATE' | 'NO_MODIFY_LISTS';
    items: CustomPriceUpdateItem[];
  }): Promise<{ productsAffected: number }> => {
    const res = await api.post('/product-price-updates/bulk-custom', data);
    return res.data.data;
  },

  getHistory: async (): Promise<PriceUpdateHistoryRecord[]> => {
    const res = await api.get('/product-price-updates/history');
    return res.data.data;
  },
};
