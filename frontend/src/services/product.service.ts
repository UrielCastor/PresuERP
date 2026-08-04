import { api } from './api';

export interface Product {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  categoryId: string;
  supplierId?: string | null;
  supplierIds?: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  description?: string | null;
  purchasePrice?: number | null;
  salePrice?: number | null;
  profitMargin?: number | null;
  unitOfMeasure?: 'UNIT' | 'KG' | 'GRAM' | 'LITER' | 'METER';
  allowSaleWithoutStock?: boolean;
  totalStock?: number;
  category: { id: string; name: string };
  supplier?: { id: string; name: string } | null;
  suppliers?: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export const productApi = {
  list: async (params?: { supplierId?: string; warehouseId?: string } | string) => {
    const queryParams = typeof params === 'string' ? { supplierId: params } : params;
    const response = await api.get<{ success: boolean; data: Product[] }>('/products', {
      params: queryParams
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
    supplierIds?: string[];
    status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
    description?: string | null;
    purchasePrice: number;
    salePrice?: number | null;
    profitMargin?: number | null;
    unitOfMeasure?: 'UNIT' | 'KG' | 'G' | 'L' | 'GRAM' | 'LITER' | 'METER';
    allowSaleWithoutStock?: boolean;
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
      supplierIds?: string[];
      status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
      description?: string | null;
      purchasePrice?: number | null;
      salePrice?: number | null;
      profitMargin?: number | null;
      unitOfMeasure?: 'UNIT' | 'KG' | 'G' | 'L' | 'GRAM' | 'LITER' | 'METER';
      allowSaleWithoutStock?: boolean;
      changeReason?: string;
    }
  ) => {
    const response = await api.put<{ success: boolean; data: Product }>(`/products/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; data: any }>(`/products/${id}`);
    return response.data.data;
  },
};
