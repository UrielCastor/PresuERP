import api from './api';

export interface Customer {
  id: string;
  businessId: string;
  type: 'PERSON' | 'COMPANY';
  name: string;
  document?: string | null;
  taxId?: string | null;
  taxCondition?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  notes?: string | null;
  allowCreditAccount?: boolean;
  creditLimit?: number;
  currentDebt?: number;
  defaultPriceListId?: string | null;
  autoApplyPriceList?: boolean;
  defaultPriceList?: {
    id: string;
    name: string;
  } | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sales: number;
  };
  metrics?: {
    totalSalesCount: number;
    totalSpent: number;
  };
  sales?: any[];
}

export interface CustomerAccountMovement {
  id: string;
  businessId: string;
  customerId: string;
  type: 'SALE' | 'PAYMENT' | 'ADJUSTMENT';
  amount: number;
  remainingAmount?: number;
  isSettled?: boolean;
  settledAt?: string | null;
  description?: string | null;
  referenceId?: string | null;
  createdAt: string;
}

export interface CustomerFilterParams {
  search?: string;
  type?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

export const getCustomers = async (params: CustomerFilterParams = {}) => {
  const response = await api.get('/customers', { params });
  return response.data;
};

export const getCustomerById = async (id: string) => {
  const response = await api.get(`/customers/${id}`);
  return response.data;
};

export const createCustomer = async (data: Partial<Customer>) => {
  const response = await api.post('/customers', data);
  return response.data;
};

export const updateCustomer = async (id: string, data: Partial<Customer>) => {
  const response = await api.put(`/customers/${id}`, data);
  return response.data;
};

export const deleteCustomer = async (id: string) => {
  const response = await api.delete(`/customers/${id}`);
  return response.data;
};

export const getCustomerAccountMovements = async (customerId: string) => {
  const response = await api.get(`/customers/${customerId}/account-movements`);
  return response.data;
};

export const registerCustomerAccountPayment = async (
  customerId: string,
  data: { amount: number; paymentMethod?: string; description?: string }
) => {
  const response = await api.post(`/customers/${customerId}/payments`, data);
  return response.data;
};
