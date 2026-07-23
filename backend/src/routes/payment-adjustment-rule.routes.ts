import { Router } from 'express';
import { PaymentAdjustmentRuleController } from '../controllers/payment-adjustment-rule.controller';

console.log('🔥 payment-adjustment-rule.routes.ts cargado');

const router = Router();
const controller = new PaymentAdjustmentRuleController();

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

export default router;
