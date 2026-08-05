import { Router } from 'express';
import { CashController } from '../controllers/cash.controller';
import { requirePermission } from '../middlewares/auth.middleware';

const router = Router();

// Endpoints (All requiring valid authentication via main router mounting)
router.get('/registers', requirePermission('cash:view'), CashController.getRegisters);
router.get('/sessions', requirePermission('cash:view'), CashController.getSessions);
router.get('/active', requirePermission('cash:view'), CashController.getActive);
router.post('/open', requirePermission('cash:open'), CashController.open);
router.post('/close', requirePermission('cash:close'), CashController.close);
router.post('/movement', requirePermission('cash:movement'), CashController.movement);
router.get('/history', requirePermission('cash:audit'), CashController.getHistory);
router.get('/history/:id', requirePermission('cash:audit'), CashController.getById);

export default router;
