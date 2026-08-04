import { promotionRepository } from '../repositories/promotion.repository';
import { productRepository } from '../repositories/product.repository';
import { AppError } from '../utils/appError';

export class PromotionService {
  async getAll(businessId: string, productId?: string) {
    return promotionRepository.findAll(businessId, productId);
  }

  async getById(id: string, businessId: string) {
    const promo = await promotionRepository.findById(id, businessId);
    if (!promo) {
      throw new AppError('Promoción no encontrada', 404);
    }
    return promo;
  }

  async create(
    businessId: string,
    data: {
      name: string;
      type: 'TWO_FOR_ONE' | 'SECOND_UNIT_DISCOUNT' | 'SPECIAL_PACK';
      productId: string;
      minQuantity?: number;
      discountPercentage?: number | null;
      specialPrice?: number | null;
      isActive?: boolean;
    }
  ) {
    if (!data.name || !data.name.trim()) {
      throw new AppError('El nombre de la promoción es obligatorio', 400);
    }
    if (!data.productId) {
      throw new AppError('El producto es obligatorio', 400);
    }
    if (!['TWO_FOR_ONE', 'SECOND_UNIT_DISCOUNT', 'SPECIAL_PACK'].includes(data.type)) {
      throw new AppError('Tipo de promoción no válido', 400);
    }

    const minQty = Number(data.minQuantity) || 2;
    if (minQty < 1) {
      throw new AppError('La cantidad mínima debe ser mayor o igual a 1', 400);
    }

    if (data.type === 'SECOND_UNIT_DISCOUNT') {
      const disc = Number(data.discountPercentage) || 0;
      if (disc <= 0 || disc > 100) {
        throw new AppError('El porcentaje de descuento debe estar entre 1% y 100%', 400);
      }
    }

    if (data.type === 'SPECIAL_PACK') {
      const packPrice = Number(data.specialPrice) || 0;
      if (packPrice <= 0) {
        throw new AppError('El precio especial del pack debe ser mayor a cero', 400);
      }
    }

    const product = await productRepository.findById(data.productId, businessId);
    if (!product) {
      throw new AppError('El producto especificado no existe o no pertenece a esta empresa', 400);
    }

    return promotionRepository.create({
      businessId,
      name: data.name.trim(),
      type: data.type,
      productId: data.productId,
      minQuantity: minQty,
      discountPercentage: data.discountPercentage ? Number(data.discountPercentage) : null,
      specialPrice: data.specialPrice ? Number(data.specialPrice) : null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    });
  }

  async update(
    id: string,
    businessId: string,
    data: {
      name?: string;
      type?: 'TWO_FOR_ONE' | 'SECOND_UNIT_DISCOUNT' | 'SPECIAL_PACK';
      minQuantity?: number;
      discountPercentage?: number | null;
      specialPrice?: number | null;
      isActive?: boolean;
    }
  ) {
    const existing = await promotionRepository.findById(id, businessId);
    if (!existing) {
      throw new AppError('Promoción no encontrada', 404);
    }

    if (data.minQuantity !== undefined && Number(data.minQuantity) < 1) {
      throw new AppError('La cantidad mínima debe ser mayor o igual a 1', 400);
    }

    if (data.type === 'SECOND_UNIT_DISCOUNT' || (existing.type === 'SECOND_UNIT_DISCOUNT' && data.discountPercentage !== undefined)) {
      const disc = Number(data.discountPercentage);
      if (disc <= 0 || disc > 100) {
        throw new AppError('El porcentaje de descuento debe estar entre 1% y 100%', 400);
      }
    }

    await promotionRepository.update(id, businessId, data);
    return promotionRepository.findById(id, businessId);
  }

  async delete(id: string, businessId: string) {
    const existing = await promotionRepository.findById(id, businessId);
    if (!existing) {
      throw new AppError('Promoción no encontrada', 404);
    }

    await promotionRepository.delete(id, businessId);
    return { message: 'Promoción eliminada correctamente' };
  }
}

export const promotionService = new PromotionService();
