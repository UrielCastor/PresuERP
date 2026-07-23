import { api } from './api';

export interface OtherTax {
  name: string;
  percentage?: number;
  amount: number;
  description?: string | null;
  type?: 'PERCENTAGE' | 'FIXED';
  value?: number;
}

export interface PurchaseItem {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  discount: number;
  tax: number;
  subtotal: number;
  total: number;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
    barcode?: string | null;
    purchasePrice?: number;
    salePrice?: number;
  };
}

export interface Purchase {
  id: string;
  businessId: string;
  supplierId: string;
  warehouseId: string;
  userId: string;
  purchaseNumber: string;
  documentType: 'FACTURA' | 'BOLETA' | 'GUIA_REMISION' | 'NOTA_CREDITO' | string;
  documentNumber?: string | null;
  status: 'DRAFT' | 'APPROVED' | 'CANCELLED' | string;
  paymentStatus: 'PENDING' | 'PAID' | 'PARTIAL' | string;
  purchaseDate: string;
  expectedDate?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string | null;
  // Manual tax control fields
  hasInvoiceTaxes: boolean;
  vatRate: number;
  vatAmount: number;
  otherTaxes?: string | null; // JSON string: [{name, amount, type, value}]
  invoicedTotal?: number | null;
  createdAt: string;
  updatedAt: string;
  supplier?: {
    id: string;
    name: string;
    taxId?: string | null;
    email?: string | null;
    phone?: string | null;
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
  items: PurchaseItem[];
  activityLogs?: any[];
}

export interface PurchaseFilters {
  supplierId?: string;
  warehouseId?: string;
  status?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  orderByCreatedAtDesc?: boolean;
}

export const purchaseApi = {
  list: async (filters: PurchaseFilters = {}) => {
    const res = await api.get('/purchases', { params: filters });
    return res.data;
  },

  getOne: async (id: string) => {
    const res = await api.get(`/purchases/${id}`);
    return res.data.data;
  },

  create: async (data: {
    supplierId: string;
    warehouseId: string;
    documentType?: string;
    documentNumber?: string | null;
    expectedDate?: string | null;
    notes?: string | null;
    hasInvoiceTaxes?: boolean;
    vatRate?: number;
    vatAmount?: number;
    otherTaxes?: OtherTax[];
    discount?: number;
    invoicedTotal?: number | null;
    forceDifference?: boolean;
    items: {
      productId: string;
      quantity: number;
      unitCost: number;
      discount?: number;
    }[];
  }) => {
    const res = await api.post('/purchases', data);
    return res.data.data;
  },

  update: async (
    id: string,
    data: {
      supplierId?: string;
      warehouseId?: string;
      documentType?: string;
      documentNumber?: string | null;
      expectedDate?: string | null;
      notes?: string | null;
      hasInvoiceTaxes?: boolean;
      vatRate?: number;
      vatAmount?: number;
      otherTaxes?: OtherTax[];
      discount?: number;
      invoicedTotal?: number | null;
      forceDifference?: boolean;
      items?: {
        productId: string;
        quantity: number;
        unitCost: number;
        discount?: number;
      }[];
    }
  ) => {
    const res = await api.put(`/purchases/${id}`, data);
    return res.data.data;
  },

  submitForApproval: async (id: string) => {
    const res = await api.post(`/purchases/${id}/submit-for-approval`);
    return res.data;
  },

  reject: async (id: string) => {
    const res = await api.post(`/purchases/${id}/reject`);
    return res.data;
  },

  approve: async (id: string) => {
    const res = await api.post(`/purchases/${id}/approve`);
    return res.data;
  },

  receive: async (id: string) => {
    const res = await api.post(`/purchases/${id}/receive`);
    return res.data;
  },

  cancel: async (id: string) => {
    const res = await api.post(`/purchases/${id}/cancel`);
    return res.data;
  },

  getProductPurchaseHistory: async (productId: string) => {
    const res = await api.get(`/purchases/product/${productId}/history`);
    return res.data.data;
  },
};
