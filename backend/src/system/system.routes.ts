import { Router } from 'express';
import { requireAuth, requireSystemAdmin } from '../middlewares/auth.middleware';
import { SystemController } from './system.controller';
import { BusinessController } from '../controllers/business.controller'; // Reusing business controller for SaaS endpoints
import { SubscriptionController } from './subscription.controller';
import { BillingController } from './billing.controller';
import { AuditController } from './audit.controller';
import { StaffController } from './staff.controller';
import { PlanController } from './plan.controller';
import { CouponController } from './coupon.controller';
import systemPaymentRoutes from './system.payment.routes';

const router = Router();
const billingController = new BillingController();

// Public webhook route (Mercado Pago callbacks)
router.post('/payments/webhook', billingController.webhook);

// Protect ALL other routes with Staff/SuperAdmin validation (isStaff === true)
router.use(requireAuth);
router.use(requireSystemAdmin);

const systemController = new SystemController();
const businessController = new BusinessController();
const staffController = new StaffController();
const subscriptionController = new SubscriptionController();
const auditController = new AuditController();
const planController = new PlanController();
const couponController = new CouponController();

// Dashboard
router.get('/dashboard', systemController.getDashboardMetrics);

// Businesses
router.get('/businesses', businessController.getAll);
router.get('/businesses/:id/overview', systemController.getBusinessOverview);
router.get('/businesses/:id/validate-delete', businessController.validateDelete);
router.get('/businesses/:id', businessController.getById);
router.get('/businesses/:id/usage', businessController.getUsageMetrics);
router.patch('/businesses/:id/suspend', businessController.suspend);
router.patch('/businesses/:id/activate', businessController.activate);
router.patch('/businesses/:id/restore', businessController.restore);
router.delete('/businesses/:id', businessController.delete);
router.patch('/businesses/:id/plan', planController.changeBusinessPlan); // Requires PlanController

// Plans
router.get('/plans', planController.getAll);
router.post('/plans', planController.create);
router.put('/plans/:id', planController.update);
router.post('/plans/:id/duplicate', planController.duplicate);
router.delete('/plans/:id', planController.deletePlan);
router.patch('/plans/:id/status', planController.changeStatus);

// Plan Prices
router.post('/plans/:planId/prices', planController.createPrice);
router.put('/plans/prices/:priceId', planController.updatePrice);
router.patch('/plans/prices/:priceId/status', planController.changePriceStatus);
router.delete('/plans/prices/:priceId', planController.deletePrice);

// Coupons (SaaS)
router.get('/coupons', couponController.getAll);
router.post('/coupons', couponController.create);
router.put('/coupons/:id', couponController.update);
router.delete('/coupons/:id', couponController.delete);

// Staff Management
router.post('/staff/:id/promote', staffController.promoteToStaff);
router.post('/staff/:id/demote', staffController.demoteFromStaff);

// User Management (SaaS)
router.get('/users', systemController.listUsers);
router.get('/users/:id', systemController.getUserDetails);
router.patch('/users/:id/status', systemController.updateUserStatus);
router.delete('/users/:id', systemController.deleteUser);

// Subscriptions
router.get('/subscriptions', subscriptionController.getAll);
router.get('/subscriptions/:id', subscriptionController.getById);
router.post('/subscriptions', subscriptionController.create);
router.put('/subscriptions/:id', subscriptionController.update);
router.patch('/subscriptions/:id/cancel', subscriptionController.cancel);
router.patch('/subscriptions/:id/renew', subscriptionController.renew);
router.patch('/subscriptions/:id/change-plan', subscriptionController.changePlan);

// Billing & Payments
router.get('/payments/config', billingController.getConfig);
router.post('/payments/config', billingController.saveConfig);
router.post('/payments/create-preference', billingController.createPreference);
router.use('/payments', systemPaymentRoutes);

// Audit
router.get('/audit', auditController.getLogs);
router.get('/audit/stats', auditController.getStats);

// Mercado Pago Webhooks Audit
router.get('/webhooks/mercado-pago', systemController.getMercadoPagoWebhookLogs);

export default router;
