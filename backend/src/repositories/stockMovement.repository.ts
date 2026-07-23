import { prisma } from '../config/db';

export interface StockMovementFilters {
  productId?: string;
  warehouseId?: string;
  userId?: string;
  movementType?: string;
  referenceType?: string;
  referenceNumber?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
}

export class StockMovementRepository {
  async findAll(businessId: string, filters: StockMovementFilters = {}) {
    const where: any = { businessId };

    if (filters.productId) where.productId = filters.productId;
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.movementType) where.movementType = filters.movementType;
    if (filters.referenceType) where.referenceType = filters.referenceType;
    if (filters.referenceNumber) {
      where.referenceNumber = { contains: filters.referenceNumber, mode: 'insensitive' };
    }

    // Date filters
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    // Global Search (Product name, SKU, barcode, warehouse name, user name, reason, notes, referenceNumber)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      where.OR = [
        { product: { name: { contains: filters.search, mode: 'insensitive' } } },
        { product: { sku: { contains: filters.search, mode: 'insensitive' } } },
        { product: { barcode: { contains: filters.search, mode: 'insensitive' } } },
        { warehouse: { name: { contains: filters.search, mode: 'insensitive' } } },
        { user: { name: { contains: filters.search, mode: 'insensitive' } } },
        { reason: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
        { referenceNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      (prisma.stockMovement as any).findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, barcode: true } },
          warehouse: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma.stockMovement as any).count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByProduct(productId: string, businessId: string, filters: StockMovementFilters = {}) {
    return this.findAll(businessId, { ...filters, productId });
  }

  async findByWarehouse(warehouseId: string, businessId: string, filters: StockMovementFilters = {}) {
    return this.findAll(businessId, { ...filters, warehouseId });
  }

  async findOne(id: string, businessId: string) {
    return (prisma.stockMovement as any).findFirst({
      where: { id, businessId },
      include: {
        product: { select: { id: true, name: true, sku: true, barcode: true } },
        warehouse: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async create(
    data: {
      businessId: string;
      warehouseId: string;
      productId: string;
      userId: string;
      movementType: string;
      quantity: number;
      stockBefore: number;
      stockAfter: number;
      unitCost?: number;
      totalCost?: number;
      referenceType?: string | null;
      referenceId?: string | null;
      referenceNumber?: string | null;
      reason?: string | null;
      notes?: string | null;
    },
    tx?: any
  ) {
    const client = tx || prisma;
    return (client.stockMovement as any).create({
      data: data as any,
    });
  }
}
