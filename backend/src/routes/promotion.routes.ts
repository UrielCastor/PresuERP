import { Router } from 'express';
import { promotionController } from '../controllers/promotion.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

const router = Router();

router.use(requireAuth);
router.use(requireActiveSubscription);

router.get('/', promotionController.getAll);
router.get('/:id', promotionController.getById);
router.post('/', promotionController.create);
router.put('/:id', promotionController.update);
router.delete('/:id', promotionController.delete);

export default router;
