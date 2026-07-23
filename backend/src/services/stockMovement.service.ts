import { StockMovementRepository, StockMovementFilters } from '../repositories/stockMovement.repository';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/appError';

export class StockMovementService {
  private movementRepo = new StockMovementRepository();
  private activityLogRepo = new ActivityLogRepository();

  async list(businessId: string, filters: StockMovementFilters = {}) {
    return this.movementRepo.findAll(businessId, filters);
  }

  async findByProduct(productId: string, businessId: string, filters: StockMovementFilters = {}) {
    return this.movementRepo.findByProduct(productId, businessId, filters);
  }

  async findByWarehouse(warehouseId: string, businessId: string, filters: StockMovementFilters = {}) {
    return this.movementRepo.findByWarehouse(warehouseId, businessId, filters);
  }

  async findOne(id: string, businessId: string) {
    const movement = await this.movementRepo.findOne(id, businessId);
    if (!movement) {
      throw new NotFoundError('Movimiento de stock no encontrado');
    }
    return movement;
  }

  async registerMovement(
    data: {
      businessId: string;
      warehouseId: string;
      productId: string;
      userId: string;
      movementType: string;
      quantity: number; // raw value
      unitCost?: number;
      referenceType?: string | null;
      referenceId?: string | null;
      referenceNumber?: string | null;
      reason?: string | null;
      notes?: string | null;
    },
    ip?: string,
    userAgent?: string,
    tx?: any
  ) {
    const execute = async (txClient: any) => {
      // 1. Validate product
      const product = await (txClient.product as any).findFirst({
        where: { id: data.productId, businessId: data.businessId },
      });
      if (!product) {
        throw new NotFoundError('El producto especificado no existe en el catálogo.');
      }

      // 2. Validate warehouse
      const warehouse = await (txClient.warehouse as any).findFirst({
        where: { id: data.warehouseId, businessId: data.businessId },
      });
      if (!warehouse) {
        throw new NotFoundError('El depósito especificado no existe.');
      }
      if (warehouse.status !== 'ACTIVE') {
        throw new BadRequestError('El depósito seleccionado se encuentra inactivo.');
      }

      // 3. Get or create Stock
      let stock = await (txClient.stock as any).findUnique({
        where: {
          warehouseId_productId_businessId: {
            warehouseId: data.warehouseId,
            productId: data.productId,
            businessId: data.businessId,
          },
        } as any,
      });

      if (!stock) {
        stock = await (txClient.stock as any).create({
          data: {
            warehouseId: data.warehouseId,
            productId: data.productId,
            businessId: data.businessId,
            quantity: 0,
            reservedQuantity: 0,
            minimumStock: 0,
            maximumStock: 0,
          } as any,
        });
      }

      const stockBefore = Number(stock.quantity);
      let qtyOffset = 0;
      const type = data.movementType.toUpperCase();

      // Rule calculation based on movement type
      if (type === 'ENTRY' || type === 'TRANSFER_IN') {
        if (data.quantity < 0) {
          throw new BadRequestError('La cantidad para ingresos debe ser positiva.');
        }
        qtyOffset = data.quantity;
      } else if (type === 'EXIT' || type === 'TRANSFER_OUT') {
        if (data.quantity < 0) {
          throw new BadRequestError('La cantidad para egresos debe ser positiva.');
        }
        qtyOffset = -data.quantity;
      } else if (type === 'ADJUSTMENT') {
        qtyOffset = data.quantity;
      } else if (type === 'INVENTORY') {
        if (data.quantity < 0) {
          throw new BadRequestError('El stock de inventario físico no puede ser negativo.');
        }
        qtyOffset = data.quantity - stockBefore;
      } else {
        // Fallback signed delta
        qtyOffset = data.quantity;
      }

      const stockAfter = stockBefore + qtyOffset;

      // Negative stock policy validation
      if (stockAfter < 0) {
        const settings = await (txClient.businessSettings as any).findUnique({
          where: { businessId: data.businessId },
        });
        const allowNegative = settings?.allowNegativeStock ?? false;
        if (!allowNegative) {
          throw new BadRequestError(
            `Operación abortada por stock insuficiente en ${warehouse.name} para '${product.name}' (Disponible: ${stockBefore}, Faltante: ${Math.abs(qtyOffset)})`
          );
        }
      }

      // Calculate cost attributes
      const unitCost = data.unitCost !== undefined ? data.unitCost : Number((product as any).purchasePrice) || 0;
      const totalCost = unitCost * Math.abs(qtyOffset);

      // 4. Update the stock entity
      await (txClient.stock as any).update({
        where: { id: stock.id },
        data: {
          quantity: stockAfter,
        },
      });

      // 5. Create immutable stock movement record
      const movement = await (txClient.stockMovement as any).create({
        data: {
          businessId: data.businessId,
          warehouseId: data.warehouseId,
          productId: data.productId,
          userId: data.userId,
          movementType: type,
          quantity: qtyOffset,
          stockBefore,
          stockAfter,
          unitCost,
          totalCost,
          referenceType: data.referenceType || null,
          referenceId: data.referenceId || null,
          referenceNumber: data.referenceNumber || null,
          reason: data.reason || null,
          notes: data.notes || null,
        } as any,
      });

      // 6. Write custom ActivityLog
      const user = await (txClient.user as any).findFirst({ where: { id: data.userId } });
      const operatorName = user?.name || user?.email || 'Sistema';

      await (txClient.activityLog as any).create({
        data: {
          userId: data.userId,
          businessId: data.businessId,
          entityName: 'StockMovement',
          entityId: movement.id,
          actionType: 'CREATE_MOVEMENT',
          previousValues: JSON.stringify({ quantity: stockBefore }),
          newValues: JSON.stringify({
            movementId: movement.id,
            movementType: type,
            productId: data.productId,
            productName: product.name,
            warehouseId: data.warehouseId,
            warehouseName: warehouse.name,
            quantityAdjusted: qtyOffset,
            stockBefore,
            stockAfter,
            unitCost,
            totalCost,
            reason: data.reason || null,
            referenceNumber: data.referenceNumber || null,
            operatorName,
          }),
          ipAddress: ip || null,
          userAgent: userAgent || null,
        },
      });

      return movement;
    };

    if (tx) {
      return execute(tx);
    } else {
      return prisma.$transaction(async (txClient) => {
        return execute(txClient);
      });
    }
  }
}
