import { prisma } from '../config/db';
import { BadRequestError, NotFoundError } from '../utils/appError';

export class PriceListRepository {
  async findAll(businessId: string) {
    await this.ensureDefaultExists(businessId);

    return prisma.priceList.findMany({
      where: { businessId },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async findByBusinessId(businessId: string) {
    return this.findAll(businessId);
  }

  async findById(id: string, businessId: string) {
    const list = await prisma.priceList.findFirst({
      where: { id, businessId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                salePrice: true,
                purchasePrice: true,
              },
            },
          },
          orderBy: { minQuantity: 'asc' },
        },
      },
    });

    if (!list) {
      throw new NotFoundError('Lista de precios no encontrada.');
    }

    return list;
  }

  async create(businessId: string, data: { name: string; description?: string | null; isActive?: boolean; isDefault?: boolean }) {
    // Check duplicate name
    const existing = await prisma.priceList.findFirst({
      where: { businessId, name: { equals: data.name, mode: 'insensitive' } },
    });

    if (existing) {
      throw new BadRequestError(`Ya existe una lista de precios con el nombre "${data.name}".`);
    }

    // If marked as isDefault, remove isDefault from existing default lists
    if (data.isDefault) {
      await prisma.priceList.updateMany({
        where: { businessId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.priceList.create({
      data: {
        name: data.name,
        description: data.description || null,
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
        businessId,
      },
      include: {
        _count: { select: { items: true } },
      },
    });
  }

  async update(id: string, businessId: string, data: { name?: string; description?: string | null; isActive?: boolean; isDefault?: boolean }) {
    const current = await this.findById(id, businessId);

    if (data.name && data.name.toLowerCase() !== current.name.toLowerCase()) {
      const existing = await prisma.priceList.findFirst({
        where: { businessId, name: { equals: data.name, mode: 'insensitive' }, id: { not: id } },
      });
      if (existing) {
        throw new BadRequestError(`Ya existe una lista de precios con el nombre "${data.name}".`);
      }
    }

    // If list is current default and user tries to uncheck default without appointing another
    if (current.isDefault && data.isDefault === false) {
      throw new BadRequestError('No se puede quitar el estado por defecto sin asignar otra lista como predeterminada.');
    }

    if (data.isDefault) {
      await prisma.priceList.updateMany({
        where: { businessId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.priceList.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      },
      include: {
        _count: { select: { items: true } },
      },
    });
  }

  async delete(id: string, businessId: string) {
    const current = await this.findById(id, businessId);

    if (current.isDefault) {
      throw new BadRequestError('No se puede eliminar la lista de precios por defecto.');
    }

    return prisma.priceList.delete({
      where: { id },
    });
  }

  async addItem(priceListId: string, businessId: string, data: { productId: string; price: number; minQuantity?: number }) {
    const list = await this.findById(priceListId, businessId);
    if (!list) {
      throw new NotFoundError('Lista de precios no encontrada.');
    }

    const product = await prisma.product.findFirst({
      where: { id: data.productId, businessId },
    });

    if (!product) {
      throw new NotFoundError('El producto no existe en esta empresa.');
    }

    if (data.price <= 0) {
      throw new BadRequestError('El precio especial debe ser mayor a cero.');
    }

    const minQty = data.minQuantity && data.minQuantity > 0 ? data.minQuantity : 1.0;

    // Check if entry already exists
    const existing = await prisma.priceListItem.findFirst({
      where: {
        priceListId,
        productId: data.productId,
        minQuantity: minQty,
      },
    });

    if (existing) {
      return prisma.priceListItem.update({
        where: { id: existing.id },
        data: { price: data.price },
        include: {
          product: { select: { id: true, name: true, sku: true, barcode: true, salePrice: true, purchasePrice: true } },
        },
      });
    }

    return prisma.priceListItem.create({
      data: {
        priceListId,
        productId: data.productId,
        price: data.price,
        minQuantity: minQty,
      },
      include: {
        product: { select: { id: true, name: true, sku: true, barcode: true, salePrice: true, purchasePrice: true } },
      },
    });
  }

  async updateItem(itemId: string, priceListId: string, businessId: string, data: { price?: number; minQuantity?: number }) {
    await this.findById(priceListId, businessId);

    const item = await prisma.priceListItem.findFirst({
      where: { id: itemId, priceListId },
    });

    if (!item) {
      throw new NotFoundError('El precio especial de la lista no existe.');
    }

    if (data.price !== undefined && data.price <= 0) {
      throw new BadRequestError('El precio especial debe ser mayor a cero.');
    }

    return prisma.priceListItem.update({
      where: { id: itemId },
      data: {
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.minQuantity !== undefined ? { minQuantity: data.minQuantity } : {}),
      },
      include: {
        product: { select: { id: true, name: true, sku: true, barcode: true, salePrice: true, purchasePrice: true } },
      },
    });
  }

  async deleteItem(itemId: string, priceListId: string, businessId: string) {
    await this.findById(priceListId, businessId);

    const item = await prisma.priceListItem.findFirst({
      where: { id: itemId, priceListId },
    });

    if (!item) {
      throw new NotFoundError('El precio especial de la lista no existe.');
    }

    return prisma.priceListItem.delete({
      where: { id: itemId },
    });
  }

  private async ensureDefaultExists(businessId: string) {
    const count = await prisma.priceList.count({ where: { businessId } });
    if (count === 0) {
      await prisma.priceList.create({
        data: {
          name: 'Lista Minorista (Base)',
          description: 'Lista de precios minorista por defecto',
          isDefault: true,
          isActive: true,
          businessId,
        },
      });
    }
  }
}
