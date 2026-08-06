import { Router } from 'express';
import { requireAuth, requireCapability } from '../middlewares/auth.middleware';
import { UserPermissionsAuditController } from '../controllers/userPermissionsAudit.controller';

const router = Router();
const controller = new UserPermissionsAuditController();

router.use(requireAuth);

router.get('/:id/security-summary', requireCapability('audit.view'), (req, res, next) => controller.getSecuritySummary(req, res, next));
router.get('/:id/capabilities', requireCapability('audit.view'), (req, res, next) => controller.getUserCapabilities(req, res, next));
router.get('/:id/effective-permissions', requireCapability('audit.view'), (req, res, next) => controller.getEffectivePermissions(req, res, next));

export default router;
