import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { validate } from '../middlewares/validation.middleware';
import { requirePermission } from '../middlewares/auth.middleware';
import { createUserSchema, updateUserSchema } from '../validators/user.validator';

const router = Router();

router.get('/', requirePermission('users:read'), UserController.list);
router.get('/:id', requirePermission('users:read'), UserController.findById);
router.post('/', requirePermission('users:write'), validate(createUserSchema), UserController.create);
router.put('/:id', requirePermission('users:write'), validate(updateUserSchema), UserController.update);
router.delete('/:id', requirePermission('users:delete'), UserController.delete);

export default router;
