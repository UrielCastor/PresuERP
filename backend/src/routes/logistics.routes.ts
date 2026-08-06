import { Router } from 'express';
import { LogisticsController } from '../controllers/logistics.controller';
import { TransferRequestController } from '../controllers/transferRequest.controller';
import { StockTransferController } from '../controllers/stockTransfer.controller';
import { requireAuth, requireAnyPermission } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

const canReadLogistics = requireAnyPermission([
  'transfer_requests:read',
  'transferRequests:read',
  'transfers:read',
  'logistics:read',
  'stocks:read',
  'warehouseTransfers:read',
]);

const canCreateLogistics = requireAnyPermission([
  'transfer_requests:create',
  'transferRequests:create',
  'transfer_requests:send',
  'transfer_requests:write',
  'transferRequests:write',
  'logistics:write',
  'stocks:update',
  'stocks:read',
]);

const canUpdateLogistics = requireAnyPermission([
  'transfer_requests:update',
  'transferRequests:update',
  'transfer_requests:send',
  'transfer_requests:create',
  'transfer_requests:write',
  'transferRequests:write',
  'logistics:write',
  'stocks:update',
  'stocks:read',
]);

const canApproveLogistics = requireAnyPermission([
  'transfer_requests:approve',
  'transferRequests:approve',
]);

const canRejectLogistics = requireAnyPermission([
  'transfer_requests:reject',
  'transferRequests:reject',
]);

const canCreateTransfer = requireAnyPermission([
  'transfers:create',
  'transfer_requests:approve',
]);

const canPrepareTransfer = requireAnyPermission([
  'transfers:prepare',
  'warehouseTransfers:update',
  'logistics:write',
  'stocks:update',
]);

const canDispatchTransfer = requireAnyPermission([
  'transfers:dispatch',
]);

const canReceiveTransfer = requireAnyPermission([
  'transfers:receive',
  'warehouseTransfers:update',
  'logistics:write',
  'stocks:update',
]);

// 1. Search products for logistics requests (minimal identifying info, no costs/prices)
router.get('/products/search', canReadLogistics, LogisticsController.searchProducts);

// 2. Inter-warehouse product availability query
router.get('/product-availability', canReadLogistics, LogisticsController.getProductAvailability);
router.get('/products/:productId/availability', canReadLogistics, LogisticsController.getProductAvailability);

// 3. Transfer Requests CRUD & Workflow (Internal warehouse orders)
router.get('/transfer-requests', canReadLogistics, TransferRequestController.list);
router.get('/transfer-requests/:id', canReadLogistics, TransferRequestController.findById);
router.post('/transfer-requests', canCreateLogistics, TransferRequestController.create);
router.put('/transfer-requests/:id', canUpdateLogistics, TransferRequestController.update);
router.post('/transfer-requests/:id/send', canUpdateLogistics, TransferRequestController.sendForApproval);
router.post('/transfer-requests/:id/approve', canApproveLogistics, TransferRequestController.approve);
router.post('/transfer-requests/:id/reject', canRejectLogistics, TransferRequestController.reject);
router.post('/transfer-requests/:id/cancel', canUpdateLogistics, TransferRequestController.cancel);

// Create StockTransfer from approved TransferRequest
router.post('/transfer-requests/:id/create-transfer', canCreateTransfer, StockTransferController.createFromRequest);

// 4. Stock Transfers (Dispatches & Transfers)
router.get('/stock-transfers', canReadLogistics, StockTransferController.list);
router.get('/stock-transfers/:id', canReadLogistics, StockTransferController.findById);
router.post('/stock-transfers', canCreateTransfer, StockTransferController.createFromRequest);
router.post('/stock-transfers/:id/prepare', canPrepareTransfer, StockTransferController.prepare);
router.post('/stock-transfers/:id/dispatch', canDispatchTransfer, StockTransferController.dispatch);
router.post('/stock-transfers/:id/receive', canReceiveTransfer, StockTransferController.receive);
router.post('/stock-transfers/:id/cancel', canPrepareTransfer, StockTransferController.cancel);

export default router;
