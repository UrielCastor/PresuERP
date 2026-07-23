import { Router } from 'express';
import { SettingsController } from '../controllers/settings.controller';
import { requirePermission } from '../middlewares/auth.middleware';

const router = Router();

// Retrieve all settings for the tenant
router.get('/', SettingsController.getSettings);

// Update general business info
router.put('/business', requirePermission('settings:write'), SettingsController.updateBusiness);

// Update interface preferences
router.put('/preferences', requirePermission('settings:write'), SettingsController.updateBusinessSettings);

// Update fiscal parameters
router.put('/fiscal', requirePermission('settings:write'), SettingsController.updateFiscalSettings);

// Update POS settings
router.put('/pos', requirePermission('settings:write'), SettingsController.updatePOSSettings);

// Update thermal / laser printing configurations
router.put('/print', requirePermission('settings:write'), SettingsController.updatePrintSettings);

// Update email SMTP credentials
router.put('/email', requirePermission('settings:write'), SettingsController.updateEmailSettings);

// Update next document counters
router.put('/numbers', requirePermission('settings:write'), SettingsController.updateNumberSettings);

export default router;
