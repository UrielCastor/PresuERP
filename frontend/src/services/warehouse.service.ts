import { api } from './api';

export interface Warehouse {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  address?: string | null;
  managerName?: string | null;
  phone?: string | null;
  email?: string | null;
  isMain: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export const warehouseApi = {
  list: async () => {
    const response = await api.get<{ success: boolean; data: Warehouse[] }>('/warehouses');
    return response.data.data;
  },
  findById: async (id: string) => {
    const response = await api.get<{ success: boolean; data: Warehouse }>(`/warehouses/${id}`);
    return response.data.data;
  },
  create: async (data: {
    name: string;
    code?: string | null;
    description?: string | null;
    address?: string | null;
    managerName?: string | null;
    phone?: string | null;
    email?: string | null;
    isMain?: boolean;
    status?: 'ACTIVE' | 'INACTIVE';
  }) => {
    const response = await api.post<{ success: boolean; data: Warehouse }>('/warehouses', data);
    return response.data.data;
  },
  update: async (
    id: string,
    data: {
      name?: string;
      code?: string | null;
      description?: string | null;
      address?: string | null;
      managerName?: string | null;
      phone?: string | null;
      email?: string | null;
      isMain?: boolean;
      status?: 'ACTIVE' | 'INACTIVE';
      changeReason: string;
    }
  ) => {
    const response = await api.put<{ success: boolean; data: Warehouse }>(`/warehouses/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string, changeReason: string) => {
    const response = await api.delete<{
      success: boolean;
      data: { id: string; status: string; matches: boolean; message: string };
    }>(`/warehouses/${id}`, { data: { changeReason } });
    return response.data.data;
  },
};
