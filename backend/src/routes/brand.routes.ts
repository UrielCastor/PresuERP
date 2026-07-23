import { Router } from 'express';
import { BrandController } from '../controllers/brand.controller';
import { requirePermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createBrandSchema, updateBrandSchema } from '../validators/brand.validator';

const router = Router();

router.get('/', requirePermission('products:read'), BrandController.list);
router.get('/:id', requirePermission('products:read'), BrandController.findById);
router.post('/', requirePermission('products:write'), validate(createBrandSchema), BrandController.create);
router.put('/:id', requirePermission('products:write'), validate(updateBrandSchema), BrandController.update);
router.delete('/:id', requirePermission('products:write'), BrandController.delete);

export default router;
