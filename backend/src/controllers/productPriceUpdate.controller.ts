import { Request, Response } from 'express';
import { ProductPriceUpdateService } from '../services/productPriceUpdate.service';

export class ProductPriceUpdateController {
  private service = new ProductPriceUpdateService();

  preview = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const businessId = user?.businessId;
      const userId = user?.id;
      if (!businessId || !userId) {
        return res.status(401).json({ error: 'No autorizado / Negocio no configurado' });
      }

      const {
        filterType,
        filterValue,
        productIds,
        type,
        percentage,
        fixedAmount,
        multiplyFactor,
        affectedPurchasePrice,
        affectedSalePrice,
        roundingOption,
        priceListStrategy,
      } = req.body;

      if (!filterType || !type) {
        return res.status(400).json({ error: 'filterType y type son obligatorios' });
      }

      if (!affectedPurchasePrice && !affectedSalePrice) {
        return res.status(400).json({ error: 'Debes seleccionar al menos una opción entre Precio de compra o Precio de venta' });
      }

      const previewData = await this.service.preview({
        businessId,
        userId,
        filterType,
        filterValue,
        productIds,
        type,
        percentage: percentage !== undefined ? Number(percentage) : undefined,
        fixedAmount: fixedAmount !== undefined ? Number(fixedAmount) : undefined,
        multiplyFactor: multiplyFactor !== undefined ? Number(multiplyFactor) : undefined,
        affectedPurchasePrice: Boolean(affectedPurchasePrice),
        affectedSalePrice: Boolean(affectedSalePrice),
        roundingOption,
        priceListStrategy,
      });

      return res.json({
        success: true,
        data: previewData,
      });
    } catch (error: any) {
      console.error('Error al generar pre-visualización de actualización de precios:', error);
      return res.status(500).json({ error: error.message || 'Error interno al generar vista previa' });
    }
  };

  apply = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const businessId = user?.businessId;
      const userId = user?.id;
      if (!businessId || !userId) {
        return res.status(401).json({ error: 'No autorizado / Negocio no configurado' });
      }

      const {
        filterType,
        filterValue,
        productIds,
        type,
        percentage,
        fixedAmount,
        multiplyFactor,
        affectedPurchasePrice,
        affectedSalePrice,
        roundingOption,
        priceListStrategy,
      } = req.body;

      if (!filterType || !type) {
        return res.status(400).json({ error: 'filterType y type son obligatorios' });
      }

      if (!affectedPurchasePrice && !affectedSalePrice) {
        return res.status(400).json({ error: 'Debes seleccionar al menos una opción entre Precio de compra o Precio de venta' });
      }

      const result = await this.service.apply({
        businessId,
        userId,
        filterType,
        filterValue,
        productIds,
        type,
        percentage: percentage !== undefined ? Number(percentage) : undefined,
        fixedAmount: fixedAmount !== undefined ? Number(fixedAmount) : undefined,
        multiplyFactor: multiplyFactor !== undefined ? Number(multiplyFactor) : undefined,
        affectedPurchasePrice: Boolean(affectedPurchasePrice),
        affectedSalePrice: Boolean(affectedSalePrice),
        roundingOption,
        priceListStrategy,
      });

      return res.json({
        success: true,
        message: `Se actualizaron correctamente ${result.productsAffected} productos`,
        data: result,
      });
    } catch (error: any) {
      console.error('Error al aplicar actualización masiva de precios:', error);
      return res.status(500).json({ error: error.message || 'Error interno al aplicar actualización' });
    }
  };

  getHistory = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const businessId = user?.businessId;
      if (!businessId) {
        return res.status(401).json({ error: 'No autorizado / Negocio no configurado' });
      }

      const history = await this.service.getHistory(businessId);
      return res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      console.error('Error al obtener historial de actualización de precios:', error);
      return res.status(500).json({ error: error.message || 'Error interno al consultar historial' });
    }
  };

  applyCustom = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const businessId = user?.businessId;
      const userId = user?.id;
      if (!businessId || !userId) {
        return res.status(401).json({ error: 'No autorizado / Negocio no configurado' });
      }

      const { supplierId, priceListStrategy, items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Se requiere una lista de productos a actualizar' });
      }

      const result = await this.service.applyCustom({
        businessId,
        userId,
        supplierId,
        priceListStrategy,
        items,
      });

      return res.json({
        success: true,
        message: `Se actualizaron correctamente ${result.productsAffected} productos`,
        data: result,
      });
    } catch (error: any) {
      console.error('Error al aplicar actualización masiva personalizada:', error);
      return res.status(500).json({ error: error.message || 'Error interno al actualizar productos' });
    }
  };
}
