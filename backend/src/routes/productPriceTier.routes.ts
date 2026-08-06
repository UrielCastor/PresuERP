import { Router } from 'express';
import { productPriceTierController } from '../controllers/productPriceTier.controller';
import { requireAuth, requireAnyPermission } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();

router.use(requireAuth);
router.use(requireActiveSubscription);

const canManagePriceTiers = requireAnyPermission(['settings:pos:write', 'users:write']);

router.get('/', productPriceTierController.getAll);
router.get('/:id', productPriceTierController.getById);
router.post('/', canManagePriceTiers, productPriceTierController.create);
router.put('/:id', canManagePriceTiers, productPriceTierController.update);
router.delete('/:id', canManagePriceTiers, productPriceTierController.delete);

export default router;

