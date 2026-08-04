import { prisma } from '../config/db';

export class ProductRepository {
  async list(businessId: string, supplierId?: string) {
    const products = await prisma.product.findMany({
      where: {
        businessId,
        ...(supplierId
          ? {
              OR: [
                { supplierId },
                { productSuppliers: { some: { supplierId } } },
              ],
            }
          : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        productSuppliers: {
          include: {
            supplier: { select: { id: true, name: true } },
          },
        },
        stocks: {
          select: { quantity: true, warehouseId: true },
        },
        priceListItems: {
          select: { priceListId: true, price: true, minQuantity: true },
        },
        priceTiers: {
          select: { id: true, minQuantity: true, price: true, isActive: true },
          orderBy: { minQuantity: 'asc' },
        },
        promotions: {
          select: { id: true, name: true, type: true, minQuantity: true, discountPercentage: true, specialPrice: true, isActive: true },
          where: { isActive: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return products.map((p) => this.mapProductSuppliers(p));
  }

  async findById(id: string, businessId: string) {
    const product = await prisma.product.findFirst({
      where: { id, businessId },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        productSuppliers: {
          include: {
            supplier: { select: { id: true, name: true } },
          },
        },
        stocks: {
          select: { quantity: true, warehouseId: true },
        },
        priceListItems: {
          select: { priceListId: true, price: true, minQuantity: true },
        },
        priceTiers: {
          select: { id: true, minQuantity: true, price: true, isActive: true },
          orderBy: { minQuantity: 'asc' },
        },
        promotions: {
          select: { id: true, name: true, type: true, minQuantity: true, discountPercentage: true, specialPrice: true, isActive: true },
          where: { isActive: true },
        },
      },
    });

    return product ? this.mapProductSuppliers(product) : null;
  }

  async findBySku(sku: string, businessId: string) {
    return prisma.product.findFirst({
      where: { sku, businessId },
    });
  }

  async create(data: {
    name: string;
    sku?: string | null;
    barcode?: string | null;
    categoryId: string;
    supplierId?: string | null;
    supplierIds?: string[];
    status: string;
    description?: string | null;
    purchasePrice?: number | null;
    salePrice?: number | null;
    profitMargin?: number | null;
    unitOfMeasure?: string;
    allowSaleWithoutStock?: boolean;
    businessId: string;
  }) {
    const { supplierIds, ...productData } = data;
    const effectiveSupplierIds = supplierIds || (data.supplierId ? [data.supplierId] : []);

    const primarySupplierId = effectiveSupplierIds.length > 0 ? effectiveSupplierIds[0] : (data.supplierId || null);

    const created = await prisma.product.create({
      data: {
        ...productData,
        supplierId: primarySupplierId,
        ...(effectiveSupplierIds.length > 0
          ? {
              productSuppliers: {
                create: effectiveSupplierIds.map((sId) => ({ supplierId: sId })),
              },
            }
          : {}),
      } as any,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        productSuppliers: {
          include: {
            supplier: { select: { id: true, name: true } },
          },
        },
        stocks: {
          select: { quantity: true, warehouseId: true },
        },
      },
    });

    return this.mapProductSuppliers(created);
  }

  async update(
    id: string,
    businessId: string,
    data: {
      name?: string;
      sku?: string | null;
      barcode?: string | null;
      categoryId?: string;
      supplierId?: string | null;
      supplierIds?: string[];
      status?: string;
      description?: string | null;
      purchasePrice?: number | null;
      salePrice?: number | null;
      profitMargin?: number | null;
      unitOfMeasure?: string;
      allowSaleWithoutStock?: boolean;
    }
  ) {
    const { supplierIds, ...productData } = data;

    if (supplierIds !== undefined) {
      await prisma.productSupplier.deleteMany({
        where: { productId: id },
      });

      if (supplierIds.length > 0) {
        await prisma.productSupplier.createMany({
          data: supplierIds.map((sId) => ({
            productId: id,
            supplierId: sId,
          })),
          skipDuplicates: true,
        });
        productData.supplierId = supplierIds[0];
      } else {
        productData.supplierId = null;
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: productData as any,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        productSuppliers: {
          include: {
            supplier: { select: { id: true, name: true } },
          },
        },
        stocks: {
          select: { quantity: true, warehouseId: true },
        },
      },
    });

    return this.mapProductSuppliers(updated);
  }

  async delete(id: string, businessId: string) {
    return prisma.product.delete({
      where: { id },
    });
  }

  // Helper function to synthesize supplier list if productSuppliers is present or fall back to single supplier relation
  private mapProductSuppliers(product: any) {
    let suppliers: { id: string; name: string }[] = [];

    if (product.productSuppliers && Array.isArray(product.productSuppliers) && product.productSuppliers.length > 0) {
      suppliers = product.productSuppliers
        .map((ps: any) => ps.supplier)
        .filter(Boolean);
    } else if (product.supplier) {
      suppliers = [product.supplier];
    }

    return {
      ...product,
      suppliers,
    };
  }
}

export const productRepository = new ProductRepository();
