import api from './api';

export const posApi = {
  getDashboard: async () => {
    const { data } = await api.get('/pos/dashboard');
    return data;
  }
};
