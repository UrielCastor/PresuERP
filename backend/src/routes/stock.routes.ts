import { Router } from 'express';
import { StockController } from '../controllers/stock.controller';
import { requirePermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { updateStockSchema } from '../validators/stock.validator';

const router = Router();

router.get('/', requirePermission('stocks:read'), StockController.list);
router.get('/:id', requirePermission('stocks:read'), StockController.findById);
router.put('/:id', requirePermission('stocks:update'), validate(updateStockSchema as any), StockController.update);

// Direct mapping subroutes
router.get('/warehouse/:id', requirePermission('stocks:read'), StockController.listByWarehouse);
router.get('/product/:id', requirePermission('stocks:read'), StockController.listByProduct);

export default router;
