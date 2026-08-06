import { Router } from 'express';
import { LogisticsController } from '../controllers/logistics.controller';
import { requireAuth, requireAnyPermission } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

const canReadLogistics = requireAnyPermission([
  'transferRequests:read',
  'logistics:read',
  'stocks:read',
  'warehouseTransfers:read',
]);

// Search products for logistics requests (minimal identifying info, no costs/prices)
router.get('/products/search', canReadLogistics, LogisticsController.searchProducts);

// Inter-warehouse product availability query
router.get('/product-availability', canReadLogistics, LogisticsController.getProductAvailability);
router.get('/products/:productId/availability', canReadLogistics, LogisticsController.getProductAvailability);

export default router;
