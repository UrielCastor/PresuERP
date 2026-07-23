import { api } from './api';

export interface Supplier {
  id: string;
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  contactName?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const supplierApi = {
  list: async () => {
    const response = await api.get<{ success: boolean; data: Supplier[] }>('/suppliers');
    return response.data.data;
  },
  findById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Supplier }>(`/suppliers/${id}`);
    return response.data.data;
  },
  create: async (data: {
    name: string;
    taxId?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    contactName?: string | null;
    isActive?: boolean;
  }) => {
    const response = await api.post<{ success: boolean; data: Supplier }>('/suppliers', data);
    return response.data.data;
  },
  update: async (
    id: string,
    data: {
      name?: string;
      taxId?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      contactName?: string | null;
      isActive?: boolean;
    }
  ) => {
    const response = await api.put<{ success: boolean; data: Supplier }>(`/suppliers/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; data: { id: string } }>(`/suppliers/${id}`);
    return response.data.data;
  },
};
