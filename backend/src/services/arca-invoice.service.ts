import { ArcaService, ArcaVoucherRequest } from './arca.service';
import { ArcaAuthService } from './arca-auth.service';

export class ArcaInvoiceService {
  static async authenticate(businessId: string) {
    return ArcaAuthService.authenticate(businessId);
  }

  static async getLastVoucher(businessId: string, pointOfSale: number, voucherCode: number) {
    return ArcaService.getLastVoucher(businessId, pointOfSale, voucherCode);
  }

  static async createVoucher(businessId: string, data: ArcaVoucherRequest, saleId?: string, isManualPending: boolean = false) {
    return ArcaService.createVoucher(businessId, data, saleId, isManualPending);
  }

  static async createCreditNote(businessId: string, invoiceId: string, reason: string) {
    return ArcaService.createCreditNote(businessId, invoiceId, reason);
  }

  static async createDebitNote(businessId: string, invoiceId: string, reason: string) {
    return ArcaService.createDebitNote(businessId, invoiceId, reason);
  }

  static async consultVoucher(businessId: string, cae: string, pointOfSale: number, voucherCode: number, number: number) {
    return ArcaService.consultarCAE(businessId, cae, pointOfSale, voucherCode, number);
  }
}
