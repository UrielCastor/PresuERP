import { prisma } from '../config/db';
import { TransferRequestStatus } from '@prisma/client';

export interface TransferRequestFilterInput {
  status?: TransferRequestStatus;
  originWarehouseId?: string;
  destinationWarehouseId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export interface CreateTransferRequestItemInput {
  productId: string;
  quantity: number;
  notes?: string;
}

export interface CreateTransferRequestInput {
  originWarehouseId: string;
  destinationWarehouseId: string;
  notes?: string;
  items: CreateTransferRequestItemInput[];
}

export interface UpdateTransferRequestInput {
  originWarehouseId?: string;
  destinationWarehouseId?: string;
  notes?: string;
  items?: CreateTransferRequestItemInput[];
}

export class TransferRequestRepository {
  /**
   * Generates the next sequential request number for a business.
   * Format: PED-000001, PED-000002, etc.
   */
  private async generateNextRequestNumber(tx: any, businessId: string): Promise<string> {
    const lastRequest = await tx.transferRequest.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      select: { requestNumber: true },
    });

    let nextSeq = 1;
    if (lastRequest && lastRequest.requestNumber) {
      const parts = lastRequest.requestNumber.split('-');
      if (parts.length === 2 && !isNaN(parseInt(parts[1], 10))) {
        nextSeq = parseInt(parts[1], 10) + 1;
      }
    }

