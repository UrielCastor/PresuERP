import { Request, Response, NextFunction } from 'express';
import { StockMovementService } from '../services/stockMovement.service';
import { createStockMovementSchema } from '../validators/stockMovement.validator';

export class StockMovementController {
  private movementService = new StockMovementService();

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = (req.user as any).businessId;
      const {
        productId,
        warehouseId,
        userId,
        movementType,
        referenceType,
        referenceNumber,
        startDate,
        endDate,
        search,
        page,
        limit,
      } = req.query;

      const filters: any = {};
      if (productId) filters.productId = productId as string;
      if (warehouseId) filters.warehouseId = warehouseId as string;
      if (userId) filters.userId = userId as string;
      if (movementType) filters.movementType = movementType as string;
      if (referenceType) filters.referenceType = referenceType as string;
      if (referenceNumber) filters.referenceNumber = referenceNumber as string;
      if (search) filters.search = search as string;
      if (page) filters.page = Number(page);
      if (limit) filters.limit = Number(limit);

      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const result = await this.movementService.list(businessId, filters);

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getByProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = (req.user as any).businessId;
      const { id: productId } = req.params;
      const { page, limit } = req.query;

      const result = await this.movementService.findByProduct(productId, businessId, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getByWarehouse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = (req.user as any).businessId;
      const { id: warehouseId } = req.params;
      const { page, limit } = req.query;

      const result = await this.movementService.findByWarehouse(warehouseId, businessId, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = (req.user as any).businessId;
      const { id } = req.params;

      const result = await this.movementService.findOne(id, businessId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = (req.user as any).businessId;
      const userId = (req.user as any).id;

      // Validate body
      const parsedBody = createStockMovementSchema.parse(req.body);

      const ip = req.ip || req.socket.remoteAddress || undefined;
      const userAgent = req.headers['user-agent'] || undefined;

      const result = await this.movementService.registerMovement(
        {
          ...parsedBody,
          businessId,
          userId,
        },
        ip,
        userAgent
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
