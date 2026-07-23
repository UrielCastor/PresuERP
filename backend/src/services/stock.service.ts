import { StockRepository } from '../repositories/stock.repository';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/appError';

export class StockService {
  private stockRepo = new StockRepository();
  private activityLogRepo = new ActivityLogRepository();

  async findAll(businessId: string) {
    return this.stockRepo.findAll(businessId);
  }

  async findByWarehouse(warehouseId: string, businessId: string) {
    return this.stockRepo.findByWarehouse(warehouseId, businessId);
  }

  async findByProduct(productId: string, businessId: string) {
    return this.stockRepo.findByProduct(productId, businessId);
  }

  async findOne(id: string, businessId: string) {
    const stock = await this.stockRepo.findOne(id, businessId);
    if (!stock) {
      throw new NotFoundError('Registro de stock no encontrado');
    }
    return stock;
  }

  async findOrCreate(warehouseId: string, productId: string, businessId: string) {
    let stock = await this.stockRepo.findByWarehouseAndProduct(warehouseId, productId, businessId);
    if (!stock) {
      stock = await this.stockRepo.create({
        warehouseId,
        productId,
        quantity: 0,
        minimumStock: 0,
        maximumStock: 0,
        reservedQuantity: 0,
        businessId,
      });
      // Fetch full relation
      stock = await this.stockRepo.findOne((stock as any).id, businessId);
    }
    return stock;
  }

  async adjustStockQuantity(
    id: string,
    businessId: string,
    newQuantity: number,
    changeReason: string,
    operator: { id: string; name?: string; email?: string; businessId: string },
    ip?: string,
    userAgent?: string
  ) {
    const stockRaw = await this.stockRepo.findOne(id, businessId);
    if (!stockRaw) {
      throw new NotFoundError('Registro de stock no encontrado');
    }
    const stock = stockRaw as any;

    if (newQuantity < 0) {
      throw new BadRequestError('La cantidad de stock no puede ser menor a cero.');
    }

    if (!changeReason || changeReason.trim().length < 4) {
      throw new BadRequestError('El motivo del ajuste es obligatorio y debe tener al menos 4 caracteres.');
    }

    const previousQuantity = Number(stock.quantity);

    const updated = await this.stockRepo.update(id, businessId, {
      quantity: newQuantity,
    });

    const operatorName = operator.name || operator.email || 'Usuario';

    // Audit logs entry
    await this.activityLogRepo.log({
      userId: operator.id,
      businessId,
      entityName: 'Stock',
      entityId: id,
      actionType: 'UPDATE_STOCK',
      previousValues: JSON.stringify({ quantity: previousQuantity }),
      newValues: JSON.stringify({
        quantity: newQuantity,
        changeReason,
        productName: stock.product?.name || null,
        productId: stock.productId,
        warehouseName: stock.warehouse?.name || null,
        warehouseId: stock.warehouseId,
        operatorName,
      }),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return updated;
  }

  async updateStockLevels(
    id: string,
    businessId: string,
    data: { minimumStock?: number; maximumStock?: number; reservedQuantity?: number },
    operator: { id: string; name?: string; email?: string; businessId: string },
    ip?: string,
    userAgent?: string
  ) {
    const stockRaw = await this.stockRepo.findOne(id, businessId);
    if (!stockRaw) {
      throw new NotFoundError('Registro de stock no encontrado');
    }
    const stock = stockRaw as any;

    const previousValues = {
      minimumStock: Number(stock.minimumStock || stock.minAlertLevel || 0),
      maximumStock: Number(stock.maximumStock || stock.maxAlertLevel || 0),
      reservedQuantity: Number(stock.reservedQuantity || 0),
    };

    const updated = await this.stockRepo.update(id, businessId, {
      minimumStock: data.minimumStock !== undefined ? data.minimumStock : previousValues.minimumStock,
      maximumStock: data.maximumStock !== undefined ? data.maximumStock : previousValues.maximumStock,
      reservedQuantity: data.reservedQuantity !== undefined ? data.reservedQuantity : previousValues.reservedQuantity,
    });

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId,
      entityName: 'Stock',
      entityId: id,
      actionType: 'UPDATE_STOCK_LEVELS',
      previousValues: JSON.stringify(previousValues),
      newValues: JSON.stringify({
        minimumStock: (updated as any).minimumStock,
        maximumStock: (updated as any).maximumStock,
        reservedQuantity: (updated as any).reservedQuantity,
        productName: stock.product?.name,
        warehouseName: stock.warehouse?.name,
      }),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return updated;
  }
}
