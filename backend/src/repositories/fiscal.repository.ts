import { PrismaClient } from '@prisma/client';
import { CryptoUtil } from '../utils/crypto.util';

const prisma = new PrismaClient();

export class FiscalRepository {
  /**
   * Obtiene la configuración fiscal de la empresa
   */
  static async getFiscalConfig(businessId: string) {
    let config = await prisma.fiscalConfiguration.findUnique({
      where: { businessId },
      include: { credentials: { where: { active: true }, take: 1 } },
    });

    if (!config) {
      config = await prisma.fiscalConfiguration.create({
        data: {
          businessId,
          enabled: false,
          environment: 'HOMOLOGACION',
          ivaCondition: 'RESPONSABLE_INSCRIPTO',
          invoiceMode: 'AUTOMATIC',
        },
        include: { credentials: { where: { active: true }, take: 1 } },
      });
    }

    return config;
  }

  /**
   * Actualiza la configuración fiscal operacional
   */
  static async upsertFiscalConfig(businessId: string, data: any) {
    return prisma.fiscalConfiguration.upsert({
      where: { businessId },
      create: {
        businessId,
        ...data,
      },
      update: {
        ...data,
      },
    });
  }

  /**
   * Registra o actualiza la credencial cifrada sensible de la empresa
   */
  static async saveFiscalCredential(businessId: string, data: {
    certificateName: string;
    certificateRaw: string;
    privateKeyRaw?: string;
    expiration?: Date;
  }) {
    const config = await this.getFiscalConfig(businessId);

    // Desactivar credenciales previas
    await prisma.fiscalCredential.updateMany({
      where: { businessId },
      data: { active: false },
    });

    // Guardar certificado cifrado con AES-256
    return prisma.fiscalCredential.create({
      data: {
        businessId,
        fiscalConfigId: config.id,
        certificateName: data.certificateName,
        certificateEncrypted: CryptoUtil.encrypt(data.certificateRaw),
        privateKeyEncrypted: data.privateKeyRaw ? CryptoUtil.encrypt(data.privateKeyRaw) : null,
        certificateExpiration: data.expiration,
        active: true,
      },
    });
  }

  /**
   * Obtiene la credencial cifrada activa y la descifra de manera segura en memoria
   */
  static async getActiveCredential(businessId: string) {
    const cred = await prisma.fiscalCredential.findFirst({
      where: { businessId, active: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!cred) return null;

    return {
      id: cred.id,
      certificateName: cred.certificateName,
      certificateExpiration: cred.certificateExpiration,
      certificateDecrypted: CryptoUtil.decrypt(cred.certificateEncrypted),
      privateKeyDecrypted: cred.privateKeyEncrypted ? CryptoUtil.decrypt(cred.privateKeyEncrypted) : null,
    };
  }

  /**
   * Listar puntos de venta fiscales
   */
  static async getPointsOfSale(businessId: string) {
    return prisma.fiscalPointOfSale.findMany({
      where: { businessId },
      orderBy: { number: 'asc' },
    });
  }

  static async createPointOfSale(businessId: string, data: { number: number; description: string; active?: boolean }) {
    return prisma.fiscalPointOfSale.create({
      data: {
        businessId,
        number: data.number,
        description: data.description,
        active: data.active ?? true,
      },
    });
  }

  static async updatePointOfSale(businessId: string, id: string, data: { description?: string; active?: boolean }) {
    return prisma.fiscalPointOfSale.updateMany({
      where: { id, businessId },
      data,
    });
  }

  static async deletePointOfSale(businessId: string, id: string) {
    return prisma.fiscalPointOfSale.deleteMany({
      where: { id, businessId },
    });
  }

  /**
   * Obtener próximo número de comprobante fiscal correlativo
   */
  static async getNextInvoiceNumber(businessId: string, pointOfSale: number, voucherCode: number): Promise<number> {
    const lastInvoice = await prisma.electronicInvoice.findFirst({
      where: { businessId, pointOfSale, voucherCode },
      orderBy: { number: 'desc' },
    });

    return lastInvoice ? lastInvoice.number + 1 : 1;
  }

  /**
   * Guardar comprobante electrónico con estado explícito (PENDING, REQUESTED, AUTHORIZED, REJECTED, CANCELLED)
   */
  static async createInvoice(businessId: string, data: any) {
    const { items, ...invoiceData } = data;

    return prisma.electronicInvoice.create({
      data: {
        businessId,
        ...invoiceData,
        items: items
          ? {
              create: items.map((item: any) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                vatRate: item.vatRate ?? 21.0,
                subtotal: item.subtotal,
                vatAmount: item.vatAmount,
                total: item.total,
              })),
            }
          : undefined,
      },
      include: {
        items: true,
      },
    });
  }

  /**
   * Actualizar estado del comprobante fiscal
   */
  static async updateInvoiceStatus(id: string, status: string, caeData?: { cae?: string; caeExpiration?: Date; errorMessage?: string; rawResponse?: any }) {
    return prisma.electronicInvoice.update({
      where: { id },
      data: {
        status,
        ...(caeData?.cae ? { cae: caeData.cae } : {}),
        ...(caeData?.caeExpiration ? { caeExpiration: caeData.caeExpiration } : {}),
        ...(caeData?.errorMessage ? { errorMessage: caeData.errorMessage } : {}),
        ...(caeData?.rawResponse ? { rawResponse: caeData.rawResponse } : {}),
      },
    });
  }

  /**
   * Registra un error fiscal en FiscalErrorLog para soporte y diagnóstico
   */
  static async logFiscalError(businessId: string, data: {
    saleId?: string;
    invoiceId?: string;
    request?: any;
    response?: any;
    errorCode?: string;
    message: string;
  }) {
    return prisma.fiscalErrorLog.create({
      data: {
        businessId,
        saleId: data.saleId,
        invoiceId: data.invoiceId,
        request: data.request ? (typeof data.request === 'string' ? JSON.parse(data.request) : data.request) : undefined,
        response: data.response ? (typeof data.response === 'string' ? JSON.parse(data.response) : data.response) : undefined,
        errorCode: data.errorCode || 'UNKNOWN',
        message: data.message,
      },
    });
  }

  /**
   * Listar comprobantes electrónicos emitidos con filtros
   */
  static async getInvoices(businessId: string, filters: any = {}) {
    const { search, voucherType, pointOfSale, status, dateFrom, dateTo, page = 1, limit = 15 } = filters;

    const where: any = { businessId };

    if (voucherType) where.voucherType = voucherType;
    if (pointOfSale) where.pointOfSale = Number(pointOfSale);
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { fullNumber: { contains: search, mode: 'insensitive' } },
        { cae: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { docNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [items, total] = await Promise.all([
      prisma.electronicInvoice.findMany({
        where,
        include: { items: true, sale: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.electronicInvoice.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / take) || 1,
      },
    };
  }

  /**
   * Obtener un comprobante por ID
   */
  static async getInvoiceById(businessId: string, id: string) {
    return prisma.electronicInvoice.findFirst({
      where: { id, businessId },
      include: { items: true, sale: true, business: true, errorLogs: true },
    });
  }

  /**
   * Listar errores fiscales para diagnóstico
   */
  static async getErrorLogs(businessId: string, limit: number = 50) {
    return prisma.fiscalErrorLog.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
