import api from './api';

export interface StockMovement {
  id: string;
  businessId: string;
  warehouseId: string;
  productId: string;
  userId: string;
  movementType: 'ENTRY' | 'EXIT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT' | 'INVENTORY' | string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  unitCost: number;
  totalCost: number;
  referenceType?: string | null;
  referenceId?: string | null;
  referenceNumber?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
    barcode?: string | null;
  };
  warehouse?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface StockMovementFilters {
  productId?: string;
  warehouseId?: string;
  userId?: string;
  movementType?: string;
  referenceType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const stockMovementApi = {
  list: async (filters: StockMovementFilters = {}) => {
    const res = await api.get('/kardex', { params: filters });
    return res.data;
  },

  getByProduct: async (productId: string, params: { page?: number; limit?: number } = {}) => {
    const res = await api.get(`/kardex/product/${productId}`, { params });
    return res.data;
  },

  getByWarehouse: async (warehouseId: string, params: { page?: number; limit?: number } = {}) => {
    const res = await api.get(`/kardex/warehouse/${warehouseId}`, { params });
    return res.data;
  },

  getOne: async (id: string) => {
    const res = await api.get(`/kardex/${id}`);
    return res.data.data;
  },

  create: async (data: {
    warehouseId: string;
    productId: string;
    movementType: string;
    quantity: number;
    unitCost?: number;
    referenceType?: string;
    referenceNumber?: string;
    reason?: string;
    notes?: string;
  }) => {
    const res = await api.post('/kardex', data);
    return res.data.data;
  },
};
