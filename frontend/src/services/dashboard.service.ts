import api from './api';

export const dashboardApi = {
  getDashboardData: async () => {
    const { data } = await api.get('/dashboard');
    return data.data;
  },
};
