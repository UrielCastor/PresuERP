import { Router } from 'express';
import { CapabilityController } from '../controllers/capability.controller';
import { requireAuth, requireAnyPermission } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

const canManageRoles = requireAnyPermission(['users:write', 'roles:manage', 'users:read']);

router.get('/system/capabilities', canManageRoles, CapabilityController.getGroupedCapabilities);
router.post('/roles/custom', canManageRoles, CapabilityController.createCustomRole);
router.patch('/roles/:id', canManageRoles, CapabilityController.updateRole);
router.delete('/roles/:id', canManageRoles, CapabilityController.deleteRole);
router.get('/roles/:id/capabilities', canManageRoles, CapabilityController.getRoleCapabilities);
router.put('/roles/:id/capabilities', canManageRoles, CapabilityController.updateRoleCapabilities);
router.get('/roles/:id/capabilities/history', canManageRoles, CapabilityController.getRoleCapabilityHistory);

export default router;

