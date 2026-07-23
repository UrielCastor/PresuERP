import { prisma } from '../config/db';
import {
  BusinessSettings,
  FiscalSettings,
  POSSettings,
  PrintSettings,
  EmailSettings,
  NumberSettings,
  Business
} from '@prisma/client';

export class SettingsRepository {
  async getBusinessWithSettings(businessId: string) {
    return prisma.business.findUnique({
      where: { id: businessId },
      include: {
        settings: true,
        fiscalSettings: true,
        posSettings: true,
        printSettings: true,
        emailSettings: true,
        numberSettings: true,
        _count: {
          select: {
            users: true,
            products: true,
            customers: true,
            suppliers: true,
            warehouses: true,
            cashRegisters: true,
          }
        }
      },
    });
  }

  async getBusiness(businessId: string): Promise<Business | null> {
    return prisma.business.findUnique({
      where: { id: businessId },
    });
  }

  async updateBusiness(businessId: string, data: Partial<Omit<Business, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Business> {
    return prisma.business.update({
      where: { id: businessId },
      data,
    });
  }

  async updateBusinessSettings(businessId: string, data: Partial<Omit<BusinessSettings, 'id' | 'businessId' | 'updatedAt'>>): Promise<BusinessSettings> {
    return prisma.businessSettings.upsert({
      where: { businessId },
      update: data,
      create: {
        ...data,
        businessId,
      } as any,
    });
  }

  async updateFiscalSettings(businessId: string, data: Partial<Omit<FiscalSettings, 'id' | 'businessId' | 'updatedAt'>>): Promise<FiscalSettings> {
    return prisma.fiscalSettings.upsert({
      where: { businessId },
      update: data,
      create: {
        ...data,
        businessId,
      } as any,
    });
  }

  async updatePOSSettings(businessId: string, data: Partial<Omit<POSSettings, 'id' | 'businessId' | 'updatedAt'>>): Promise<POSSettings> {
    return prisma.pOSSettings.upsert({
      where: { businessId },
      update: data,
      create: {
        ...data,
        businessId,
      } as any,
    });
  }

  async updatePrintSettings(businessId: string, data: Partial<Omit<PrintSettings, 'id' | 'businessId' | 'updatedAt'>>): Promise<PrintSettings> {
    return prisma.printSettings.upsert({
      where: { businessId },
      update: data,
      create: {
        ...data,
        businessId,
      } as any,
    });
  }

  async updateEmailSettings(businessId: string, data: Partial<Omit<EmailSettings, 'id' | 'businessId' | 'updatedAt'>>): Promise<EmailSettings> {
    return prisma.emailSettings.upsert({
      where: { businessId },
      update: data,
      create: {
        ...data,
        businessId,
      } as any,
    });
  }

  async updateNumberSettings(businessId: string, data: Partial<Omit<NumberSettings, 'id' | 'businessId' | 'updatedAt'>>): Promise<NumberSettings> {
    return prisma.numberSettings.upsert({
      where: { businessId },
      update: data,
      create: {
        ...data,
        businessId,
      } as any,
    });
  }
}
