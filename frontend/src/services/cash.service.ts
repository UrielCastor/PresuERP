import api from './api';

export const cashApi = {
  getRegisters: async (params?: any) => {
    const { data } = await api.get('/cash/registers', { params });
    return data.data;
  },

  getActiveSession: async (params?: any) => {
    const { data } = await api.get('/cash/active', { params });
    return data.data;
  },

  getHistory: async (params?: any) => {
    const { data } = await api.get('/cash/history', { params });
    return data.data;
  },

  getHistoryById: async (id: string) => {
    const { data } = await api.get(`/cash/history/${id}`);
    return data.data;
  },

  openSession: async (payload: { warehouseId: string; cashRegisterId: string; openingBalance: number; notes?: string }) => {
    const { data } = await api.post('/cash/open', payload);
    return data.data;
  },

  closeSession: async (payload: { countedBalance: number; notes?: string; warehouseId?: string }) => {
    const { data } = await api.post('/cash/close', payload);
    return data.data;
  },

  registerMovement: async (payload: { type: 'INCOME' | 'EXPENSE'; amount: number; concept: string; notes?: string; warehouseId?: string }) => {
    const { data } = await api.post('/cash/movement', payload);
    return data.data;
  }
};
