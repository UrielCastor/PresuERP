import { Router } from 'express';
import { FiscalController } from '../controllers/fiscal.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

// Configuración fiscal y certificados
router.get('/config', requirePermission('FISCAL_VIEW'), FiscalController.getConfig);
router.put('/config', requirePermission('FISCAL_EDIT'), FiscalController.updateConfig);
router.post('/certificates', requirePermission('FISCAL_CERTIFICATE_UPLOAD'), FiscalController.uploadCertificate);
router.post('/test-connection', requirePermission('FISCAL_VIEW'), FiscalController.testConnection);
router.get('/errors', requirePermission('FISCAL_VIEW'), FiscalController.getErrorLogs);

// ABM Puntos de Venta
router.get('/points-of-sale', requirePermission('FISCAL_VIEW'), FiscalController.getPointsOfSale);
router.post('/points-of-sale', requirePermission('FISCAL_EDIT'), FiscalController.createPointOfSale);
router.put('/points-of-sale/:id', requirePermission('FISCAL_EDIT'), FiscalController.updatePointOfSale);
router.delete('/points-of-sale/:id', requirePermission('FISCAL_EDIT'), FiscalController.deletePointOfSale);

// Comprobantes fiscales emitidos y facturación manual
router.get('/invoices', requirePermission('FISCAL_VIEW'), FiscalController.getInvoices);
router.get('/invoices/:id', requirePermission('FISCAL_VIEW'), FiscalController.getInvoiceById);
router.post('/invoices/emit-for-sale/:saleId', requirePermission('INVOICE_CREATE'), FiscalController.emitInvoiceForSale);
router.post('/invoices/:id/request-cae', requirePermission('INVOICE_CREATE'), FiscalController.requestCaeForPendingInvoice);
router.post('/invoices/:id/credit-note', requirePermission('INVOICE_CANCEL'), FiscalController.createCreditNote);

// Reporte fiscal
router.get('/reports', requirePermission('FISCAL_VIEW'), FiscalController.getFiscalReport);

export default router;
