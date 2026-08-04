import { Router } from 'express';
import { BusinessIntegrationController } from '../controllers/business-integration.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';

const router = Router();
const controller = new BusinessIntegrationController();

// 1. Webhook endpoint MUST BE PUBLIC (No authentication middleware / No JWT required)
router.post('/mercado-pago/webhook', controller.webhook);

// 2. Integration management endpoints require authentication
router.use(requireAuth);

router.get('/', requirePermission('settings:write'), controller.getIntegrations);
router.put('/mercado-pago', requirePermission('settings:write'), controller.saveMercadoPago);
router.post('/mercado-pago/test', requirePermission('settings:write'), controller.testMercadoPago);
router.post('/mercado-pago/create-preference', controller.createSalePreference);
router.post('/mercado-pago/create-qr', controller.createQrOrder);
router.get('/mercado-pago/payment-status/:saleId', controller.getPaymentStatus);

export default router;

