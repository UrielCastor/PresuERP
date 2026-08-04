import { api } from './api';

export interface Promotion {
  id: string;
  name: string;
  type: 'TWO_FOR_ONE' | 'SECOND_UNIT_DISCOUNT' | 'SPECIAL_PACK';
  productId: string;
  minQuantity: number;
  discountPercentage?: number | null;
  specialPrice?: number | null;
  isActive: boolean;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
    salePrice?: number | null;
  };
  createdAt?: string;
  updatedAt?: string;
}

export const promotionService = {
  getAll: async (productId?: string): Promise<Promotion[]> => {
    const response = await api.get<{ status: string; data: Promotion[] }>('/promotions', {
      params: productId ? { productId } : undefined,
    });
    return response.data.data;
  },

  getById: async (id: string): Promise<Promotion> => {
    const response = await api.get<{ status: string; data: Promotion }>(`/promotions/${id}`);
    return response.data.data;
  },

  create: async (data: {
    name: string;
    type: 'TWO_FOR_ONE' | 'SECOND_UNIT_DISCOUNT' | 'SPECIAL_PACK';
    productId: string;
    minQuantity?: number;
    discountPercentage?: number | null;
    specialPrice?: number | null;
    isActive?: boolean;
  }): Promise<Promotion> => {
    const response = await api.post<{ status: string; data: Promotion }>('/promotions', data);
    return response.data.data;
  },

  update: async (
    id: string,
    data: {
      name?: string;
      type?: 'TWO_FOR_ONE' | 'SECOND_UNIT_DISCOUNT' | 'SPECIAL_PACK';
      minQuantity?: number;
      discountPercentage?: number | null;
      specialPrice?: number | null;
      isActive?: boolean;
    }
  ): Promise<Promotion> => {
    const response = await api.put<{ status: string; data: Promotion }>(`/promotions/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete<{ status: string; message: string }>(`/promotions/${id}`);
    return response.data;
  },
};
