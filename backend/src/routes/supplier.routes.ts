import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller';
import { requirePermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createSupplierSchema, updateSupplierSchema } from '../validators/supplier.validator';
import { checkPlanLimit } from '../middlewares/planLimit.middleware';

const router = Router();

router.get('/', requirePermission('suppliers:read'), SupplierController.list);
router.get('/:id', requirePermission('suppliers:read'), SupplierController.findById);
router.post('/', requirePermission('suppliers:create'), checkPlanLimit('suppliers'), validate(createSupplierSchema), SupplierController.create);
router.put('/:id', requirePermission('suppliers:update'), validate(updateSupplierSchema), SupplierController.update);
router.delete('/:id', requirePermission('suppliers:delete'), SupplierController.delete);

export default router;
