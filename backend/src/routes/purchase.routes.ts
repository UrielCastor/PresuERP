import { Router } from 'express';
import { PurchaseController } from '../controllers/purchase.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('purchases:read'), PurchaseController.list);
router.get('/product/:productId/history', requirePermission('purchases:read'), PurchaseController.getProductPurchaseHistory);
router.get('/:id', requirePermission('purchases:read'), PurchaseController.findById);

router.post('/', requirePermission('purchases:create'), PurchaseController.create);
router.put('/:id', requirePermission('purchases:update'), PurchaseController.update);

router.post('/:id/submit-for-approval', requirePermission('purchases:update'), PurchaseController.submitForApproval);
router.post('/:id/reject', requirePermission('purchases:approve'), PurchaseController.reject);
router.post('/:id/approve', requirePermission('purchases:approve'), PurchaseController.approve);
router.post('/:id/receive', requirePermission('purchases:approve'), PurchaseController.receive);
router.post('/:id/cancel', requirePermission('purchases:cancel'), PurchaseController.cancel);

export default router;
