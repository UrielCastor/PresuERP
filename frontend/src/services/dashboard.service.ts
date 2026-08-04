import api from './api';

export const dashboardApi = {
  getDashboardData: async (params?: any) => {
    const { data } = await api.get('/dashboard', { params });
    return data.data;
  },
};
