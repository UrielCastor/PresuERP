import { api } from './api';

export interface ProductPriceTier {
  id: string;
  businessId: string;
  productId: string;
  minQuantity: number;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    sku?: string;
    salePrice: number;
  };
}

export const productPriceTierService = {
  getAll: async (productId?: string): Promise<ProductPriceTier[]> => {
    const res = await api.get('/product-price-tiers', {
      params: productId ? { productId } : {},
    });
    return res.data.data;
  },

  getById: async (id: string): Promise<ProductPriceTier> => {
    const res = await api.get(`/product-price-tiers/${id}`);
    return res.data.data;
  },

  create: async (data: {
    productId: string;
    minQuantity: number;
    price: number;
    isActive?: boolean;
  }): Promise<ProductPriceTier> => {
    const res = await api.post('/product-price-tiers', data);
    return res.data.data;
  },

  update: async (
    id: string,
    data: {
      minQuantity?: number;
      price?: number;
      isActive?: boolean;
    }
  ): Promise<ProductPriceTier> => {
    const res = await api.put(`/product-price-tiers/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/product-price-tiers/${id}`);
  },
};
