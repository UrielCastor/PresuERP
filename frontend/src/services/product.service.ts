import { api } from './api';

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  categoryId: string;
  supplierId?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  description?: string | null;
  purchasePrice?: number | null;
  salePrice?: number | null;
  profitMargin?: number | null;
  totalStock?: number;
  category: { id: string; name: string };
  supplier?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const productApi = {
  list: async (supplierId?: string) => {
    const response = await api.get<{ success: boolean; data: Product[] }>('/products', {
      params: supplierId ? { supplierId } : undefined
    });
    return response.data.data;
  },
  findById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Product }>(`/products/${id}`);
    return response.data.data;
  },
  create: async (data: {
    name: string;
    sku?: string | null;
    barcode?: string | null;
    categoryId: string;
    supplierId?: string | null;
    status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
    description?: string | null;
    purchasePrice: number;
    salePrice?: number | null;
    profitMargin?: number | null;
  }) => {
    const response = await api.post<{ success: boolean; data: Product }>('/products', data);
    return response.data.data;
  },
  update: async (
    id: string,
    data: {
      name?: string;
      sku?: string | null;
      barcode?: string | null;
      categoryId?: string;
      supplierId?: string | null;
      status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
      description?: string | null;
      purchasePrice?: number | null;
      salePrice?: number | null;
      profitMargin?: number | null;
      changeReason: string;
    }
  ) => {
    const response = await api.put<{ success: boolean; data: Product }>(`/products/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; data: { id: string } }>(`/products/${id}`);
    return response.data.data;
  },
};
