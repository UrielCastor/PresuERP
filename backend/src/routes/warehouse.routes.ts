import { Router } from 'express';
import { WarehouseController } from '../controllers/warehouse.controller';
import { StockController } from '../controllers/stock.controller';
import { requirePermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createWarehouseSchema, updateWarehouseSchema, deleteWarehouseSchema } from '../validators/warehouse.validator';
import { checkPlanLimit } from '../middlewares/planLimit.middleware';

const router = Router();

router.get('/', requirePermission('warehouses:read'), WarehouseController.list);
router.get('/:id', requirePermission('warehouses:read'), WarehouseController.findById);
router.get('/:id/stocks', requirePermission('stocks:read'), StockController.listByWarehouse);
router.post('/', requirePermission('warehouses:create'), checkPlanLimit('warehouses'), validate(createWarehouseSchema), WarehouseController.create);
router.put('/:id', requirePermission('warehouses:update'), validate(updateWarehouseSchema), WarehouseController.update);
router.delete('/:id', requirePermission('warehouses:delete'), validate(deleteWarehouseSchema), WarehouseController.delete);

export default router;
