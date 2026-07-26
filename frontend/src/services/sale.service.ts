import { api } from './api';

export interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
    barcode?: string | null;
  };
}

export interface SalePayment {
  id: string;
  paymentMethodId: string;
  amount: number;
  transactionReference?: string | null;
  details?: string | null;
  paymentMethod?: {
    id: string;
    name: string;
    type: string;
  };
}

export interface Sale {
  id: string;
  businessId: string;
  customerId?: string | null;
  cashSessionId?: string | null;
  documentTypeId: string;
  documentNumber: number;
  status: 'COMPLETED' | 'DRAFT' | 'CANCELLED' | 'REFUNDED';
  subtotal: number;
  discountType?: 'FIXED' | 'PERCENTAGE';
  discountValue?: number;
  discountAmount: number;
  surchargeType?: 'NONE' | 'FIXED' | 'PERCENTAGE';
  surchargeValue?: number;
  surchargeAmount?: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  
  customer?: { id: string; name: string; taxId?: string | null; } | null;
  documentType?: { id: string; name: string; code: string; };
  createdBy?: { id: string; name: string; email: string; };
  items: SaleItem[];
  payments: SalePayment[];
}

export const saleApi = {
  list: async (params?: {
    search?: string;
    status?: string;
    customerId?: string;
    warehouseId?: string;
    cashSessionId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await api.get('/sales', { params });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await api.get(`/sales/${id}`);
    return res.data.data;
  },

  create: async (data: any) => {
    const res = await api.post('/sales', data);
    return res.data.data;
  },

  cancel: async (id: string) => {
    const res = await api.post(`/sales/${id}/cancel`);
    return res.data;
  },
};
