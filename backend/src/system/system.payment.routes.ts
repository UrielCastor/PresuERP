import { Router } from 'express';
import { SystemPaymentController } from './system.payment.controller';

const router = Router();
const controller = new SystemPaymentController();

router.post('/test-config', controller.testConfig);

export default router;
