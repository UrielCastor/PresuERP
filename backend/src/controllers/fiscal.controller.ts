import { Request, Response } from 'express';
import { FiscalService } from '../services/fiscal.service';

export class FiscalController {
  static async getConfig(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const config = await FiscalService.getConfig(businessId);
      return res.json({ success: true, data: config });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateConfig(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const updated = await FiscalService.updateConfig(businessId, req.body);
      return res.json({ success: true, message: "Configuración fiscal actualizada", data: updated });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async uploadCertificate(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      // req.body puede incluir: { name, content, privateKeyContent }
      const result = await FiscalService.uploadCertificate(businessId, req.body);
      return res.json({ success: true, message: "Certificado cifrado y registrado correctamente", data: result });
    } catch (error: any) {
      // Certificado inválido → 400 Bad Request con mensaje descriptivo
      const isValidationError = error.message?.startsWith('Certificado inválido');
      return res.status(isValidationError ? 400 : 500).json({ success: false, message: error.message });
    }
  }

  static async getPointsOfSale(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const posList = await FiscalService.getPointsOfSale(businessId);
      return res.json({ success: true, data: posList });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createPointOfSale(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const created = await FiscalService.createPointOfSale(businessId, req.body);
      return res.status(201).json({ success: true, message: "Punto de venta creado", data: created });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updatePointOfSale(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const { id } = req.params;
      await FiscalService.updatePointOfSale(businessId, id, req.body);
      return res.json({ success: true, message: "Punto de venta actualizado" });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deletePointOfSale(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const { id } = req.params;
      await FiscalService.deletePointOfSale(businessId, id);
      return res.json({ success: true, message: "Punto de venta eliminado" });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getInvoices(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const result = await FiscalService.getInvoices(businessId, req.query);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getInvoiceById(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const { id } = req.params;
      const invoice = await FiscalService.getInvoiceById(businessId, id);
      if (!invoice) {
        return res.status(404).json({ success: false, message: "Comprobante no encontrado" });
      }
      return res.json({ success: true, data: invoice });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async emitInvoiceForSale(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const { saleId } = req.params;
      const invoice = await FiscalService.emitInvoiceForSale(businessId, saleId);
      return res.json({ success: true, message: "Comprobante fiscal procesado", data: invoice });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async requestCaeForPendingInvoice(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const { id } = req.params;
      const invoice = await FiscalService.requestCaeForPendingInvoice(businessId, id);
      return res.json({ success: true, message: "Factura autorizada por ARCA con éxito", data: invoice });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async createCreditNote(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const { id } = req.params;
      const { reason } = req.body;
      const nc = await FiscalService.createCreditNote(businessId, id, reason || 'Anulación de venta');
      return res.json({ success: true, message: "Nota de crédito autorizada por ARCA", data: nc });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async testConnection(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const result = await FiscalService.testConnection(businessId);
      return res.json({
        success: true,
        message: result.isRealAfipToken
          ? "Conexión con AFIP WSAA exitosa — Token real obtenido ✅"
          : result.hasCertificate
          ? "Certificado cargado — Modo offline (instalar node-forge para firma CMS real)"
          : "Módulo activo en modo offline — Sin certificado ARCA cargado",
        data: {
          connected: result.connected,
          token: result.token,
          sign: result.sign,
          environment: result.environment,
          isRealAfipToken: result.isRealAfipToken,
          hasCertificate: result.hasCertificate,
          certificateName: result.certificateName,
          certificateExpiration: result.certificateExpiration,
          diagnosticStatus: result.diagnosticStatus,
          error: result.error,
        },
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getErrorLogs(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const logs = await FiscalService.getErrorLogs(businessId, 50);
      return res.json({ success: true, data: logs });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getFiscalReport(req: Request, res: Response) {
    try {
      const businessId = (req as any).user.businessId;
      const report = await FiscalService.getFiscalReport(businessId, req.query);
      return res.json({ success: true, data: report });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
