import { Router } from 'express';
import authRoutes from './auth.routes';
import businessRoutes from './business.routes';
import settingsRoutes from './settings.routes';
import userRoutes from './user.routes';
import rolesRoutes from './roles.routes';
import categoryRoutes from './category.routes';
import supplierRoutes from './supplier.routes';
import productRoutes from './product.routes';
import salesRoutes from './sales.routes';
import warehouseRoutes from './warehouse.routes';
import stockRoutes from './stock.routes';
import stockMovementRoutes from './stockMovement.routes';
import purchaseRoutes from './purchase.routes';
import warehouseTransferRoutes from './warehouseTransfer.routes';
import posRoutes from './pos.routes';
import dashboardRoutes from './dashboard.routes';
import cashRoutes from './cash.routes';
import reportRoutes from './report.routes';
import systemRoutes from '../system/system.routes';
import businessIntegrationRoutes from './business-integration.routes';
import paymentAdjustmentRuleRoutes from './payment-adjustment-rule.routes';
import customerRoutes from './customer.routes';
import fiscalRoutes from './fiscal.routes';
import priceListRoutes from './priceList.routes';
import productPriceTierRoutes from './productPriceTier.routes';
import promotionRoutes from './promotion.routes';
import productPriceUpdateRoutes from './productPriceUpdate.routes';
import pointsRoutes from './points.routes';
import logisticsRoutes from './logistics.routes';
import capabilityRoutes from './capability.routes';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';

console.log('🔥 routes/index.ts cargado - product-price-updates active');

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Authentication endpoints
router.use('/auth', authRoutes);

// System SaaS endpoints (Strict SUPER_ADMIN)
router.use('/system', systemRoutes);

// Integration module routes (Webhook is public inside businessIntegrationRoutes, rest is protected)
router.use('/business/integrations', businessIntegrationRoutes);
router.use('/businesses', requireAuth, businessRoutes);
router.use('/settings', requireAuth, settingsRoutes);

import userPermissionsAuditRoutes from './userPermissionsAudit.routes';

router.use('/users', requireAuth, requireActiveSubscription, userPermissionsAuditRoutes);
router.use('/users', requireAuth, requireActiveSubscription, userRoutes);

router.use('/roles', requireAuth, requireActiveSubscription, rolesRoutes);

router.use('/categories', requireAuth, requireActiveSubscription, categoryRoutes);

router.use('/suppliers', requireAuth, requireActiveSubscription, supplierRoutes);

router.use('/products', requireAuth, requireActiveSubscription, productRoutes);

router.use('/sales', requireAuth, requireActiveSubscription, salesRoutes);

router.use('/customers', requireAuth, requireActiveSubscription, customerRoutes);

router.use('/warehouses', requireAuth, requireActiveSubscription, warehouseRoutes);

router.use('/stocks', requireAuth, requireActiveSubscription, stockRoutes);

router.use('/kardex', requireAuth, requireActiveSubscription, stockMovementRoutes);

router.use('/purchases', requireAuth, requireActiveSubscription, purchaseRoutes);

router.use('/transfers', requireAuth, requireActiveSubscription, warehouseTransferRoutes);

router.use('/pos', requireAuth, requireActiveSubscription, posRoutes);

router.use('/dashboard', requireAuth, requireActiveSubscription, dashboardRoutes);

router.use('/cash', requireAuth, requireActiveSubscription, cashRoutes);

router.use('/payment-adjustment-rules', requireAuth, requireActiveSubscription, paymentAdjustmentRuleRoutes);

router.use('/product-price-tiers', productPriceTierRoutes);

router.use('/promotions', promotionRoutes);
router.use('/product-price-updates', productPriceUpdateRoutes);
router.use('/points', requireAuth, requireActiveSubscription, pointsRoutes);
router.use('/logistics', requireAuth, requireActiveSubscription, logisticsRoutes);

router.use('/reports', requireAuth, requireActiveSubscription, reportRoutes);

router.use('/fiscal', requireAuth, requireActiveSubscription, fiscalRoutes);

router.use('/price-lists', priceListRoutes);
router.use('/', requireAuth, requireActiveSubscription, capabilityRoutes);

export default router;
