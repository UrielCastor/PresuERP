import { prisma } from '../config/db';
import { TransferStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/appError';

export interface StockTransferFilterInput {
  status?: TransferStatus;
  originWarehouseId?: string;
  destinationWarehouseId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export interface CreateStockTransferInput {
  transferRequestId: string;
  items?: { transferRequestItemId: string; quantity: number }[];
  notes?: string;
}

export class StockTransferRepository {
  /**
   * Generates sequential transfer number formatted as TRA-000001, TRA-000002, etc.
   */
  private async generateNextTransferNumber(tx: any, businessId: string): Promise<string> {
    const lastTransfer = await tx.stockTransfer.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: { transferNumber: true },
    });

    let nextSeq = 1;
    if (lastTransfer && lastTransfer.transferNumber) {
      const parts = lastTransfer.transferNumber.split('-');
      if (parts.length === 2 && !isNaN(parseInt(parts[1], 10))) {
        nextSeq = parseInt(parts[1], 10) + 1;
      }
    }

    const paddedSeq = String(nextSeq).padStart(6, '0');
    return `TRA-${paddedSeq}`;
  }

  /**
   * Creates a StockTransfer document from an approved or partial TransferRequest.
   */
  async createFromRequest(businessId: string, createdByUserId: string, input: CreateStockTransferInput) {
    return prisma.$transaction(async (tx) => {
      // 0. Acquire pessimistic row-level lock on TransferRequest to eliminate TOCTOU race conditions under high concurrency
      await tx.$executeRaw`SELECT id FROM "transfer_requests" WHERE id = ${input.transferRequestId} AND "businessId" = ${businessId} FOR UPDATE`;

      // 1. Fetch TransferRequest with guaranteed fresh & locked data
      const request = await tx.transferRequest.findFirst({
        where: { id: input.transferRequestId, businessId },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      });

      if (!request) {
        throw new NotFoundError('Pedido interno no encontrado');
      }

      if (request.status !== 'APPROVED' && request.status !== 'PARTIAL') {
        throw new BadRequestError('Solo se pueden generar traspasos a partir de pedidos Aprobados o Parciales');
      }

      // Determine items to dispatch
      const itemsToCreate: { transferRequestItemId: string; productId: string; quantity: number }[] = [];

      if (input.items && input.items.length > 0) {
        const itemMap = new Map<string, any>();
        request.items.forEach((i) => itemMap.set(i.id, i));

        for (const itemInput of input.items) {
          const matching = itemMap.get(itemInput.transferRequestItemId);
          if (!matching) {
            throw new BadRequestError('Uno o más ítems especificados no corresponden al pedido');
          }
          
          const qtyInput = Number(itemInput.quantity);
          if (isNaN(qtyInput) || qtyInput <= 0) {
            throw new BadRequestError('La cantidad enviada debe ser mayor a cero');
          }

          const approvedQtyNum = Number(matching.approvedQty || 0);
          const sentQtyNum = Number(matching.sentQty || 0);
          const saldoDisponible = Math.max(0, approvedQtyNum - sentQtyNum);

          if (saldoDisponible <= 0) {
            throw new BadRequestError(`El producto ${matching.product.name} ya fue enviado completamente.`);
          }

          if (qtyInput > saldoDisponible) {
            throw new BadRequestError(
              `No es posible crear el traspaso del producto ${matching.product.name}.\nAprobado: ${approvedQtyNum}\nYa enviado: ${sentQtyNum}\nSaldo disponible: ${saldoDisponible}\nIntentó enviar: ${qtyInput}`
            );
          }

          itemsToCreate.push({
            transferRequestItemId: matching.id,
            productId: matching.productId,
            quantity: qtyInput,
          });
        }
      } else {
        // Default: use remaining available balance (saldoDisponible) for each item in request
        for (const reqItem of request.items) {
          const approvedQtyNum = Number(reqItem.approvedQty || 0);
          const sentQtyNum = Number(reqItem.sentQty || 0);
          const saldoDisponible = Math.max(0, approvedQtyNum - sentQtyNum);

          if (saldoDisponible > 0) {
            itemsToCreate.push({
              transferRequestItemId: reqItem.id,
              productId: reqItem.productId,
              quantity: saldoDisponible,
            });
          }
        }
      }

      if (itemsToCreate.length === 0) {
        throw new BadRequestError('El pedido no tiene saldo disponible aprobado mayor a cero para traspasar');
      }

      // 2. Generate TRA-000001 number
      const transferNumber = await this.generateNextTransferNumber(tx, businessId);

      // 3. Create StockTransfer record
      const transfer = await tx.stockTransfer.create({
        data: {
          businessId,
          transferRequestId: request.id,
          transferNumber,
          originWarehouseId: request.originWarehouseId,
          destinationWarehouseId: request.destinationWarehouseId,
          preparedByUserId: createdByUserId,
          status: 'PENDING',
          notes: input.notes || request.notes || null,
          items: {
            create: itemsToCreate.map((item) => ({
              transferRequestItemId: item.transferRequestItemId,
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          originWarehouse: { select: { id: true, name: true, code: true } },
          destinationWarehouse: { select: { id: true, name: true, code: true } },
          preparedByUser: { select: { id: true, name: true, email: true } },
          transferRequest: { select: { id: true, requestNumber: true, status: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, barcode: true, unitOfMeasure: true } },
            },
          },
        },
      });

      // 4. Update sentQty on TransferRequestItem records
      for (const item of itemsToCreate) {
        await tx.transferRequestItem.update({
          where: { id: item.transferRequestItemId },
          data: {
            sentQty: { increment: item.quantity },
          },
        });
      }

      return transfer;
    });
  }

  async list(businessId: string, filters: StockTransferFilterInput = {}) {
    const where: any = { businessId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.originWarehouseId) {
      where.originWarehouseId = filters.originWarehouseId;
    }
    if (filters.destinationWarehouseId) {
      where.destinationWarehouseId = filters.destinationWarehouseId;
    }
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }
    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { transferNumber: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    return prisma.stockTransfer.findMany({
      where,
      include: {
        originWarehouse: { select: { id: true, name: true, code: true } },
        destinationWarehouse: { select: { id: true, name: true, code: true } },
        preparedByUser: { select: { id: true, name: true, email: true } },
        dispatchedByUser: { select: { id: true, name: true, email: true } },
        receivedByUser: { select: { id: true, name: true, email: true } },
        transferRequest: { select: { id: true, requestNumber: true, status: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, barcode: true, unitOfMeasure: true } },
          },
        },
        receipts: {
          include: {
            receivedByUser: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
        },
        _count: { select: { items: true, receipts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, businessId: string) {
    return prisma.stockTransfer.findFirst({
      where: { id, businessId },
      include: {
        originWarehouse: { select: { id: true, name: true, code: true } },
        destinationWarehouse: { select: { id: true, name: true, code: true } },
        preparedByUser: { select: { id: true, name: true, email: true } },
        dispatchedByUser: { select: { id: true, name: true, email: true } },
        receivedByUser: { select: { id: true, name: true, email: true } },
        transferRequest: { select: { id: true, requestNumber: true, status: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, barcode: true, unitOfMeasure: true } },
          },
        },
        receipts: {
          include: {
            receivedByUser: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
        },
      },
    });
  }

  async prepare(id: string, businessId: string, preparedByUserId: string) {
    return prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({
        where: { id, businessId },
        include: { items: true },
      });

      if (!transfer) {
        throw new NotFoundError('Traspaso no encontrado');
      }

      if (transfer.status === 'CANCELLED') {
        throw new BadRequestError('No se puede preparar un traspaso cancelado');
      }

      if (transfer.status === 'RECEIVED' || transfer.status === 'IN_TRANSIT') {
        throw new BadRequestError('El traspaso ya no se encuentra en estado Pendiente para su preparación');
      }

      if (!transfer.items || transfer.items.length === 0) {
        throw new BadRequestError('El traspaso no contiene productos para preparar');
      }

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'PREPARING',
          preparedByUserId,
        },
        include: {
          originWarehouse: { select: { id: true, name: true, code: true } },
          destinationWarehouse: { select: { id: true, name: true, code: true } },
          preparedByUser: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, barcode: true, unitOfMeasure: true } },
            },
          },
        },
      });

      return updated;
    });
  }

  /**
   * Atomic Dispatch Transaction:
   * 1. Validates physical stock availability at origin warehouse.
   * 2. Deducts physical stock from origin warehouse.
   * 3. Creates Kardex movement (SALIDA_POR_TRASPASO / TRANSFER_OUT).
   * 4. Consumes related StockReservations (ACTIVE -> CONSUMED).
   * 5. Updates status to IN_TRANSIT, dispatchedByUserId, departureDate.
   */
  async dispatch(id: string, businessId: string, dispatchedByUserId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch transfer details
      const transfer = await tx.stockTransfer.findFirst({
        where: { id, businessId },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      });

      if (!transfer) {
        throw new NotFoundError('Traspaso no encontrado');
      }

      if (transfer.status === 'CANCELLED') {
        throw new BadRequestError('No se puede despachar un traspaso cancelado');
      }

      if (transfer.status === 'IN_TRANSIT' || transfer.status === 'RECEIVED') {
        throw new BadRequestError('El traspaso ya fue despachado o recibido previamente');
      }

      if (!transfer.items || transfer.items.length === 0) {
        throw new BadRequestError('El traspaso no contiene ítems para despachar');
      }

      // 2. Process each item (Stock deduction + Kardex + Reservation Consumption)
      for (const item of transfer.items) {
        const qtyNum = Number(item.quantity);

        // Fetch or create stock record for origin warehouse
        let stockRecord = await tx.stock.findFirst({
          where: { warehouseId: transfer.originWarehouseId, productId: item.productId, businessId },
        });

        if (!stockRecord) {
          stockRecord = await tx.stock.create({
            data: {
              businessId,
              warehouseId: transfer.originWarehouseId,
              productId: item.productId,
              quantity: 0,
            },
          });
        }

        const physicalStock = Number(stockRecord.quantity || 0);

        // Validate physical stock is sufficient for dispatch
        if (physicalStock < qtyNum) {
          throw new BadRequestError(
            `Stock físico insuficiente en el depósito origen para despachar el producto ${item.product.name} (SKU: ${item.product.sku}). Físico: ${physicalStock}, Requerido: ${qtyNum}`
          );
        }

        const stockBefore = physicalStock;
        const stockAfter = physicalStock - qtyNum;

        // Deduct physical stock from origin warehouse
        await tx.stock.update({
          where: { id: stockRecord.id },
          data: { quantity: stockAfter },
        });

        // Create Kardex exit movement (SALIDA_POR_TRASPASO)
        await tx.stockMovement.create({
          data: {
            businessId,
            warehouseId: transfer.originWarehouseId,
            productId: item.productId,
            userId: dispatchedByUserId,
            movementType: 'SALIDA_POR_TRASPASO',
            quantity: qtyNum,
            stockBefore,
            stockAfter,
            unitCost: 0,
            totalCost: 0,
            referenceType: 'STOCK_TRANSFER',
            referenceId: transfer.id,
            referenceNumber: transfer.transferNumber,
            notes: `Despacho de traspaso ${transfer.transferNumber} hacia depósito destino`,
          },
        });

        // Consume active stock reservations linked to transferRequestId if present
        if (transfer.transferRequestId) {
          const activeReservations = await tx.stockReservation.findMany({
            where: {
              businessId,
              warehouseId: transfer.originWarehouseId,
              productId: item.productId,
              transferRequestId: transfer.transferRequestId,
              status: 'ACTIVE',
            },
            orderBy: { createdAt: 'asc' },
          });

          let remainingToConsume = qtyNum;
          for (const res of activeReservations) {
            if (remainingToConsume <= 0) break;

            const resQty = Number(res.quantity);

            if (resQty <= remainingToConsume) {
              // Full consumption of this reservation record
              await tx.stockReservation.update({
                where: { id: res.id },
                data: { status: 'CONSUMED' },
              });
              remainingToConsume -= resQty;
            } else {
              // Partial consumption: split reservation into CONSUMED portion and remaining ACTIVE portion
              const remainingActiveQty = resQty - remainingToConsume;

              // Update existing record to CONSUMED for dispatched amount
              await tx.stockReservation.update({
                where: { id: res.id },
                data: { quantity: remainingToConsume, status: 'CONSUMED' },
              });

              // Create new record for remaining active balance
              await tx.stockReservation.create({
                data: {
                  businessId,
                  warehouseId: transfer.originWarehouseId,
                  productId: item.productId,
                  transferRequestId: transfer.transferRequestId,
                  quantity: remainingActiveQty,
                  status: 'ACTIVE',
                },
              });

              remainingToConsume = 0;
            }
          }
        }
      }

      // 3. Update transfer status to IN_TRANSIT
      const dispatchedTransfer = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: 'IN_TRANSIT',
          dispatchedByUserId,
          departureDate: new Date(),
        },
        include: {
          originWarehouse: { select: { id: true, name: true, code: true } },
          destinationWarehouse: { select: { id: true, name: true, code: true } },
          dispatchedByUser: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, barcode: true, unitOfMeasure: true } },
            },
          },
        },
      });

      return dispatchedTransfer;
    });
  }

  /**
   * Atomic Reception Transaction:
   * 1. Validates transfer is IN_TRANSIT and receivedQty <= sentQty (cumulative).
   * 2. Creates StockTransferReceipt and StockTransferReceiptItem records.
   * 3. Increases physical stock in DESTINATION warehouse (destinationWarehouseId).
   * 4. Creates Kardex entry (INGRESO_POR_TRASPASO) in DESTINATION warehouse.
   * 5. Updates receivedQty in TransferRequestItem.
   * 6. Updates StockTransfer status to RECEIVED if fully received (cumulative >= sent).
   */
  async receive(
    id: string,
    businessId: string,
    receivedByUserId: string,
    inputItems: { stockTransferItemId: string; receivedQty: number }[],
    notes?: string
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch transfer details
      const transfer = await tx.stockTransfer.findFirst({
        where: { id, businessId },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          receipts: {
            include: {
              items: true,
            },
          },
        },
      });

      if (!transfer) {
        throw new NotFoundError('Traspaso no encontrado');
      }

      if (transfer.status !== 'IN_TRANSIT') {
        throw new BadRequestError('Solo se pueden recibir traspasos que se encuentren en tránsito (IN_TRANSIT)');
      }

      if (!inputItems || !Array.isArray(inputItems) || inputItems.length === 0) {
        throw new BadRequestError('Debe especificar la lista de productos recibidos');
      }

      const transferItemMap = new Map<string, any>();
      transfer.items.forEach((i) => transferItemMap.set(i.id, i));

      // Calculate previously received quantity per productId
      const prevReceivedMap = new Map<string, number>();
      for (const receipt of transfer.receipts) {
        for (const rItem of receipt.items) {
          const currentPrev = prevReceivedMap.get(rItem.productId) || 0;
          prevReceivedMap.set(rItem.productId, currentPrev + Number(rItem.receivedQty));
        }
      }

      // 2. Generate receipt header number
      const receiptCount = transfer.receipts.length + 1;
      const receiptNumber = `REC-${transfer.transferNumber}-${receiptCount}`;

      const receipt = await tx.stockTransferReceipt.create({
        data: {
          stockTransferId: id,
          receiptNumber,
          receivedByUserId,
          notes: notes || null,
        },
      });

      let totalTransferSentQty = 0;
      let totalTransferCumReceivedQty = 0;

      for (const tItem of transfer.items) {
        totalTransferSentQty += Number(tItem.quantity);
      }

      // 3. Process items in reception payload
      for (const inputItem of inputItems) {
        const matchingItem = transferItemMap.get(inputItem.stockTransferItemId);
        if (!matchingItem) {
          throw new BadRequestError('Uno o más ítems recibidos no corresponden a este traspaso');
        }

        const currentReceivedQty = Number(inputItem.receivedQty);
        if (isNaN(currentReceivedQty) || currentReceivedQty < 0) {
          throw new BadRequestError('La cantidad recibida no puede ser negativa');
        }

        const sentQty = Number(matchingItem.quantity);
        const prevReceivedQty = prevReceivedMap.get(matchingItem.productId) || 0;
        const newTotalReceivedForProduct = prevReceivedQty + currentReceivedQty;

        if (newTotalReceivedForProduct > sentQty) {
          throw new BadRequestError(
            `La cantidad recibida acumulada (${newTotalReceivedForProduct}) no puede superar a la cantidad enviada (${sentQty}) para el producto ${matchingItem.product.name}`
          );
        }

        const expectedQty = Math.max(0, sentQty - prevReceivedQty);
        const differenceQty = currentReceivedQty - expectedQty;

        // Create StockTransferReceiptItem
        await tx.stockTransferReceiptItem.create({
          data: {
            receiptId: receipt.id,
            productId: matchingItem.productId,
            expectedQty,
            receivedQty: currentReceivedQty,
            differenceQty,
            notes: notes || null,
          },
        });

        // Increase physical stock in DESTINATION warehouse (destinationWarehouseId)
        let destStock = await tx.stock.findFirst({
          where: { warehouseId: transfer.destinationWarehouseId, productId: matchingItem.productId, businessId },
        });

        if (!destStock) {
          destStock = await tx.stock.create({
            data: {
              businessId,
              warehouseId: transfer.destinationWarehouseId,
              productId: matchingItem.productId,
              quantity: 0,
            },
          });
        }

        const stockBefore = Number(destStock.quantity || 0);
        const stockAfter = stockBefore + currentReceivedQty;

        await tx.stock.update({
          where: { id: destStock.id },
          data: { quantity: stockAfter },
        });

        // Create Kardex entry in DESTINATION warehouse (INGRESO_POR_TRASPASO)
        await tx.stockMovement.create({
          data: {
            businessId,
            warehouseId: transfer.destinationWarehouseId,
            productId: matchingItem.productId,
            userId: receivedByUserId,
            movementType: 'INGRESO_POR_TRASPASO',
            quantity: currentReceivedQty,
            stockBefore,
            stockAfter,
            unitCost: 0,
            totalCost: 0,
            referenceType: 'STOCK_TRANSFER',
            referenceId: transfer.id,
            referenceNumber: transfer.transferNumber,
            notes: `Ingreso por recepción de traspaso ${transfer.transferNumber} en depósito destino`,
          },
        });

        // Accumulate receivedQty on TransferRequestItem if linked
        if (matchingItem.transferRequestItemId) {
          await tx.transferRequestItem.update({
            where: { id: matchingItem.transferRequestItemId },
            data: {
              receivedQty: { increment: currentReceivedQty },
            },
          });
        }
      }

      // Calculate total cumulative received across ALL items of transfer
      for (const tItem of transfer.items) {
        const prevQty = prevReceivedMap.get(tItem.productId) || 0;
        const currentInput = inputItems.find((i) => i.stockTransferItemId === tItem.id);
        const addedQty = currentInput ? Number(currentInput.receivedQty || 0) : 0;
        totalTransferCumReceivedQty += (prevQty + addedQty);
      }

      // Determine final transfer status: RECEIVED if full cumulative received, else stays IN_TRANSIT
      const isFullyReceived = totalTransferCumReceivedQty >= totalTransferSentQty;
      const updatedStatus = isFullyReceived ? 'RECEIVED' : 'IN_TRANSIT';

      const updatedTransfer = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: updatedStatus,
          receivedByUserId,
          arrivalDate: isFullyReceived ? new Date() : undefined,
        },
        include: {
          originWarehouse: { select: { id: true, name: true, code: true } },
          destinationWarehouse: { select: { id: true, name: true, code: true } },
          dispatchedByUser: { select: { id: true, name: true, email: true } },
          receivedByUser: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, barcode: true, unitOfMeasure: true } },
            },
          },
          receipts: {
            include: {
              receivedByUser: { select: { id: true, name: true } },
              items: {
                include: {
                  product: { select: { id: true, name: true, sku: true } },
                },
              },
            },
          },
        },
      });

      return updatedTransfer;
    });
  }
}
