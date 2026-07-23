import { api } from './api';

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export const categoryApi = {
  list: async () => {
    const response = await api.get<{ success: boolean; data: Category[] }>('/categories');
    return response.data.data;
  },
  create: async (data: { name: string; description?: string | null }) => {
    const response = await api.post<{ success: boolean; data: Category }>('/categories', data);
    return response.data.data;
  },
  update: async (id: string, data: { name?: string; description?: string | null; status?: string; changeReason: string }) => {
    const response = await api.put<{ success: boolean; data: Category }>(`/categories/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string, changeReason?: string) => {
    const response = await api.delete<{ success: boolean; data: { id: string } }>(`/categories/${id}`, {
      data: { changeReason: changeReason || 'Eliminación solicitada por usuario' },
    });
    return response.data.data;
  },
};
