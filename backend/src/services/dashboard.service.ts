import { DashboardRepository } from '../repositories/dashboard.repository';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export class DashboardService {
  private dashboardRepo = new DashboardRepository();

  async getDashboardData(businessId: string, warehouseId?: string) {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    
    const yesterdayStart = startOfDay(subDays(new Date(), 1));
    const yesterdayEnd = endOfDay(subDays(new Date(), 1));
    
    const lastWeekStart = subDays(new Date(), 7);

    const [
      salesToday,
      salesYesterday,
      newCustomers,
      stockSummary,
      activeBox,
      recentSales,
      recentActivity,
    ] = await Promise.all([
      this.dashboardRepo.getSalesTotal(businessId, todayStart, todayEnd, warehouseId),
      this.dashboardRepo.getSalesTotal(businessId, yesterdayStart, yesterdayEnd, warehouseId),
      this.dashboardRepo.getNewCustomersCount(businessId, lastWeekStart, warehouseId),
      this.dashboardRepo.getStockSummary(businessId, warehouseId),
      this.dashboardRepo.getActiveCashRegister(businessId, warehouseId),
      this.dashboardRepo.getRecentSales(businessId, 5, warehouseId),
      this.dashboardRepo.getRecentActivity(businessId, 5),
    ]);

    let percentageChange: number | string = 0;
    if (salesYesterday === 0) {
      if (salesToday > 0) percentageChange = 'Nuevo';
    } else {
      percentageChange = Math.round(((salesToday - salesYesterday) / salesYesterday) * 100);
    }

    return {
      salesToday: {
        amount: salesToday,
        percentageChange,
      },
      newCustomers: {
        count: newCustomers,
        period: 'week',
      },
      stock: stockSummary,
      cash: activeBox || {
        active: false,
        balance: 0,
        name: 'Sin caja abierta'
      },
      recentSales,
      recentActivity,
    };
  }
}
