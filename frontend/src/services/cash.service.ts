import api from './api';

export const cashApi = {
  getRegisters: async () => {
    const { data } = await api.get('/cash/registers');
    return data.data;
  },

  getActiveSession: async () => {
    const { data } = await api.get('/cash/active');
    console.log('[CAJA] Datos recibidos', data);
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

  openSession: async (payload: { cashRegisterId: string; openingBalance: number; notes?: string }) => {
    const { data } = await api.post('/cash/open', payload);
    return data.data;
  },

  closeSession: async (payload: { countedBalance: number; notes?: string }) => {
    const { data } = await api.post('/cash/close', payload);
    return data.data;
  },

  registerMovement: async (payload: { type: 'INCOME' | 'EXPENSE'; amount: number; concept: string; notes?: string }) => {
    const { data } = await api.post('/cash/movement', payload);
    return data.data;
  }
};
