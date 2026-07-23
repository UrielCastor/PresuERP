import { api } from './api';

export interface Brand {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const brandApi = {
  list: async () => {
    const response = await api.get<{ success: boolean; data: Brand[] }>('/brands');
    return response.data.data;
  },
  create: async (data: { name: string; description?: string | null }) => {
    const response = await api.post<{ success: boolean; data: Brand }>('/brands', data);
    return response.data.data;
  },
  update: async (id: string, data: { name?: string; description?: string | null }) => {
    const response = await api.put<{ success: boolean; data: Brand }>(`/brands/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string) => {
    const response = await api.delete<{ success: boolean; data: { id: string } }>(`/brands/${id}`);
    return response.data.data;
  },
};
