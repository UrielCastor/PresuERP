import { prisma } from '../config/db';

export class StockRepository {
  async findAll(businessId: string) {
    // For global find all, we might want to just return real stocks, 
    // or return everything. Usually findAll in stock is rarely used raw.
    // Let's implement LEFT JOIN for findAll as well (per product, summing stock or listing all warehouse combinations)
    // Actually, findByWarehouse is the main one used in the UI. 
    return (prisma.stock as any).findMany({
      where: { businessId },
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: {
        product: { name: 'asc' },
      },
    });
  }

  async findByWarehouse(warehouseId: string, businessId: string) {
    const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, businessId } });
    if (!warehouse) return [];

    const products = await prisma.product.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: {
        stocks: {
          where: { warehouseId },
        },
      },
      orderBy: { name: 'asc' }
    });

    return products.map(p => {
      const stock = p.stocks?.[0];
      const { stocks, ...cleanProduct } = p;
      if (stock) {
        return {
          ...stock,
          product: cleanProduct,
          warehouse
        };
      }
      return {
        id: `virtual_${p.id}_${warehouseId}`,
        businessId,
        warehouseId,
        productId: p.id,
        quantity: 0,
        reservedQuantity: 0,
        minimumStock: 0,
        maximumStock: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: cleanProduct,
        warehouse
      };
    });
  }

  async findByProduct(productId: string, businessId: string) {
    return (prisma.stock as any).findMany({
      where: { productId, businessId },
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: {
        warehouse: { name: 'asc' },
      },
    });
  }

  async findOne(id: string, businessId: string) {
    return (prisma.stock as any).findFirst({
      where: { id, businessId },
      include: {
        product: true,
        warehouse: true,
      },
    });
  }

  async findByWarehouseAndProduct(warehouseId: string, productId: string, businessId: string) {
    return (prisma.stock as any).findUnique({
      where: {
        warehouseId_productId_businessId: {
          warehouseId,
          productId,
          businessId,
        },
      },
      include: {
        product: true,
        warehouse: true,
      },
    });
  }

  async create(data: {
    warehouseId: string;
    productId: string;
    quantity?: number;
    minimumStock?: number;
    maximumStock?: number;
    reservedQuantity?: number;
    businessId: string;
  }) {
    return (prisma.stock as any).create({
      data: data as any,
    });
  }

  async update(
    id: string,
    businessId: string,
    data: {
      quantity?: number;
      minimumStock?: number;
      maximumStock?: number;
      reservedQuantity?: number;
    }
  ) {
    return (prisma.stock as any).update({
      where: { id },
      data: data as any,
    });
  }

  async increase(id: string, amount: number) {
    return (prisma.stock as any).update({
      where: { id },
      data: {
        quantity: { increment: amount },
      } as any,
    });
  }

  async decrease(id: string, amount: number) {
    return (prisma.stock as any).update({
      where: { id },
      data: {
        quantity: { decrement: amount },
      } as any,
    });
  }

  async setQuantity(id: string, quantity: number) {
    return (prisma.stock as any).update({
      where: { id },
      data: { quantity } as any,
    });
  }

  async exists(warehouseId: string, productId: string, businessId: string) {
    const count = await (prisma.stock as any).count({
      where: { warehouseId, productId, businessId },
    });
    return count > 0;
  }
}
