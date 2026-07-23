import api from './api';

export interface BusinessData {
  id?: string;
  name: string;
  taxId: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  isActive?: boolean;
  subscriptionPlan?: string;
  createdAt?: string;
  _count?: { users: number, sales: number, purchases: number };
}

export interface UsageMetrics {
  users: number;
  products: number;
  customers: number;
  suppliers: number;
  warehouses: number;
  cashRegisters: number;
  salesCount: number;
  salesTotal: number;
  purchasesCount: number;
  purchasesTotal: number;
}

export class BusinessService {
  static async getCurrent() {
    const response = await api.get('/businesses/current');
    return response.data.data;
  }

  static async updateCurrent(data: Partial<BusinessData>) {
    const response = await api.put('/businesses/current', data);
    return response.data.data;
  }

  static async getAll() {
    const response = await api.get('/businesses');
    return response.data.data;
  }

  static async getById(id: string) {
    const response = await api.get(`/businesses/${id}`);
    return response.data.data;
  }

  static async create(data: Partial<BusinessData>) {
    const response = await api.post('/businesses', data);
    return response.data.data;
  }

  static async update(id: string, data: Partial<BusinessData>) {
    const response = await api.put(`/businesses/${id}`, data);
    return response.data.data;
  }

  static async suspend(id: string) {
    const response = await api.patch(`/businesses/${id}/suspend`);
    return response.data.data;
  }

  static async activate(id: string) {
    const response = await api.patch(`/businesses/${id}/activate`);
    return response.data.data;
  }

  static async getUsageMetrics(id: string): Promise<UsageMetrics> {
    const response = await api.get(`/businesses/${id}/usage`);
    return response.data.data;
  }

  static async delete(id: string) {
    const response = await api.delete(`/businesses/${id}`);
    return response.data;
  }

  static async validateDelete(id: string) {
    const response = await api.get(`/system/businesses/${id}/validate-delete`);
    return response.data.data;
  }

  static async restore(id: string) {
    const response = await api.patch(`/system/businesses/${id}/restore`);
    return response.data.data;
  }
}
