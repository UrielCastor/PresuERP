import { WarehouseTransferRepository, CreateTransferInput } from '../repositories/warehouseTransfer.repository';
import { StockMovementService } from './stockMovement.service';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { prisma } from '../config/db';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/appError';

export class WarehouseTransferService {
  private transferRepo = new WarehouseTransferRepository();
  private stockMovementService = new StockMovementService();
  private activityLogRepo = new ActivityLogRepository();

  async list(businessId: string) {
    return this.transferRepo.list(businessId);
  }

  async findOne(id: string, businessId: string) {
    const transfer = await this.transferRepo.findById(id, businessId);
    if (!transfer) {
      throw new NotFoundError('Traspaso de mercadería no encontrado.');
    }
    return transfer;
  }

  async create(businessId: string, createdById: string, input: CreateTransferInput) {
    // 1. Validation: Origin is different from destination
    if (input.sourceWarehouseId === input.targetWarehouseId) {
      throw new BadRequestError('El depósito origen y el depósito destino no pueden ser el mismo.');
    }

    // 2. Validation: Warehouses exist and are active
    const sourceWarehouse = await prisma.warehouse.findFirst({
      where: { id: input.sourceWarehouseId, businessId, status: 'ACTIVE' },
    });
    if (!sourceWarehouse) {
      throw new BadRequestError('El depósito de origen especificado no existe o está inactivo.');
    }

    const targetWarehouse = await prisma.warehouse.findFirst({
      where: { id: input.targetWarehouseId, businessId, status: 'ACTIVE' },
    });
    if (!targetWarehouse) {
      throw new BadRequestError('El depósito de destino especificado no existe o está inactivo.');
    }

    const userWarehouses = await prisma.userWarehouse.findMany({
      where: { userId: createdById },
    });
    if (userWarehouses.length > 0) {
      const allowed = userWarehouses.some((uw) => uw.warehouseId === input.sourceWarehouseId || uw.warehouseId === input.targetWarehouseId);
      if (!allowed) {
        throw new ForbiddenError('No tienes permisos autorizados sobre los depósitos involucrados en este traspaso.');
      }
    }

    // 3. Validation: Verify source stock levels for each item
    for (const item of input.items) {
      const stock = await prisma.stock.findUnique({
        where: {
          warehouseId_productId_businessId: {
            warehouseId: input.sourceWarehouseId,
            productId: item.productId,
            businessId,
          },
        },
      });

      const qtyAvailable = stock ? Number(stock.quantity) : 0;
      if (qtyAvailable < item.quantity) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        throw new BadRequestError(
          `Stock insuficiente para realizar transferencia. Producto: '${product?.name || 'Desconocido'}'. Disponible: ${qtyAvailable}, Solicitado: ${item.quantity}`
        );
      }
    }

    // 4. Delegate to repository
    const transfer = await this.transferRepo.create(businessId, createdById, input);

    // 5. Activity Log creation
    await prisma.activityLog.create({
      data: {
        userId: createdById,
        businessId,
        entityName: 'WarehouseTransfer',
        entityId: transfer!.id,
        actionType: 'CREATE_TRANSFER',
        previousValues: null,
        newValues: JSON.stringify({
          sourceWarehouseId: input.sourceWarehouseId,
          targetWarehouseId: input.targetWarehouseId,
          status: 'PENDING',
          itemsCount: input.items.length,
        }),
      },
    });

    return transfer;
  }

  async updateStatus(id: string, businessId: string, status: string, userId: string) {
    const transfer = await this.findOne(id, businessId);

    const currentStatus = transfer.status;
    const targetStatus = status.toUpperCase();

    // Check terminal flows
    if (currentStatus === 'COMPLETED' || currentStatus === 'CANCELLED') {
      throw new BadRequestError('No se pueden modificar transferencias en estado terminal (Recibido o Cancelado).');
    }

    // Valid statuses: DRAFT, PENDING, IN_TRANSIT, COMPLETED, CANCELLED
    const validStatuses = ['DRAFT', 'PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(targetStatus)) {
      throw new BadRequestError(`Estado destino inválido: ${status}`);
    }

    return await prisma.$transaction(async (tx) => {
      // If COMPLETED, perform the stock transfer movements
      if (targetStatus === 'COMPLETED') {
        // Warehouse status check
        if (transfer.sourceWarehouse.status !== 'ACTIVE' || transfer.targetWarehouse.status !== 'ACTIVE') {
          throw new BadRequestError('Uno de los depósitos involucrados se encuentra inactivo.');
        }

        // Process stock movements per item
        for (const item of transfer.items) {
          // Double-check stock in origin again just in case
          const stock = await tx.stock.findUnique({
            where: {
              warehouseId_productId_businessId: {
                warehouseId: transfer.sourceWarehouseId,
                productId: item.productId,
                businessId,
              },
            },
          });

          const qtyAvailable = stock ? Number(stock.quantity) : 0;
          const qtyRequired = Number(item.quantity);
          if (qtyAvailable < qtyRequired) {
            throw new BadRequestError(
              `Stock insuficiente para completar la transferencia. Producto: '${item.product.name}'. Disponible: ${qtyAvailable}, Solicitado: ${qtyRequired}`
            );
          }

          // A. TRANSFER_OUT movement for Source Warehouse
          await this.stockMovementService.registerMovement(
            {
              businessId,
              warehouseId: transfer.sourceWarehouseId,
              productId: item.productId,
              userId,
              movementType: 'TRANSFER_OUT',
              quantity: qtyRequired,
              referenceType: 'TRANSFER',
              referenceId: transfer.id,
              referenceNumber: `TRSF-${transfer.id.substring(0, 8).toUpperCase()}`,
              reason: 'Envío de stock por traspaso de mercadería',
            },
            undefined,
            undefined,
            tx
          );

          // B. TRANSFER_IN movement for Target Warehouse
          await this.stockMovementService.registerMovement(
            {
              businessId,
              warehouseId: transfer.targetWarehouseId,
              productId: item.productId,
              userId,
              movementType: 'TRANSFER_IN',
              quantity: qtyRequired,
              referenceType: 'TRANSFER',
              referenceId: transfer.id,
              referenceNumber: `TRSF-${transfer.id.substring(0, 8).toUpperCase()}`,
              reason: 'Recepción de stock por traspaso de mercadería',
            },
            undefined,
            undefined,
            tx
          );
        }
      }

      // Update Transfer state
      const updated = await tx.warehouseTransfer.update({
        where: { id },
        data: { status: targetStatus },
        include: {
          sourceWarehouse: { select: { id: true, name: true, code: true } },
          targetWarehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } }
            }
          }
        },
      });

      // Write Activity Log
      await tx.activityLog.create({
        data: {
          userId,
          businessId,
          entityName: 'WarehouseTransfer',
          entityId: id,
          actionType: `UPDATE_TRANSFER_STATUS_${targetStatus}`,
          previousValues: JSON.stringify({ status: currentStatus }),
          newValues: JSON.stringify({ status: targetStatus }),
        },
      });

      return updated;
    });
  }
}
