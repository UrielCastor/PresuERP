import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { StockController } from '../controllers/stock.controller';
import { requirePermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createProductSchema, updateProductSchema } from '../validators/product.validator';
import { checkPlanLimit } from '../middlewares/planLimit.middleware';

const router = Router();

// Static routes FIRST before parameterized /:id routes
router.get('/export', requirePermission('products:read'), ProductController.exportProducts);
router.get('/import/history', requirePermission('products:read'), ProductController.getImportHistory);
router.post('/import', requirePermission('products:create'), checkPlanLimit('products'), ProductController.importProducts);

// Root & Parameterized routes
router.get('/', requirePermission('products:read'), ProductController.list);
router.get('/:id', requirePermission('products:read'), ProductController.findById);
router.get('/:id/stocks', requirePermission('stocks:read'), StockController.listByProduct);

router.post('/', requirePermission('products:create'), checkPlanLimit('products'), validate(createProductSchema), ProductController.create);
router.put('/:id', requirePermission('products:update'), validate(updateProductSchema), ProductController.update);
router.delete('/:id', requirePermission('products:delete'), ProductController.delete);

export default router;
