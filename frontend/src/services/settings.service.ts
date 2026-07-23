import api from './api';

export interface BusinessData {
  id?: string;
  name: string;
  taxId?: string;
  email: string | null;
  phone: string | null;
  website?: string | null;
  address: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zipCode?: string | null;
  subscriptionPlan?: string;
  subscriptionEndsAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BusinessSettingsData {
  currencyCode: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  decimalSeparator: string;
  thousandSeparator: string;
  decimalPlaces: number;
  showCents: boolean;
  secondaryCurrencyCode?: string | null;
  language: string;
  logoUrl?: string | null;
  allowNegativeStock?: boolean;
  warnMinimumStock?: boolean;
  autoDeductStock?: boolean;
  allowManualAdjustments?: boolean;
  costingMethod?: string;
}

export interface FiscalSettingsData {
  taxRegime: string;
  fiscalYearStart?: string;
  vatNumber: string | null;
  grossIncomeNumber?: string | null;
  multilateralAgreement?: boolean;
  mainPointOfSale?: string | null;
  afipEnvironment?: string;
  digitalCertificateUrl?: string | null;
  certificateExpiry?: string | null;
  isLocalTaxEnabled: boolean;
  defaultTaxRate: string | number;
}

export interface POSSettingsData {
  isAutoCloseSessionEnabled: boolean;
  maxCashLimit: string | number;
  printReceiptAfterSale: boolean;
  isDiscountAllowed: boolean;
  maxDiscountPercentage: number;
  defaultPaymentMethodId?: string | null;
  defaultCashRegisterId?: string | null;
  requireOpenCashRegister?: boolean;
  allowMultipleRegisters?: boolean;
  requireCustomerForSale?: boolean;
  requireSellerForSale?: boolean;
  ticketCopyCount?: number;
  showTicketPreview?: boolean;
  allowMixedPayments?: boolean;
  autoRounding?: boolean;
}

export interface PrintSettingsData {
  printerType: string;
  paperWidth: string;
  fontName: string;
  headerText: string | null;
  footerText: string | null;
  logoSize: number;
  margins?: string;
  showQr?: boolean;
  showBarcode?: boolean;
}

export interface EmailSettingsData {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword?: string | null;
  senderEmail: string | null;
  senderName: string | null;
  secureConnection: boolean;
}

export interface NumberSettingsData {
  currentPurchaseNumber: number;
  currentSaleNumber: number;
  currentTransferNumber: number;
  currentInventoryNumber: number;
}

export interface BusinessWithSettings extends BusinessData {
  settings: BusinessSettingsData | null;
  fiscalSettings: FiscalSettingsData | null;
  posSettings: POSSettingsData | null;
  printSettings: PrintSettingsData | null;
  emailSettings: EmailSettingsData | null;
  numberSettings: NumberSettingsData | null;
  _count?: {
    users: number;
    products: number;
    customers: number;
    suppliers: number;
    warehouses: number;
    cashRegisters: number;
  };
}

export class SettingsService {
  static async getSettings(): Promise<BusinessWithSettings> {
    const response = await api.get('/settings');
    return response.data.data;
  }

  static async updateBusiness(data: BusinessData): Promise<BusinessData> {
    const response = await api.put('/settings/business', data);
    return response.data.data;
  }

  static async updatePreferences(data: BusinessSettingsData): Promise<BusinessSettingsData> {
    const response = await api.put('/settings/preferences', data);
    return response.data.data;
  }

  static async updateFiscal(data: FiscalSettingsData): Promise<FiscalSettingsData> {
    const response = await api.put('/settings/fiscal', data);
    return response.data.data;
  }

  static async updatePOS(data: POSSettingsData): Promise<POSSettingsData> {
    const response = await api.put('/settings/pos', data);
    return response.data.data;
  }

  static async updatePrint(data: PrintSettingsData): Promise<PrintSettingsData> {
    const response = await api.put('/settings/print', data);
    return response.data.data;
  }

  static async updateEmail(data: EmailSettingsData): Promise<EmailSettingsData> {
    const response = await api.put('/settings/email', data);
    return response.data.data;
  }

  static async updateNumbers(data: NumberSettingsData): Promise<NumberSettingsData> {
    const response = await api.put('/settings/numbers', data);
    return response.data.data;
  }
}
