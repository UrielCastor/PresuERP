import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { StockController } from '../controllers/stock.controller';
import { requirePermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createProductSchema, updateProductSchema } from '../validators/product.validator';

const router = Router();

router.get('/', requirePermission('products:read'), ProductController.list);
router.get('/:id', requirePermission('products:read'), ProductController.findById);
router.get('/:id/stocks', requirePermission('stocks:read'), StockController.listByProduct);
router.post('/', requirePermission('products:create'), validate(createProductSchema), ProductController.create);
router.put('/:id', requirePermission('products:update'), validate(updateProductSchema), ProductController.update);
router.delete('/:id', requirePermission('products:delete'), ProductController.delete);

export default router;
