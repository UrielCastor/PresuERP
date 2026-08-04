import { Request, Response, NextFunction } from 'express';
import { PriceListService } from '../services/priceList.service';

export class PriceListController {
  private service = new PriceListService();

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = req.user!.businessId;
      const lists = await this.service.getAllPriceLists(businessId);

      res.status(200).json({
        status: 'success',
        data: lists,
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      const list = await this.service.getPriceListById(id, businessId);

      res.status(200).json({
        status: 'success',
        data: list,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = req.user!.businessId;
      const { name, description, isActive, isDefault } = req.body;
      const created = await this.service.createPriceList(businessId, { name, description, isActive, isDefault });

      res.status(201).json({
        status: 'success',
        message: 'Lista de precios creada exitosamente',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      const { name, description, isActive, isDefault } = req.body;
      const updated = await this.service.updatePriceList(id, businessId, { name, description, isActive, isDefault });

      res.status(200).json({
        status: 'success',
        message: 'Lista de precios actualizada exitosamente',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      await this.service.deletePriceList(id, businessId);

      res.status(200).json({
        status: 'success',
        message: 'Lista de precios eliminada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  };

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;
      const { productId, price, minQuantity } = req.body;
      const item = await this.service.addPriceListItem(id, businessId, { productId, price, minQuantity });

      res.status(201).json({
        status: 'success',
        message: 'Precio especial asignado exitosamente',
        data: item,
      });
    } catch (error) {
      next(error);
    }
  };

  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = req.user!.businessId;
      const { id, itemId } = req.params;
      const { price, minQuantity } = req.body;
      const updated = await this.service.updatePriceListItem(itemId, id, businessId, { price, minQuantity });

      res.status(200).json({
        status: 'success',
        message: 'Precio especial actualizado exitosamente',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = req.user!.businessId;
      const { id, itemId } = req.params;
      await this.service.deletePriceListItem(itemId, id, businessId);

      res.status(200).json({
        status: 'success',
        message: 'Precio especial eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  };
}
