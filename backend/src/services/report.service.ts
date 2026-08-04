import { ReportRepository } from '../repositories/report.repository';
import { parseDateRange } from '../utils/dateRange';

export class ReportService {
  private reportRepo: ReportRepository;

  constructor() {
    this.reportRepo = new ReportRepository();
  }

  async getExecutiveSummary(businessId: string, filters?: any) {
    return this.reportRepo.getExecutiveMetrics(businessId, filters);
  }

  async getSalesReport(businessId: string, filters: any) {
    const { start, end } = parseDateRange(filters.dateFrom, filters.dateTo);
    return this.reportRepo.getSalesMetrics(businessId, start, end, filters);
  }

  async getPurchasesReport(businessId: string, filters: any) {
    const { start, end } = parseDateRange(filters.dateFrom, filters.dateTo);
    return this.reportRepo.getPurchasesMetrics(businessId, start, end, filters);
  }

  async getCashReport(businessId: string, filters: any) {
    const { start, end } = parseDateRange(filters.dateFrom, filters.dateTo);
    return this.reportRepo.getCashMetrics(businessId, start, end, filters);
  }

  async getInventoryReport(businessId: string, filters?: any) {
    return this.reportRepo.getInventoryMetrics(businessId, filters);
  }

  async getKardexReport(businessId: string, filters: any) {
    const { start, end } = parseDateRange(filters.dateFrom, filters.dateTo);
    return this.reportRepo.getKardex(businessId, start, end, filters);
  }

  async getFinancialReport(businessId: string, filters: any) {
    const { start, end } = parseDateRange(filters.dateFrom, filters.dateTo);
    return this.reportRepo.getFinancialMetrics(businessId, start, end, filters);
  }

  async getCustomersReport(businessId: string, filters: any) {
    const { start, end } = parseDateRange(filters.dateFrom, filters.dateTo);
    return this.reportRepo.getCustomersMetrics(businessId, start, end, filters);
  }

  async getProductsReport(businessId: string, filters: any) {
    const { start, end } = parseDateRange(filters.dateFrom, filters.dateTo);
    return this.reportRepo.getProductsMetrics(businessId, start, end, filters);
  }

  async getUsersReport(businessId: string, filters: any) {
    const { start, end } = parseDateRange(filters.dateFrom, filters.dateTo);
    return this.reportRepo.getUsersMetrics(businessId, start, end, filters);
  }

  async getAuditReport(businessId: string, filters: any) {
    return this.reportRepo.getAuditReport(businessId, filters);
  }
}
