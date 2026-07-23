import { z } from 'zod';

export const updateBusinessSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
});

export const updateBusinessSettingsSchema = z.object({
  currencyCode: z.string().min(1, 'Código de moneda requerido'),
  currencySymbol: z.string().min(1, 'Símbolo de moneda requerido'),
  timezone: z.string().min(1, 'Zona horaria requerida'),
  dateFormat: z.string().min(1, 'Formato de fecha requerido'),
  timeFormat: z.string().optional(),
  decimalSeparator: z.string().optional(),
  thousandSeparator: z.string().optional(),
  decimalPlaces: z.number().int().optional(),
  showCents: z.boolean().optional(),
  secondaryCurrencyCode: z.string().optional().nullable(),
  language: z.string().min(1, 'Idioma requerido'),
  logoUrl: z.string().optional().nullable(),
  allowNegativeStock: z.boolean().optional(),
  warnMinimumStock: z.boolean().optional(),
  autoDeductStock: z.boolean().optional(),
  allowManualAdjustments: z.boolean().optional(),
  costingMethod: z.string().optional(),
});

export const updateFiscalSettingsSchema = z.object({
  taxRegime: z.string().min(1, 'Régimen impositivo requerido'),
  fiscalYearStart: z.string().or(z.date()).optional(),
  vatNumber: z.string().optional().nullable(),
  grossIncomeNumber: z.string().optional().nullable(),
  multilateralAgreement: z.boolean().optional(),
  mainPointOfSale: z.string().optional().nullable(),
  afipEnvironment: z.string().optional(),
  digitalCertificateUrl: z.string().optional().nullable(),
  certificateExpiry: z.string().or(z.date()).optional().nullable(),
  isLocalTaxEnabled: z.boolean().optional(),
  defaultTaxRate: z.number().or(z.string()).optional(),
});

export const updatePOSSettingsSchema = z.object({
  isAutoCloseSessionEnabled: z.boolean().optional(),
  maxCashLimit: z.number().or(z.string()).optional(),
  printReceiptAfterSale: z.boolean().optional(),
  isDiscountAllowed: z.boolean().optional(),
  maxDiscountPercentage: z.number().min(0).max(100).optional(),
  defaultPaymentMethodId: z.string().optional().nullable(),
  defaultCashRegisterId: z.string().optional().nullable(),
  requireOpenCashRegister: z.boolean().optional(),
  allowMultipleRegisters: z.boolean().optional(),
  requireCustomerForSale: z.boolean().optional(),
  requireSellerForSale: z.boolean().optional(),
  ticketCopyCount: z.number().int().optional(),
  showTicketPreview: z.boolean().optional(),
  allowMixedPayments: z.boolean().optional(),
  autoRounding: z.boolean().optional(),
});

export const updatePrintSettingsSchema = z.object({
  printerType: z.string().min(1, 'Tipo de impresora requerido'),
  paperWidth: z.string().min(1, 'Ancho de papel requerido'),
  fontName: z.string().optional(),
  headerText: z.string().optional().nullable(),
  footerText: z.string().optional().nullable(),
  logoSize: z.number().min(10).max(200).optional(),
  margins: z.string().optional(),
  showQr: z.boolean().optional(),
  showBarcode: z.boolean().optional(),
});

export const updateEmailSettingsSchema = z.object({
  smtpHost: z.string().optional().nullable(),
  smtpPort: z.number().optional().nullable(),
  smtpUser: z.string().optional().nullable(),
  smtpPassword: z.string().optional().nullable(),
  senderEmail: z.string().email('Email inválido').optional().nullable(),
  senderName: z.string().optional().nullable(),
  secureConnection: z.boolean().optional(),
});

export const updateNumberSettingsSchema = z.object({
  currentPurchaseNumber: z.number().int().min(1).optional(),
  currentSaleNumber: z.number().int().min(1).optional(),
  currentTransferNumber: z.number().int().min(1).optional(),
  currentInventoryNumber: z.number().int().min(1).optional(),
});
