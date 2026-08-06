import { Request, Response, NextFunction } from 'express';
import { LogisticsService } from '../services/logistics.service';

const logisticsService = new LogisticsService();

export class LogisticsController {
  /**
   * GET /api/v1/logistics/products/search?q=query
   * Search products for logistics requests (minimal product fields, no prices/costs)
   */
  static async searchProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const query = String(req.query.q || req.query.query || req.query.search || '');
      const products = await logisticsService.searchProductsForLogistics(businessId, query);

      return res.status(200).json({
        success: true,
        data: products,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/logistics/product-availability?productId=id
   * GET /api/v1/logistics/products/:productId/availability
   * Get available stock for a product across all company warehouses
   */
  static async getProductAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const productId = String(req.params.productId || req.query.productId || '');
      const result = await logisticsService.getProductAvailabilityAcrossWarehouses(businessId, productId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}
