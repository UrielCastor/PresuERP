import api from './api';

export interface RoleDto {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  businessId: string;
  createdAt: string;
}

export const roleService = {
  getRoles: async (): Promise<RoleDto[]> => {
    const res = await api.get('/roles');
    return res.data.data;
  },

  getRoleById: async (id: string): Promise<RoleDto> => {
    const res = await api.get(`/roles/${id}`);
    return res.data.data;
  },

  createRole: async (data: { name: string; description?: string }): Promise<RoleDto> => {
    const res = await api.post('/roles', data);
    return res.data.data;
  },

  updateRole: async (id: string, data: { name?: string; description?: string }): Promise<RoleDto> => {
    const res = await api.put(`/roles/${id}`, data);
    return res.data.data;
  },

  deleteRole: async (id: string): Promise<void> => {
    await api.delete(`/roles/${id}`);
  },
};
