import { Router } from 'express';
import { SaleController } from '../controllers/sale.controller';
import { validate } from '../middlewares/validation.middleware';
import { createSaleSchema, getSalesSchema, updateSaleSchema } from '../validators/sale.validator';
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
  requirePermission('sales:create'),
  validate(createSaleSchema),
  SaleController.create
);

router.post(
  '/:id/cancel',
  requirePermission('sales:cancel'),
  SaleController.cancel
);

export default router;
