import { prisma } from '../config/db';

export class StockRepository {
  private mapProductSuppliers(product: any) {
    if (!product) return product;
    const suppliers = product.productSuppliers && product.productSuppliers.length > 0
      ? product.productSuppliers.map((ps: any) => ps.supplier || ps)
      : (product.supplier ? [product.supplier] : []);
    return {
      ...product,
      suppliers,
    };
  }

  async findAll(businessId: string) {
    const items = await (prisma.stock as any).findMany({
      where: { businessId },
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } },
            productSuppliers: {
              include: { supplier: { select: { id: true, name: true } } },
            },
          },
        },
        warehouse: true,
      },
      orderBy: {
        product: { name: 'asc' },
      },
    });
    return items.map((item: any) => ({
      ...item,
      product: item.product ? this.mapProductSuppliers(item.product) : null,
    }));
  }

  async findByWarehouse(warehouseId: string, businessId: string) {
    const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, businessId } });
    if (!warehouse) return [];

    const products = await prisma.product.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        productSuppliers: {
          include: { supplier: { select: { id: true, name: true } } },
        },
        stocks: {
          where: { warehouseId },
        },
      },
      orderBy: { name: 'asc' }
    });

    return products.map(p => {
      const stock = p.stocks?.[0];
      const { stocks, ...cleanProduct } = p;
      const mappedProduct = this.mapProductSuppliers(cleanProduct);

      if (stock) {
        return {
          ...stock,
          product: mappedProduct,
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
        product: mappedProduct,
        warehouse
      };
    });
  }

  private productInclude = {
    category: { select: { id: true, name: true } },
    supplier: { select: { id: true, name: true } },
    productSuppliers: {
      include: { supplier: { select: { id: true, name: true } } },
    },
  };

  async findByProduct(productId: string, businessId: string) {
    const items = await (prisma.stock as any).findMany({
      where: { productId, businessId },
      include: {
        product: {
          include: this.productInclude,
        },
        warehouse: true,
      },
      orderBy: {
        warehouse: { name: 'asc' },
      },
    });
    return items.map((item: any) => ({
      ...item,
      product: item.product ? this.mapProductSuppliers(item.product) : null,
    }));
  }

  async findOne(id: string, businessId: string) {
    const item = await (prisma.stock as any).findFirst({
      where: { id, businessId },
      include: {
        product: {
          include: this.productInclude,
        },
        warehouse: true,
      },
    });
    return item ? { ...item, product: item.product ? this.mapProductSuppliers(item.product) : null } : null;
  }

  async findByWarehouseAndProduct(warehouseId: string, productId: string, businessId: string) {
    const item = await (prisma.stock as any).findUnique({
      where: {
        warehouseId_productId_businessId: {
          warehouseId,
          productId,
          businessId,
        },
      },
      include: {
        product: {
          include: this.productInclude,
        },
        warehouse: true,
      },
    });
    return item ? { ...item, product: item.product ? this.mapProductSuppliers(item.product) : null } : null;
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
