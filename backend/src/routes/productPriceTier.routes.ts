import { Router } from 'express';
import { productPriceTierController } from '../controllers/productPriceTier.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();

router.use(requireAuth);
router.use(requireActiveSubscription);

router.get('/', productPriceTierController.getAll);
router.get('/:id', productPriceTierController.getById);
router.post('/', requireRole(['Administrator', 'Supervisor']), productPriceTierController.create);
router.put('/:id', requireRole(['Administrator', 'Supervisor']), productPriceTierController.update);
router.delete('/:id', requireRole(['Administrator', 'Supervisor']), productPriceTierController.delete);

export default router;
