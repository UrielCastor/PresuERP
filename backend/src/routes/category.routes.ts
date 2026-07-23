import { Router } from 'express';
import { CategoryController } from '../controllers/category.controller';
import { requirePermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator';

const router = Router();

router.get('/', requirePermission('categories:read'), CategoryController.list);
router.get('/:id', requirePermission('categories:read'), CategoryController.findById);
router.post('/', requirePermission('categories:create'), validate(createCategorySchema), CategoryController.create);
router.put('/:id', requirePermission('categories:update'), validate(updateCategorySchema), CategoryController.update);
router.delete('/:id', requirePermission('categories:delete'), CategoryController.delete);

export default router;
