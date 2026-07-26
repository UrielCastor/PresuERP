import { api } from './api';

export interface FiscalConfigData {
  enabled: boolean;
  environment: 'INACTIVA' | 'HOMOLOGACION' | 'PRODUCCION';
  taxId?: string;
  businessName?: string;
  tradeName?: string;
  ivaCondition?: string;
  iibb?: string;
  province?: string;
  fiscalAddress?: string;
  certificateName?: string;
  certificateExpiration?: string;
  invoiceMode: 'TICKET_INTERNO' | 'AUTOMATIC' | 'MANUAL';
  certInfo?: {
    valid: boolean;
    name: string;
    expiration: string | null;
    status: string;
  };
}

export interface FiscalPointOfSaleData {
  id?: string;
  number: number;
  description: string;
  active: boolean;
}

export interface ElectronicInvoiceData {
  id: string;
  voucherType: string;
  voucherCode: number;
  pointOfSale: number;
  number: number;
  fullNumber: string;
  cae?: string;
  caeExpiration?: string;
  status: 'PENDING' | 'REQUESTED' | 'AUTHORIZED' | 'REJECTED' | 'CANCELLED';
  errorMessage?: string;
  docType: number;
  docNumber: string;
  customerName?: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  qrUrl?: string;
  createdAt: string;
  items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    subtotal: number;
    vatAmount: number;
    total: number;
  }>;
}

export interface FiscalErrorLogData {
  id: string;
  saleId?: string;
  invoiceId?: string;
  errorCode?: string;
  message: string;
  createdAt: string;
}

export class FiscalService {
  static async getConfig(): Promise<FiscalConfigData> {
    const res = await api.get('/fiscal/config');
    return res.data.data;
  }

  static async updateConfig(data: Partial<FiscalConfigData>): Promise<FiscalConfigData> {
    const res = await api.put('/fiscal/config', data);
    return res.data.data;
  }

  static async uploadCertificate(fileInfo: { name: string; content?: string; privateKeyContent?: string }) {
    const res = await api.post('/fiscal/certificates', fileInfo);
    return res.data.data;
  }

  static async testConnection() {
    const res = await api.post('/fiscal/test-connection');
    return res.data.data;
  }

  static async getPointsOfSale(): Promise<FiscalPointOfSaleData[]> {
    const res = await api.get('/fiscal/points-of-sale');
    return res.data.data;
  }

  static async createPointOfSale(data: { number: number; description: string; active?: boolean }): Promise<FiscalPointOfSaleData> {
    const res = await api.post('/fiscal/points-of-sale', data);
    return res.data.data;
  }

  static async updatePointOfSale(id: string, data: { description?: string; active?: boolean }) {
    const res = await api.put(`/fiscal/points-of-sale/${id}`, data);
    return res.data;
  }

  static async deletePointOfSale(id: string) {
    const res = await api.delete(`/fiscal/points-of-sale/${id}`);
    return res.data;
  }

  static async getInvoices(params: any = {}): Promise<{ items: ElectronicInvoiceData[]; pagination: any }> {
    const res = await api.get('/fiscal/invoices', { params });
    return res.data.data;
  }

  static async getInvoiceById(id: string): Promise<ElectronicInvoiceData> {
    const res = await api.get(`/fiscal/invoices/${id}`);
    return res.data.data;
  }

  static async emitInvoiceForSale(saleId: string): Promise<ElectronicInvoiceData> {
    const res = await api.post(`/fiscal/invoices/emit-for-sale/${saleId}`);
    return res.data.data;
  }

  static async requestCaeForPendingInvoice(id: string): Promise<ElectronicInvoiceData> {
    const res = await api.post(`/fiscal/invoices/${id}/request-cae`);
    return res.data.data;
  }

  static async createCreditNote(id: string, reason: string): Promise<ElectronicInvoiceData> {
    const res = await api.post(`/fiscal/invoices/${id}/credit-note`, { reason });
    return res.data.data;
  }

  static async getFiscalReport(params: any = {}) {
    const res = await api.get('/fiscal/reports', { params });
    return res.data.data;
  }
}
