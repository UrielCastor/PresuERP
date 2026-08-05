import { Router } from 'express';
import { PointsController } from '../controllers/points.controller';
import { requireAuth, requireAnyPermission } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { 
  updatePointsSettingsSchema, 
  adjustPointsSchema, 
  getPointsHistorySchema, 
  getPointsReportSchema 
} from '../validators/points.validator';

const router = Router();

router.use(requireAuth);

// Get points settings for the business
router.get(
  '/settings',
  requireAnyPermission(['customerPoints:read', 'points:read']),
  PointsController.getSettings
);

// Update points settings for the business
router.put(
  '/settings',
  requireAnyPermission(['customerPoints:settings', 'points:write']),
  validate(updatePointsSettingsSchema),
  PointsController.updateSettings
);

// Get customer points balance
router.get(
  '/customers/:customerId/balance',
  requireAnyPermission(['customerPoints:read', 'points:read']),
  PointsController.getCustomerPoints
);

// Get points history
router.get(
  '/history',
  requireAnyPermission(['customerPoints:read', 'points:read']),
  validate(getPointsHistorySchema),
  PointsController.getPointsHistory
);

// Manually adjust customer points
router.post(
  '/adjust',
  requireAnyPermission(['customerPoints:adjust', 'points:write']),
  validate(adjustPointsSchema),
  PointsController.adjustPoints
);

// Get loyalty program dashboard KPIs
router.get(
  '/reports/dashboard',
  requireAnyPermission(['customerPoints:reports', 'points:read']),
  PointsController.getLoyaltyDashboard
);

// Get points report history with advanced filters
router.get(
  '/reports/history',
  requireAnyPermission(['customerPoints:reports', 'points:read']),
  validate(getPointsReportSchema),
  PointsController.getPointsHistory
);

// Export points history to CSV
router.get(
  '/reports/export',
  requireAnyPermission(['customerPoints:reports', 'points:read']),
  validate(getPointsReportSchema),
  PointsController.exportHistory
);

export default router;
