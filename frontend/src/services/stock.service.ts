import { api } from './api';
import { Product } from './product.service';
import { Warehouse } from './warehouse.service';

export interface Stock {
  id: string;
  warehouseId: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  minimumStock: number;
  maximumStock: number;
  updatedAt: string;
  product?: Product;
  warehouse?: Warehouse;
}

export interface StockAdjustmentPayload {
  quantity?: number;
  changeReason?: string;
  minimumStock?: number;
  maximumStock?: number;
  reservedQuantity?: number;
}

export const stockApi = {
  list: async (warehouseId?: string) => {
    const params = warehouseId ? { warehouseId } : {};
    const response = await api.get<{ success: boolean; data: Stock[] }>('/stocks', { params });
    return response.data.data;
  },
  findById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Stock }>(`/stocks/${id}`);
    return response.data.data;
  },
  update: async (id: string, data: StockAdjustmentPayload) => {
    const response = await api.put<{ success: boolean; data: Stock }>(`/stocks/${id}`, data);
    return response.data.data;
  },
  listByWarehouse: async (warehouseId: string) => {
    const response = await api.get<{ success: boolean; data: Stock[] }>(`/warehouses/${warehouseId}/stocks`);
    return response.data.data;
  },
  listByProduct: async (productId: string) => {
    const response = await api.get<{ success: boolean; data: Stock[] }>(`/products/${productId}/stocks`);
    return response.data.data;
  },
};
