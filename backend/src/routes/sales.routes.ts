import { Router } from 'express';
import { SaleController } from '../controllers/sale.controller';
import { PointsController } from '../controllers/points.controller';
import { validate } from '../middlewares/validation.middleware';
import { createSaleSchema, getSalesSchema, updateSaleSchema } from '../validators/sale.validator';
import { previewPointsRedemptionSchema, previewPointsEarnSchema } from '../validators/points.validator';
import { requirePermission } from '../middlewares/auth.middleware';

const router = Router();

router.get(
  '/',
  requirePermission('sales:read'),
  validate(getSalesSchema),
  SaleController.list
);

router.get(
  '/:id',
  requirePermission('sales:read'),
  SaleController.findById
);

router.post(
  '/',
  requirePermission('sales:write'),
  validate(createSaleSchema),
  SaleController.create
);

router.post(
  '/:id/cancel',
  requirePermission('sales:cancel'),
  SaleController.cancel
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

export default router;
