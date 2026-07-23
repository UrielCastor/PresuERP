import { Router } from 'express';
import { BusinessIntegrationController } from '../controllers/business-integration.controller';

const router = Router();
const controller = new BusinessIntegrationController();

router.get('/', controller.getIntegrations);
router.put('/mercado-pago', controller.saveMercadoPago);
router.post('/mercado-pago/test', controller.testMercadoPago);
router.post('/mercado-pago/create-preference', controller.createSalePreference);
router.post('/mercado-pago/create-qr', controller.createQrOrder);
router.get('/mercado-pago/payment-status/:saleId', controller.getPaymentStatus);

export default router;
