import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';
import { ProductPriceUpdateController } from '../controllers/productPriceUpdate.controller';

const router = Router();
const controller = new ProductPriceUpdateController();

router.use(requireAuth);
router.use(requireActiveSubscription);

router.post('/preview', controller.preview);
router.post('/apply', controller.apply);
router.post('/bulk-custom', controller.applyCustom);
router.get('/history', controller.getHistory);

export default router;
