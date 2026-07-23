import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/dashboard.service';

export const useDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.getDashboardData,
    refetchInterval: 60000, // Optional refresh
  });
};
