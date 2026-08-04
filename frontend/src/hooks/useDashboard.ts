import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/dashboard.service';

export const useDashboard = (warehouseId?: string) => {
  return useQuery({
    queryKey: ['dashboard', warehouseId],
    queryFn: () => dashboardApi.getDashboardData({ warehouseId: warehouseId !== 'ALL' ? warehouseId : undefined }),
    refetchInterval: 60000, // Optional refresh
  });
};
