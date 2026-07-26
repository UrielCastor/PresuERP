import api from './api';

export class ReportService {
  static async getExecutiveSummary(params: any = {}) {
    const response = await api.get('/reports/executive', { params });
    return response.data.data;
  }

  static async getSales(params: any = {}) {
    const response = await api.get('/reports/sales', { params });
    return response.data.data;
  }

  static async getPurchases(params: any = {}) {
    const response = await api.get('/reports/purchases', { params });
    return response.data.data;
  }

  static async getCash(params: any = {}) {
    const response = await api.get('/reports/cash', { params });
    return response.data.data;
  }

  static async getInventory(params: any = {}) {
    const response = await api.get('/reports/inventory', { params });
    return response.data.data;
  }

  static async getStock(params: any = {}) {
    const response = await api.get('/reports/stock', { params });
    return response.data.data;
  }

  static async getKardex(params: any = {}) {
    const response = await api.get('/reports/kardex', { params });
    return response.data.data;
  }

  static async getFinancial(params: any = {}) {
    const response = await api.get('/reports/financial', { params });
    return response.data.data;
  }

  static async getCustomers(params: any = {}) {
    const response = await api.get('/reports/customers', { params });
    return response.data.data;
  }

  static async getProducts(params: any = {}) {
    const response = await api.get('/reports/products', { params });
    return response.data.data;
  }

  static async getUsers(params: any = {}) {
    const response = await api.get('/reports/users', { params });
    return response.data.data;
  }

  static async getAudit(params: any = {}) {
    const response = await api.get('/reports/audit', { params });
    return response.data.data;
  }

  static async exportReport(payload: { report: string; type: string; dateFrom: string; dateTo: string }) {
    const response = await api.post('/reports/export', payload, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `report_${payload.report}.${payload.type.toLowerCase()}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
