import { productPriceTierRepository } from '../repositories/productPriceTier.repository';
import { productRepository } from '../repositories/product.repository';
import { AppError } from '../utils/appError';

export class ProductPriceTierService {
  async getAll(businessId: string, productId?: string) {
    return productPriceTierRepository.findAll(businessId, productId);
  }

  async getById(id: string, businessId: string) {
    const tier = await productPriceTierRepository.findById(id, businessId);
    if (!tier) {
      throw new AppError('Regla de precio por cantidad no encontrada', 404);
    }
    return tier;
  }

  async create(
    businessId: string,
    data: {
      productId: string;
      minQuantity: number;
      price: number;
      isActive?: boolean;
    }
  ) {
    if (!data.productId) {
      throw new AppError('El producto es obligatorio', 400);
    }
    if (data.minQuantity === undefined || Number(data.minQuantity) < 1) {
      throw new AppError('La cantidad mínima debe ser mayor o igual a 1', 400);
    }
    if (data.price === undefined || Number(data.price) <= 0) {
      throw new AppError('El precio unitario debe ser mayor a cero', 400);
    }

    const product = await productRepository.findById(data.productId, businessId);
    if (!product) {
      throw new AppError('El producto especificado no existe o no pertenece a esta empresa', 400);
    }

    const duplicate = await productPriceTierRepository.findDuplicate(
      businessId,
      data.productId,
      Number(data.minQuantity)
    );
    if (duplicate) {
      throw new AppError('Ya existe una regla de precio por cantidad con la misma cantidad mínima para este producto', 400);
    }

    return productPriceTierRepository.create({
      businessId,
      productId: data.productId,
      minQuantity: Number(data.minQuantity),
      price: Number(data.price),
      isActive: data.isActive,
    });
  }

  async update(
    id: string,
    businessId: string,
    data: {
      minQuantity?: number;
      price?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await productPriceTierRepository.findById(id, businessId);
    if (!existing) {
      throw new AppError('Regla de precio por cantidad no encontrada', 404);
    }

    if (data.minQuantity !== undefined && Number(data.minQuantity) < 1) {
      throw new AppError('La cantidad mínima debe ser mayor o igual a 1', 400);
    }
    if (data.price !== undefined && Number(data.price) <= 0) {
      throw new AppError('El precio unitario debe ser mayor a cero', 400);
    }

    const targetMinQty = data.minQuantity !== undefined ? Number(data.minQuantity) : Number(existing.minQuantity);
    const duplicate = await productPriceTierRepository.findDuplicate(
      businessId,
      existing.productId,
      targetMinQty,
      id
    );
    if (duplicate) {
      throw new AppError('Ya existe una regla de precio por cantidad con la misma cantidad mínima para este producto', 400);
    }

    await productPriceTierRepository.update(id, businessId, {
      ...(data.minQuantity !== undefined ? { minQuantity: Number(data.minQuantity) } : {}),
      ...(data.price !== undefined ? { price: Number(data.price) } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    });

    return productPriceTierRepository.findById(id, businessId);
  }

  async delete(id: string, businessId: string) {
    const existing = await productPriceTierRepository.findById(id, businessId);
    if (!existing) {
      throw new AppError('Regla de precio por cantidad no encontrada', 404);
    }
    await productPriceTierRepository.delete(id, businessId);
    return { success: true, message: 'Regla de precio por cantidad eliminada' };
  }
}

export const productPriceTierService = new ProductPriceTierService();
