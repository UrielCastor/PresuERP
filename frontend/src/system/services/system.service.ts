import api from '@/services/api';

export interface SystemMetrics {
  tenants: {
    total: number;
    active: number;
    suspended: number;
  };
  users: {
    total: number;
    active?: number;
  };
  revenue: {
    mrr: number;
    arr?: number;
    monthlyCollected?: number;
  };
  invoices?: {
    pending: number;
    paid: number;
    overdue: number;
  };
  churn?: {
    count: number;
    percent: number;
  };
  newCompanies?: number;
  sales: {
    totalAmount: number;
  };
  products: {
    total: number;
  };
  clients: {
    total: number;
  };
  subs: {
    active: number;
    expired: number;
    pending: number;
  };
}

export interface PlanPrice {
  id?: string;
  planId: string;
  billingCycle: 'FREE' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY' | 'LIFETIME';
  price: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Plan {
  id?: string;
  name: string;
  code: string;
  prices?: PlanPrice[];
  maxUsers: number;
  maxProducts: number;
  features?: string;
  active?: boolean;
}

export class SystemService {
  static async getDashboardMetrics(): Promise<SystemMetrics> {
    const response = await api.get('/system/dashboard');
    return response.data.data;
  }

  static async getBusinesses(showDeleted?: boolean) {
    const response = await api.get('/system/businesses', { params: { showDeleted } });
    return response.data.data;
  }

  static async getBusinessOverview(id: string) {
    const response = await api.get(`/system/businesses/${id}/overview`);
    return response.data;
  }

  static async getUsers(filters?: any) {
    const response = await api.get('/system/users', { params: filters });
    return response.data.data;
  }

  static async getUserDetails(id: string) {
    const response = await api.get(`/system/users/${id}`);
    return response.data.data;
  }

  static async updateUserStatus(id: string, isActive: boolean) {
    const response = await api.patch(`/system/users/${id}/status`, { isActive });
    return response.data.data;
  }

  static async deleteUser(id: string, reason?: string) {
    const response = await api.delete(`/system/users/${id}`, {
      data: { reason },
      params: { reason }
    });
    return response.data;
  }

  static async changeBusinessPlan(businessId: string, planName: string) {
    const response = await api.patch(`/system/businesses/${businessId}/plan`, { planName });
    return response.data;
  }

  static async getPlans(): Promise<Plan[]> {
    const response = await api.get('/system/plans');
    return response.data.data;
  }

  static async createPlan(plan: Partial<Plan>) {
    const response = await api.post('/system/plans', plan);
    return response.data.data;
  }

  static async updatePlan(id: string, plan: Partial<Plan>) {
    const response = await api.put(`/system/plans/${id}`, plan);
    return response.data.data;
  }

  static async changePlanStatus(id: string, active: boolean) {
    const response = await api.patch(`/system/plans/${id}/status`, { active });
    return response.data.data;
  }

  // --- PlanPrice Operations ---

  static async createPlanPrice(planId: string, priceData: Partial<PlanPrice>) {
    const response = await api.post(`/system/plans/${planId}/prices`, priceData);
    return response.data.data;
  }

  static async updatePlanPrice(priceId: string, priceData: Partial<PlanPrice>) {
    const response = await api.put(`/system/plans/prices/${priceId}`, priceData);
    return response.data.data;
  }

  static async changePlanPriceStatus(priceId: string, active: boolean) {
    const response = await api.patch(`/system/plans/prices/${priceId}/status`, { active });
    return response.data.data;
  }

  static async deletePlanPrice(priceId: string) {
    const response = await api.delete(`/system/plans/prices/${priceId}`);
    return response.data.data;
  }
}
