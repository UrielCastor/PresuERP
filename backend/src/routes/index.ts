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
import { BusinessIntegrationController } from '../controllers/business-integration.controller';
import { requireAuth } from '../middlewares/auth.middleware';

console.log('🔥 routes/index.ts cargado');

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Authentication endpoints
router.use('/auth', authRoutes);

// System SaaS endpoints (Strict SUPER_ADMIN)
router.use('/system', systemRoutes);

// Public business webhook (no authentication required)
router.post('/business/integrations/mercado-pago/webhook', new BusinessIntegrationController().webhook);

// Protected module routes
router.use('/business/integrations', requireAuth, businessIntegrationRoutes);
router.use('/businesses', requireAuth, businessRoutes);
router.use('/settings', requireAuth, settingsRoutes);

router.use('/users', requireAuth, userRoutes);

router.use('/roles', requireAuth, rolesRoutes);

router.use('/categories', requireAuth, categoryRoutes);

router.use('/suppliers', requireAuth, supplierRoutes);

router.use('/products', requireAuth, productRoutes);

router.use('/sales', requireAuth, salesRoutes);

router.use('/customers', requireAuth, customerRoutes);

router.use('/warehouses', requireAuth, warehouseRoutes);

router.use('/stocks', requireAuth, stockRoutes);

router.use('/kardex', requireAuth, stockMovementRoutes);

router.use('/purchases', requireAuth, purchaseRoutes);

router.use('/transfers', requireAuth, warehouseTransferRoutes);

router.use('/pos', requireAuth, posRoutes);

router.use('/dashboard', requireAuth, dashboardRoutes);

router.use('/cash', requireAuth, cashRoutes);

router.use('/payment-adjustment-rules', requireAuth, paymentAdjustmentRuleRoutes);

export default router;
