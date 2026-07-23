import { Router } from 'express';
import { WarehouseTransferController } from '../controllers/warehouseTransfer.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('stocks:read'), WarehouseTransferController.list);
router.get('/:id', requirePermission('stocks:read'), WarehouseTransferController.findById);
router.post('/', requirePermission('stocks:update'), WarehouseTransferController.create);
router.put('/:id/status', requirePermission('stocks:update'), WarehouseTransferController.updateStatus);

export default router;
