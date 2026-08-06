import { Request, Response, NextFunction } from 'express';
import { TransferRequestService } from '../services/transferRequest.service';
import { TransferRequestStatus } from '@prisma/client';

const service = new TransferRequestService();

export class TransferRequestController {
  /**
   * GET /api/v1/logistics/transfer-requests
   * List transfer requests with filtering options.
   */
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { status, originWarehouseId, destinationWarehouseId, startDate, endDate, search, q } = req.query;

      const filters: any = {};
      if (status) filters.status = String(status) as TransferRequestStatus;
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
   * GET /api/v1/logistics/transfer-requests/:id
   * Get single transfer request details.
   */
  static async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const id = req.params.id;

      const request = await service.findById(id, businessId);

      return res.status(200).json({
        success: true,
        data: request,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/logistics/transfer-requests
   * Create a new transfer request in DRAFT status.
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userDefaultWarehouseId = req.user!.defaultWarehouseId;

      const newRequest = await service.create(businessId, userId, req.body, userRole, userDefaultWarehouseId);

      return res.status(201).json({
        success: true,
        data: newRequest,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PUT /api/v1/logistics/transfer-requests/:id
   * Edit a transfer request (only allowed if DRAFT).
   */
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const id = req.params.id;

      const updatedRequest = await service.update(id, businessId, req.body);

      return res.status(200).json({
        success: true,
        data: updatedRequest,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/logistics/transfer-requests/:id/send
   * Submit transfer request for approval (DRAFT -> PENDING).
   */
  static async sendForApproval(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const id = req.params.id;

      const sentRequest = await service.sendForApproval(id, businessId);

      return res.status(200).json({
        success: true,
        data: sentRequest,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/logistics/transfer-requests/:id/approve
   * Approve transfer request (full or partial approval with active stock reservation).
   */
  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const id = req.params.id;

      const approvedRequest = await service.approve(id, businessId, userId, req.body);

      return res.status(200).json({
        success: true,
        data: approvedRequest,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const id = req.params.id;

      const rejectedRequest = await service.reject(id, businessId, userId, req.body);

      return res.status(200).json({
        success: true,
        data: rejectedRequest,
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

      const cancelledRequest = await service.cancel(id, businessId, userId);

      return res.status(200).json({
        success: true,
        data: cancelledRequest,
      });
    } catch (error) {
      return next(error);
    }
  }
}
