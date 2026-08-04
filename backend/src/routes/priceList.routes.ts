import { Router } from 'express';
import { PriceListController } from '../controllers/priceList.controller';
import { requireAuth, requireRole } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();
const controller = new PriceListController();

router.use(requireAuth);
router.use(requireActiveSubscription);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', requireRole(['Administrator', 'Supervisor']), controller.create);
router.put('/:id', requireRole(['Administrator', 'Supervisor']), controller.update);
router.delete('/:id', requireRole(['Administrator', 'Supervisor']), controller.delete);

// Items management inside a PriceList
router.post('/:id/items', requireRole(['Administrator', 'Supervisor']), controller.addItem);
router.put('/:id/items/:itemId', requireRole(['Administrator', 'Supervisor']), controller.updateItem);
router.delete('/:id/items/:itemId', requireRole(['Administrator', 'Supervisor']), controller.deleteItem);

export default router;
