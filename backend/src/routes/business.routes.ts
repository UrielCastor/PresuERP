import { Router } from 'express';
import { BusinessController } from '../controllers/business.controller';
import { requireAuth, requireSystemAdmin } from '../middlewares/auth.middleware';
import { PlanController } from '../system/plan.controller';
import { BillingController } from '../system/billing.controller';

const router = Router();
const controller = new BusinessController();
const planController = new PlanController();
const billingController = new BillingController();

router.use(requireAuth);

// Módulo 1 (Tenant Normal) - Sólo su propia empresa
router.get('/current', controller.getCurrent);
router.put('/current', controller.updateCurrent);
router.get('/subscription', controller.getSubscription);

// Tenant-accessible SaaS plan and checkout endpoints
router.get('/plans', planController.getAll);
router.post('/payments/create-preference', billingController.createPreference);

// Módulo 2 y General (SaaS Admin y/o Tenant normal consultando uso)
router.get('/:id/usage', controller.getUsageMetrics);

// Módulo 3 (Sólo SaaS Admin)
router.patch('/:id/suspend', requireSystemAdmin, controller.suspend);
router.patch('/:id/activate', requireSystemAdmin, controller.activate);
router.delete('/:id', requireSystemAdmin, controller.delete);

export default router;
