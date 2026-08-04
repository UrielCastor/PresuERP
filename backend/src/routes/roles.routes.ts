import { Router } from 'express';
import { RoleRepository } from '../repositories/role.repository';
import { requirePermission } from '../middlewares/auth.middleware';

const router = Router();
const roleRepo = new RoleRepository();

router.get('/', requirePermission('users:read'), async (req: any, res: any, next: any) => {
  try {
    const roles = await roleRepo.list(req.user.businessId);
    return res.status(200).json({
      status: 'success',
      data: roles,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
