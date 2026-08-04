import api from './api';

export interface PriceListItem {
  id: string;
  priceListId: string;
  productId: string;
  price: number;
  minQuantity: number;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
    barcode?: string | null;
    salePrice: number;
    purchasePrice: number;
  };
}

export interface PriceList {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  businessId: string;
  _count?: {
    items: number;
  };
  items?: PriceListItem[];
}

export const priceListService = {
  getAll: async (): Promise<PriceList[]> => {
    const response = await api.get<{ status: string; data: PriceList[] }>('/price-lists');
    return response.data.data;
  },

  getById: async (id: string): Promise<PriceList> => {
    const response = await api.get<{ status: string; data: PriceList }>(`/price-lists/${id}`);
    return response.data.data;
  },

  create: async (data: { name: string; description?: string; isActive?: boolean; isDefault?: boolean }): Promise<PriceList> => {
    const response = await api.post<{ status: string; data: PriceList }>('/price-lists', data);
    return response.data.data;
  },

  update: async (id: string, data: { name?: string; description?: string; isActive?: boolean; isDefault?: boolean }): Promise<PriceList> => {
    const response = await api.put<{ status: string; data: PriceList }>(`/price-lists/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/price-lists/${id}`);
  },

  addItem: async (priceListId: string, data: { productId: string; price: number; minQuantity?: number }): Promise<PriceListItem> => {
    const response = await api.post<{ status: string; data: PriceListItem }>(`/price-lists/${priceListId}/items`, data);
    return response.data.data;
  },

  updateItem: async (priceListId: string, itemId: string, data: { price?: number; minQuantity?: number }): Promise<PriceListItem> => {
    const response = await api.put<{ status: string; data: PriceListItem }>(`/price-lists/${priceListId}/items/${itemId}`, data);
    return response.data.data;
  },

  deleteItem: async (priceListId: string, itemId: string): Promise<void> => {
    await api.delete(`/price-lists/${priceListId}/items/${itemId}`);
  },
};
