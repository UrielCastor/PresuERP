import { prisma } from '../config/db';

export interface CreateTransferItemInput {
  productId: string;
  quantity: number;
}

export interface CreateTransferInput {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  comments?: string;
  items: CreateTransferItemInput[];
}

export class WarehouseTransferRepository {
  async list(businessId: string) {
    return prisma.warehouseTransfer.findMany({
      where: { businessId },
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
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, businessId: string) {
    return prisma.warehouseTransfer.findFirst({
      where: { id, businessId },
      include: {
        sourceWarehouse: { select: { id: true, name: true, code: true, status: true } },
        targetWarehouse: { select: { id: true, name: true, code: true, status: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, purchasePrice: true } }
          }
        }
      },
    });
  }

  async create(businessId: string, createdById: string, input: CreateTransferInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Create main transfer record
      const transfer = await tx.warehouseTransfer.create({
        data: {
          businessId,
          sourceWarehouseId: input.sourceWarehouseId,
          targetWarehouseId: input.targetWarehouseId,
          comments: input.comments,
          status: 'PENDING', // Default starting status is PENDING
          createdById,
        },
      });

      // 2. Create the child items
      const itemsData = input.items.map((item) => ({
        transferId: transfer.id,
        productId: item.productId,
        quantity: item.quantity,
      }));

      await tx.warehouseTransferItem.createMany({
        data: itemsData,
      });

      // 3. Return full record
      return tx.warehouseTransfer.findUnique({
        where: { id: transfer.id },
        include: {
          sourceWarehouse: true,
          targetWarehouse: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });
  }

  async updateStatus(id: string, businessId: string, status: string) {
    return prisma.warehouseTransfer.update({
      where: { id },
      data: { status },
      include: {
        sourceWarehouse: true,
        targetWarehouse: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }
}
