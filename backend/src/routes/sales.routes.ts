import { Router } from 'express';
import { SaleController } from '../controllers/sale.controller';
import { PointsController } from '../controllers/points.controller';
import { validate } from '../middlewares/validation.middleware';
import { createSaleSchema, getSalesSchema, updateSaleSchema } from '../validators/sale.validator';
import { previewPointsRedemptionSchema, previewPointsEarnSchema } from '../validators/points.validator';
import { requirePermission } from '../middlewares/auth.middleware';

const router = Router();

// 1. Rutas Estáticas y Específicas PRIMERO
router.get(
  '/',
  requirePermission('sales:read'),
  validate(getSalesSchema),
  SaleController.list
);

router.get(
  '/suspended',
  requirePermission('sales:read'),
  SaleController.getSuspended
);

router.delete(
  '/suspended/:id',
  requirePermission('sales:write'),
  SaleController.deleteSuspended
);

router.get(
  '/returns/list',
  requirePermission('sales:read'),
  SaleController.getAllReturns
);

router.get(
  '/returns/:id',
  requirePermission('sales:read'),
  SaleController.getReturnById
);

router.post(
  '/',
  requirePermission('sales:write'),
  validate(createSaleSchema),
  SaleController.create
);

router.post(
  '/points/preview',
  requirePermission('sales:read'),
  validate(previewPointsRedemptionSchema),
  PointsController.previewRedemption
);

router.post(
  '/points/earn-preview',
  requirePermission('sales:read'),
  validate(previewPointsEarnSchema),
  PointsController.previewEarn
);

// 2. Rutas Parametrizadas (:id) DESPUÉS
router.get(
  '/:id',
  requirePermission('sales:read'),
  SaleController.findById
);

router.get(
  '/:id/returns',
  requirePermission('sales:read'),
  SaleController.getSaleReturns
);

router.post(
  '/:id/recover',
  requirePermission('sales:write'),
  SaleController.recoverSuspended
);

router.post(
  '/:id/refund',
  requirePermission('sales:write'),
  SaleController.processRefund
);

router.post(
  '/:id/returns',
  requirePermission('sales:write'),
  SaleController.processRefund
);

router.post(
  '/:id/cancel',
  requirePermission('sales:cancel'),
  SaleController.cancel
);

export default router;
