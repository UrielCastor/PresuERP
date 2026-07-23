import { Router } from 'express';
import { StockMovementController } from '../controllers/stockMovement.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';

const router = Router();
const controller = new StockMovementController();

router.use(requireAuth);

router.get('/', requirePermission('kardex:read'), controller.getAll);
router.get('/product/:id', requirePermission('kardex:read'), controller.getByProduct);
router.get('/warehouse/:id', requirePermission('kardex:read'), controller.getByWarehouse);
router.get('/:id', requirePermission('kardex:read'), controller.getOne);

// Central POST to register manual movements (ENTRY/EXIT/ADJUSTMENT/INVENTORY)
router.post('/', requirePermission('stocks:update'), controller.create);

export default router;
