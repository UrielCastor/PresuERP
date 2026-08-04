import { SettingsRepository } from '../repositories/settings.repository';
import { AuditLogRepository } from './../repositories/auditLog.repository';
import { NotFoundError } from '../utils/appError';

export class SettingsService {
  private settingsRepo = new SettingsRepository();
  private auditLogRepo = new AuditLogRepository();

  async getSettings(businessId: string) {
    const business = await this.settingsRepo.getBusinessWithSettings(businessId);
    if (!business) {
      throw new NotFoundError('Business not found');
    }
    if (business.posSettings) {
      (business.posSettings as any).autoPriceRounding = Boolean(
        business.posSettings.autoRounding || (business.posSettings as any).autoPriceRounding
      );
      if (!(business.posSettings as any).autoRoundingMode) {
        (business.posSettings as any).autoRoundingMode = 'CASH_ONLY';
      }
    }
    return business;
  }

  async updateBusinessInfo(businessId: string, userId: string, data: any, ip?: string, userAgent?: string) {
    const result = await this.settingsRepo.updateBusiness(businessId, data);
    
    await this.auditLogRepo.log({
      businessId,
      userId,
      action: 'UPDATE_BUSINESS_INFO',
      module: 'SETTINGS',
      details: JSON.stringify(data),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return result;
  }

  async updateBusinessSettings(businessId: string, userId: string, data: any, ip?: string, userAgent?: string) {
    const result = await this.settingsRepo.updateBusinessSettings(businessId, data);

    await this.auditLogRepo.log({
      businessId,
      userId,
      action: 'UPDATE_BUSINESS_SETTINGS',
      module: 'SETTINGS',
      details: JSON.stringify(data),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return result;
  }

  async updateFiscalSettings(businessId: string, userId: string, data: any, ip?: string, userAgent?: string) {
    const result = await this.settingsRepo.updateFiscalSettings(businessId, data);

    await this.auditLogRepo.log({
      businessId,
      userId,
      action: 'UPDATE_FISCAL_SETTINGS',
      module: 'SETTINGS',
      details: JSON.stringify(data),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return result;
  }

  async updatePOSSettings(businessId: string, userId: string, data: any, ip?: string, userAgent?: string) {
    const payload = { ...data };
    if (payload.autoPriceRounding !== undefined) {
      payload.autoRounding = payload.autoPriceRounding;
    } else if (payload.autoRounding !== undefined) {
      payload.autoPriceRounding = payload.autoRounding;
    }

    const result = await this.settingsRepo.updatePOSSettings(businessId, payload);

    await this.auditLogRepo.log({
      businessId,
      userId,
      action: 'UPDATE_POS_SETTINGS',
      module: 'SETTINGS',
      details: JSON.stringify(data),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return {
      ...result,
      autoPriceRounding: result.autoRounding,
    };
  }

  async updatePrintSettings(businessId: string, userId: string, data: any, ip?: string, userAgent?: string) {
    const result = await this.settingsRepo.updatePrintSettings(businessId, data);

    await this.auditLogRepo.log({
      businessId,
      userId,
      action: 'UPDATE_PRINT_SETTINGS',
      module: 'SETTINGS',
      details: JSON.stringify(data),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return result;
  }

  async updateEmailSettings(businessId: string, userId: string, data: any, ip?: string, userAgent?: string) {
    const result = await this.settingsRepo.updateEmailSettings(businessId, data);

    await this.auditLogRepo.log({
      businessId,
      userId,
      action: 'UPDATE_EMAIL_SETTINGS',
      module: 'SETTINGS',
      details: JSON.stringify(data),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return result;
  }

  async updateNumberSettings(businessId: string, userId: string, data: any, ip?: string, userAgent?: string) {
    const result = await this.settingsRepo.updateNumberSettings(businessId, data);

    await this.auditLogRepo.log({
      businessId,
      userId,
      action: 'UPDATE_NUMBER_SETTINGS',
      module: 'SETTINGS',
      details: JSON.stringify(data),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return result;
  }
}
