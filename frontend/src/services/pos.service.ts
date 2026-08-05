import api from './api';

export const posApi = {
  getDashboard: async (params?: { warehouseId?: string; cashSessionId?: string }) => {
    const { data } = await api.get('/pos/dashboard', { params });
    return data;
  }
};
