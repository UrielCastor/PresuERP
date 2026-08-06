import { Request, Response, NextFunction } from 'express';
import { StockTransferService } from '../services/stockTransfer.service';
import { TransferStatus } from '@prisma/client';

const service = new StockTransferService();

export class StockTransferController {
  /**
   * POST /api/v1/logistics/transfer-requests/:id/create-transfer
   * POST /api/v1/logistics/stock-transfers
   * Create a StockTransfer document from an approved/partial request.
   */
  static async createFromRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const transferRequestId = req.params.id || req.body.transferRequestId;

      const input = {
        transferRequestId,
        items: req.body.items,
        notes: req.body.notes,
      };

      const transfer = await service.createFromRequest(businessId, userId, input);

      return res.status(201).json({
        success: true,
        data: transfer,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/logistics/stock-transfers
   * List stock transfers with filters.
   */
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { status, originWarehouseId, destinationWarehouseId, startDate, endDate, search, q } = req.query;

      const filters: any = {};
      if (status) filters.status = String(status) as TransferStatus;
      if (originWarehouseId) filters.originWarehouseId = String(originWarehouseId);
      if (destinationWarehouseId) filters.destinationWarehouseId = String(destinationWarehouseId);
      if (startDate) filters.startDate = new Date(String(startDate));
      if (endDate) filters.endDate = new Date(String(endDate));
      if (search || q) filters.search = String(search || q);

      const userRole = req.user!.role;
      const userDefaultWarehouseId = req.user!.defaultWarehouseId;

      const items = await service.list(businessId, filters, userRole, userDefaultWarehouseId);

      return res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/logistics/stock-transfers/:id
   * Get single stock transfer details.
   */
  static async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const id = req.params.id;

      const transfer = await service.findById(id, businessId);

      return res.status(200).json({
        success: true,
        data: transfer,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/logistics/stock-transfers/:id/prepare
   * Prepare stock transfer (PENDING -> PREPARING).
   */
  static async prepare(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const id = req.params.id;

      const preparedTransfer = await service.prepare(id, businessId, userId);

      return res.status(200).json({
        success: true,
        data: preparedTransfer,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/logistics/stock-transfers/:id/dispatch
   * Dispatch stock transfer (PREPARING -> IN_TRANSIT, origin stock deduction, Kardex, consume reservations).
   */
  static async dispatch(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const id = req.params.id;

      const dispatchedTransfer = await service.dispatch(id, businessId, userId);

      return res.status(200).json({
        success: true,
        data: dispatchedTransfer,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/logistics/stock-transfers/:id/receive
   * Receive stock transfer (IN_TRANSIT -> RECEIVED if complete, or partial reception).
   * Increases destination physical stock, logs Kardex INGRESO_POR_TRASPASO, updates request item receivedQty.
   */
  static async receive(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const id = req.params.id;

      const receivedTransfer = await service.receive(id, businessId, userId, req.body);

      return res.status(200).json({
        success: true,
        data: receivedTransfer,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const id = req.params.id;

      const cancelledTransfer = await service.cancel(id, businessId, userId);

      return res.status(200).json({
        success: true,
        data: cancelledTransfer,
      });
    } catch (error) {
      return next(error);
    }
  }
}