    const paddedSeq = String(nextSeq).padStart(6, '0');
    return `PED-${paddedSeq}`;
  }

  async list(businessId: string, filters: TransferRequestFilterInput = {}) {
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
        { requestNumber: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    return prisma.transferRequest.findMany({
      where,
      include: {
        originWarehouse: { select: { id: true, name: true, code: true } },
        destinationWarehouse: { select: { id: true, name: true, code: true } },
        requestedByUser: { select: { id: true, name: true, email: true } },
        approvedByUser: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                unitOfMeasure: true,
              },
            },
          },
        },
        _count: { select: { items: true, stockTransfers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, businessId: string) {
    return prisma.transferRequest.findFirst({
      where: { id, businessId },
      include: {
        originWarehouse: { select: { id: true, name: true, code: true } },
        destinationWarehouse: { select: { id: true, name: true, code: true } },
        requestedByUser: { select: { id: true, name: true, email: true } },
        approvedByUser: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                unitOfMeasure: true,
              },
            },
          },
        },
        stockTransfers: {
          select: {
            id: true,
            transferNumber: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async create(businessId: string, requestedByUserId: string, input: CreateTransferRequestInput) {
    return prisma.$transaction(async (tx) => {
      const requestNumber = await this.generateNextRequestNumber(tx, businessId);

      const request = await tx.transferRequest.create({
        data: {
          businessId,
          requestNumber,
          originWarehouseId: input.originWarehouseId,
          destinationWarehouseId: input.destinationWarehouseId,
          requestedByUserId,
          status: 'DRAFT',
          notes: input.notes || null,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              requestedQty: item.quantity,
              notes: item.notes || null,
            })),
          },
        },
        include: {
          originWarehouse: { select: { id: true, name: true, code: true } },
          destinationWarehouse: { select: { id: true, name: true, code: true } },
          requestedByUser: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, barcode: true, unitOfMeasure: true },
              },
            },
          },
        },
      });

      return request;
    });
  }

  async update(id: string, businessId: string, input: UpdateTransferRequestInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Delete existing items if new items provided
      if (input.items && input.items.length > 0) {
        await tx.transferRequestItem.deleteMany({
          where: { transferRequestId: id },
        });
      }

      // 2. Update request header and recreate items
      const updateData: any = {};
      if (input.originWarehouseId) updateData.originWarehouseId = input.originWarehouseId;
      if (input.destinationWarehouseId) updateData.destinationWarehouseId = input.destinationWarehouseId;
      if (input.notes !== undefined) updateData.notes = input.notes;

      if (input.items && input.items.length > 0) {
        updateData.items = {
          create: input.items.map((item) => ({
            productId: item.productId,
            requestedQty: item.quantity,
            notes: item.notes || null,
          })),
        };
      }

      const updatedRequest = await tx.transferRequest.update({
        where: { id },
        data: updateData,
        include: {
          originWarehouse: { select: { id: true, name: true, code: true } },
          destinationWarehouse: { select: { id: true, name: true, code: true } },
          requestedByUser: { select: { id: true, name: true, email: true } },
          approvedByUser: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, barcode: true, unitOfMeasure: true },
              },
            },
          },
        },
      });

      return updatedRequest;
    });
  }

  async updateStatus(id: string, businessId: string, status: TransferRequestStatus) {
    return prisma.transferRequest.update({
      where: { id },
      data: { status },
      include: {
        originWarehouse: { select: { id: true, name: true, code: true } },
        destinationWarehouse: { select: { id: true, name: true, code: true } },
        requestedByUser: { select: { id: true, name: true, email: true } },
        approvedByUser: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, barcode: true, unitOfMeasure: true },
            },
          },
        },
      },
    });
  }

  /**
   * Atomic approval transaction:
   * 1. Updates approvedQty for each TransferRequestItem.
   * 2. Creates ACTIVE StockReservation on originWarehouseId for each approved item (approvedQty > 0).
   * 3. Updates TransferRequest header (status = APPROVED or PARTIAL, approvedByUserId, notes).
   */
  async approve(
    id: string,
    businessId: string,
    approvedByUserId: string,
    items: { transferRequestItemId: string; approvedQty: number }[],
    newStatus: TransferRequestStatus,
    notes?: string
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Update items approvedQty
      for (const item of items) {
        await tx.transferRequestItem.update({
          where: { id: item.transferRequestItemId },
          data: { approvedQty: item.approvedQty },
        });
      }

      // 2. Fetch originWarehouseId and item productIds
      const request = await tx.transferRequest.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!request) {
        throw new Error('Pedido no encontrado en transacción');
      }

      // 3. Create active stock reservations on origin warehouse for items with approvedQty > 0
      for (const item of request.items) {
        const approvedQtyNum = Number(item.approvedQty || 0);
        if (approvedQtyNum > 0) {
          await tx.stockReservation.create({
            data: {
              businessId,
              warehouseId: request.originWarehouseId, // Must be origin warehouse
              productId: item.productId,
              transferRequestId: id,
              quantity: approvedQtyNum,
              status: 'ACTIVE',
            },
          });
        }
      }

      // 4. Update request status & header
      const updatedRequest = await tx.transferRequest.update({
        where: { id },
        data: {
          status: newStatus,
          approvedByUserId,
          notes: notes !== undefined ? notes : request.notes,
        },
        include: {
          originWarehouse: { select: { id: true, name: true, code: true } },
          destinationWarehouse: { select: { id: true, name: true, code: true } },
          requestedByUser: { select: { id: true, name: true, email: true } },
          approvedByUser: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, barcode: true, unitOfMeasure: true },
              },
            },
          },
          stockReservations: true,
        },
      });

      return updatedRequest;
    });
  }

  /**
   * Atomic rejection transaction:
   * Updates TransferRequest status to REJECTED and records approvedByUserId & notes.
   */
  async reject(id: string, businessId: string, rejectedByUserId: string, notes?: string) {
    return prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.transferRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          approvedByUserId: rejectedByUserId,
          notes: notes || undefined,
        },
        include: {
          originWarehouse: { select: { id: true, name: true, code: true } },
          destinationWarehouse: { select: { id: true, name: true, code: true } },
          requestedByUser: { select: { id: true, name: true, email: true } },
          approvedByUser: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, barcode: true, unitOfMeasure: true },
              },
            },
          },
        },
      });

      return updatedRequest;
    });
  }
}
