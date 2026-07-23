import { DashboardRepository } from '../repositories/dashboard.repository';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export class DashboardService {
  private dashboardRepo = new DashboardRepository();

  async getDashboardData(businessId: string) {
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
      this.dashboardRepo.getSalesTotal(businessId, todayStart, todayEnd),
      this.dashboardRepo.getSalesTotal(businessId, yesterdayStart, yesterdayEnd),
      this.dashboardRepo.getNewCustomersCount(businessId, lastWeekStart),
      this.dashboardRepo.getStockSummary(businessId),
      this.dashboardRepo.getActiveCashRegister(businessId),
      this.dashboardRepo.getRecentSales(businessId),
      this.dashboardRepo.getRecentActivity(businessId),
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
