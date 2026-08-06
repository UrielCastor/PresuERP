import { Router } from 'express';
import { PriceListController } from '../controllers/priceList.controller';
import { requireAuth, requireAnyPermission } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();
const controller = new PriceListController();

router.use(requireAuth);
router.use(requireActiveSubscription);

const canManagePriceLists = requireAnyPermission(['settings:pos:write', 'users:write']);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', canManagePriceLists, controller.create);
router.put('/:id', canManagePriceLists, controller.update);
router.delete('/:id', canManagePriceLists, controller.delete);

// Items management inside a PriceList
router.post('/:id/items', canManagePriceLists, controller.addItem);
router.put('/:id/items/:itemId', canManagePriceLists, controller.updateItem);
router.delete('/:id/items/:itemId', canManagePriceLists, controller.deleteItem);

export default router;

