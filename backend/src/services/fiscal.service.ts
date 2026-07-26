import { FiscalRepository } from '../repositories/fiscal.repository';
import { ArcaService } from './arca.service';
import { AfipQrUtil } from '../utils/afipQr.util';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FiscalService {
  /**
   * Obtiene la configuración fiscal de la empresa
   */
  static async getConfig(businessId: string) {
    const config = await FiscalRepository.getFiscalConfig(businessId);
    const cred = await FiscalRepository.getActiveCredential(businessId);
    const certInfo = await ArcaService.validarCertificado(cred?.certificateDecrypted);

    return {
      ...config,
      certificateName: cred?.certificateName || null,
      certificateExpiration: cred?.certificateExpiration || null,
      certInfo,
    };
  }

  /**
   * Actualiza la configuración fiscal
   */
  static async updateConfig(businessId: string, data: any) {
    const existing = await FiscalRepository.getFiscalConfig(businessId);

    const updated = await FiscalRepository.upsertFiscalConfig(businessId, {
      enabled: data.enabled ?? existing.enabled,
      environment: data.environment ?? existing.environment,
      taxId: data.taxId ?? existing.taxId,
      businessName: data.businessName ?? existing.businessName,
      tradeName: data.tradeName ?? existing.tradeName,
      ivaCondition: data.ivaCondition ?? existing.ivaCondition,
      iibb: data.iibb ?? existing.iibb,
      province: data.province ?? existing.province,
      fiscalAddress: data.fiscalAddress ?? existing.fiscalAddress,
      invoiceMode: data.invoiceMode ?? existing.invoiceMode,
    });

    // Auditoría
    await prisma.activityLog.create({
      data: {
        businessId,
        entityName: 'FiscalConfiguration',
        entityId: updated.id,
        actionType: 'FISCAL_CONFIG_UPDATED',
        previousValues: JSON.stringify(existing),
        newValues: JSON.stringify(updated),
      },
    });

    return updated;
  }

  /**
   * Carga cifrada de certificado digital ARCA (.crt / .key / .p12 / .pem)
   */
  static async uploadCertificate(businessId: string, fileInfo: { name: string; content?: string; privateKeyContent?: string }) {
    if (!fileInfo.content) {
      throw new Error("Contenido del certificado vacío o no válido.");
    }

    const { ArcaAuthService } = await import('./arca-auth.service');
    const config = await FiscalRepository.getFiscalConfig(businessId);

    // Validar certificado con node-forge: formato, vencimiento y coincidencia con clave privada
    const certInfo = await ArcaAuthService.validarCertificado(
      fileInfo.content,
      fileInfo.privateKeyContent,
      config.taxId || undefined,
    );

    if (!certInfo.valid) {
      throw new Error(`Certificado inválido: ${certInfo.error || certInfo.status}`);
    }

    // Guardar credencial sensible cifrada con AES-256 en FiscalCredential
    const credential = await FiscalRepository.saveFiscalCredential(businessId, {
      certificateName: fileInfo.name,
      certificateRaw: fileInfo.content,
      privateKeyRaw: fileInfo.privateKeyContent,
      expiration: certInfo.expiration || undefined,
    });

    // Limpiar caché WSAA para forzar re-autenticación con el nuevo cert
    ArcaAuthService.clearCache(businessId);

    // Auditoría
    await prisma.activityLog.create({
      data: {
        businessId,
        entityName: 'FiscalCredential',
        entityId: credential.id,
        actionType: 'CERTIFICATE_UPLOADED',
        previousValues: '{}',
        newValues: JSON.stringify({ certificateName: fileInfo.name, expiration: certInfo.expiration, status: certInfo.status }),
      },
    });

    return {
      success: true,
      certificateName: credential.certificateName,
      expiration: credential.certificateExpiration,
      status: certInfo.status,
      daysUntilExpiration: (certInfo as any).daysUntilExpiration ?? null,
    };
  }

  /**
   * Puntos de venta ABM
   */
  static async getPointsOfSale(businessId: string) {
    let posList = await FiscalRepository.getPointsOfSale(businessId);
    if (posList.length === 0) {
      const defaultPos = await FiscalRepository.createPointOfSale(businessId, {
        number: 1,
        description: 'Sucursal Principal',
        active: true,
      });
      posList = [defaultPos];
    }
    return posList;
  }

  static async createPointOfSale(businessId: string, data: { number: number; description: string; active?: boolean }) {
    return FiscalRepository.createPointOfSale(businessId, data);
  }

  static async updatePointOfSale(businessId: string, id: string, data: { description?: string; active?: boolean }) {
    return FiscalRepository.updatePointOfSale(businessId, id, data);
  }

  static async deletePointOfSale(businessId: string, id: string) {
    return FiscalRepository.deletePointOfSale(businessId, id);
  }

  /**
   * Listado de comprobantes emitidos con generación de URL QR oficial AFIP
   */
  static async getInvoices(businessId: string, filters: any) {
    const config = await FiscalRepository.getFiscalConfig(businessId);
    const result = await FiscalRepository.getInvoices(businessId, filters);

    // Adjuntar QR oficial AFIP a cada comprobante
    const itemsWithQr = result.items.map(inv => {
      const qrUrl = inv.cae
        ? AfipQrUtil.generateQrUrl({
            date: inv.createdAt,
            cuit: config.taxId || '30712345678',
            pointOfSale: inv.pointOfSale,
            voucherCode: inv.voucherCode,
            number: inv.number,
            totalAmount: Number(inv.totalAmount),
            docType: inv.docType,
            docNumber: inv.docNumber,
            cae: inv.cae,
          })
        : null;

      return {
        ...inv,
        qrUrl,
      };
    });

    return {
      ...result,
      items: itemsWithQr,
    };
  }

  static async getInvoiceById(businessId: string, id: string) {
    const config = await FiscalRepository.getFiscalConfig(businessId);
    const invoice = await FiscalRepository.getInvoiceById(businessId, id);
    if (!invoice) return null;

    const qrUrl = invoice.cae
      ? AfipQrUtil.generateQrUrl({
          date: invoice.createdAt,
          cuit: config.taxId || '30712345678',
          pointOfSale: invoice.pointOfSale,
          voucherCode: invoice.voucherCode,
          number: invoice.number,
          totalAmount: Number(invoice.totalAmount),
          docType: invoice.docType,
          docNumber: invoice.docNumber,
          cae: invoice.cae,
        })
      : null;

    return {
      ...invoice,
      qrUrl,
    };
  }

  /**
   * Emite un comprobante fiscal ARCA a partir de una venta POS
   */
  static async emitInvoiceForSale(businessId: string, saleId: string) {
    const config = await FiscalRepository.getFiscalConfig(businessId);
    if (!config.enabled && config.invoiceMode !== 'MANUAL') {
      return null;
    }

    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!sale) {
      throw new Error("Venta no encontrada.");
    }

    // Verificar si la venta ya tiene factura emitida
    const existingInvoice = await prisma.electronicInvoice.findFirst({
      where: { businessId, saleId, status: { in: ['AUTHORIZED', 'PENDING'] } },
    });

    if (existingInvoice) {
      return existingInvoice;
    }

    const posList = await this.getPointsOfSale(businessId);
    const mainPos = posList.find(p => p.active) || posList[0];

    let docType = 99;
    let docNumber = '0';
    let customerName = 'Consumidor Final';
    let customerIva = 'CONSUMIDOR_FINAL';

    if (sale.customer) {
      customerName = sale.customer.name;
      if (sale.customer.taxId) {
        docType = sale.customer.taxId.length === 11 ? 80 : 96;
        docNumber = sale.customer.taxId;
      }
    }

    const arcaRequest = {
      pointOfSale: mainPos ? mainPos.number : 1,
      docType,
      docNumber,
      customerName,
      customerIva,
      items: sale.items.map(item => ({
        description: item.product?.name || 'Producto',
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        vatRate: 21.0,
      })),
    };

    const isManual = config.invoiceMode === 'MANUAL';
    const invoice = await ArcaService.createVoucher(businessId, arcaRequest, sale.id, isManual);

    // Auditoría
    await prisma.activityLog.create({
      data: {
        businessId,
        entityName: 'ElectronicInvoice',
        entityId: invoice.id,
        actionType: invoice.status === 'AUTHORIZED' ? 'INVOICE_EMITTED' : invoice.status === 'REJECTED' ? 'INVOICE_REJECTED' : 'INVOICE_PENDING',
        previousValues: '{}',
        newValues: JSON.stringify({ fullNumber: invoice.fullNumber, cae: invoice.cae, status: invoice.status }),
      },
    });

    return invoice;
  }

  /**
   * Solicitar CAE manualmente para un comprobante PENDING o REJECTED
   */
  static async requestCaeForPendingInvoice(businessId: string, invoiceId: string) {
    const invoice = await FiscalRepository.getInvoiceById(businessId, invoiceId);
    if (!invoice) {
      throw new Error("Comprobante no encontrado.");
    }
    if (!['PENDING', 'REJECTED'].includes(invoice.status)) {
      throw new Error(`El comprobante ya está en estado ${invoice.status} y no puede re-emitirse.`);
    }

    const config = await FiscalRepository.getFiscalConfig(businessId);

    // Marcar como REQUESTED antes de llamar a ARCA
    await FiscalRepository.updateInvoiceStatus(invoice.id, 'REQUESTED', {});

    try {
      // Llamada real a ARCA usando el servicio WSFEV1
      const arcaRequest = {
        pointOfSale: invoice.pointOfSale,
        docType: invoice.docType,
        docNumber: invoice.docNumber,
        customerName: invoice.customerName || undefined,
        customerIva: invoice.customerIva || undefined,
        items: invoice.items.map((it: any) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          vatRate: Number(it.vatRate),
        })),
      };

      // Forzar modo automático para la re-emisión
      const result = await ArcaService.createVoucher(businessId, arcaRequest, invoice.saleId || undefined, false);

      // Actualizar el comprobante original con el CAE obtenido
      const updated = await FiscalRepository.updateInvoiceStatus(invoice.id, result.status, {
        cae: result.cae || undefined,
        caeExpiration: result.caeExpiration || undefined,
        errorMessage: result.status !== 'AUTHORIZED' ? (result as any).errorMessage : undefined,
        rawResponse: (result as any).rawResponse,
      });

      // Si ARCA generó un nuevo comprobante duplicado, cancelarlo
      if (result.id !== invoice.id) {
        await FiscalRepository.updateInvoiceStatus(result.id, 'CANCELLED', {
          errorMessage: 'Comprobante duplicado cancelado — CAE transferido al original',
        });
      }

      // Auditoría
      await prisma.activityLog.create({
        data: {
          businessId,
          entityName: 'ElectronicInvoice',
          entityId: updated.id,
          actionType: updated.status === 'AUTHORIZED' ? 'INVOICE_EMITTED' : 'INVOICE_REJECTED',
          previousValues: JSON.stringify({ status: invoice.status }),
          newValues: JSON.stringify({ status: updated.status, cae: updated.cae }),
        },
      });

      return updated;
    } catch (err: any) {
      await FiscalRepository.updateInvoiceStatus(invoice.id, 'REJECTED', {
        errorMessage: err.message || 'Error al solicitar CAE a ARCA',
      });

      await FiscalRepository.logFiscalError(businessId, {
        invoiceId: invoice.id,
        saleId: invoice.saleId || undefined,
        errorCode: 'MANUAL_CAE_REJECTED',
        message: err.message || 'Error al solicitar CAE en modo manual',
      });

      throw err;
    }
  }

  /**
   * Emite Nota de Crédito A/B/C
   */
  static async createCreditNote(businessId: string, invoiceId: string, reason: string) {
    const nc = await ArcaService.createCreditNote(businessId, invoiceId, reason);

    // Auditoría
    await prisma.activityLog.create({
      data: {
        businessId,
        entityName: 'ElectronicInvoice',
        entityId: nc.id,
        actionType: 'INVOICE_CANCELLED',
        previousValues: '{}',
        newValues: JSON.stringify({ fullNumber: nc.fullNumber, cae: nc.cae, reason }),
      },
    });

    return nc;
  }

  /**
   * Probar conexión con servidores de AFIP/ARCA
   */
  static async testConnection(businessId: string) {
    const { ArcaAuthService } = await import('./arca-auth.service');
    const result = await ArcaAuthService.testConnection(businessId);
    return result;
  }

  /**
   * Consultar errores ARCA registrados
   */
  static async getErrorLogs(businessId: string, limit: number = 50) {
    return FiscalRepository.getErrorLogs(businessId, limit);
  }

  /**
   * Reporte fiscal y logs de error
   */
  static async getFiscalReport(businessId: string, params: any) {
    const result = await FiscalRepository.getInvoices(businessId, {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: 1,
      limit: 1000,
    });

    const errorLogs = await FiscalRepository.getErrorLogs(businessId, 50);

    const summary = {
      totalEmitted: result.items.length,
      totalAmount: result.items.reduce((sum, inv) => sum + Number(inv.totalAmount), 0),
      totalVat: result.items.reduce((sum, inv) => sum + Number(inv.vatAmount), 0),
      facturasAuthorized: result.items.filter(inv => inv.status === 'AUTHORIZED').length,
      facturasPending: result.items.filter(inv => inv.status === 'PENDING').length,
      facturasRejected: result.items.filter(inv => inv.status === 'REJECTED').length,
      notasCredito: result.items.filter(inv => inv.voucherType.includes('NOTA_CREDITO')).length,
    };

    return {
      summary,
      items: result.items,
      errorLogs,
    };
  }
}
