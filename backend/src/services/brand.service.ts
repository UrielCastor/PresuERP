import { BrandRepository } from '../repositories/brand.repository';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { ConflictError, NotFoundError } from '../utils/appError';
import { prisma } from '../config/db';

export class BrandService {
  private brandRepo = new BrandRepository();
  private activityLogRepo = new ActivityLogRepository();

  async list(businessId: string) {
    return this.brandRepo.list(businessId);
  }

  async findById(id: string, businessId: string) {
    const brand = await this.brandRepo.findById(id, businessId);
    if (!brand) {
      throw new NotFoundError('Marca no encontrada');
    }
    return brand;
  }

  async create(data: any, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    const exists = await this.brandRepo.findByName(data.name, operator.businessId);
    if (exists) {
      throw new ConflictError('Ya existe una marca con este nombre');
    }

    const brand = await this.brandRepo.create({
      name: data.name,
      description: data.description,
      businessId: operator.businessId,
    });

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Brand',
      entityId: brand.id,
      actionType: 'CREATE',
      previousValues: null,
      newValues: JSON.stringify(brand),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return brand;
  }

  async update(id: string, data: any, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    const existing = await this.brandRepo.findById(id, operator.businessId);
    if (!existing) {
      throw new NotFoundError('Marca no encontrada');
    }

    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      const exists = await this.brandRepo.findByName(data.name, operator.businessId);
      if (exists && exists.id !== id) {
        throw new ConflictError('Ya existe una marca con este nombre');
      }
    }

    const updated = await this.brandRepo.update(id, operator.businessId, {
      name: data.name,
      description: data.description,
    });

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Brand',
      entityId: id,
      actionType: 'UPDATE',
      previousValues: JSON.stringify(existing),
      newValues: JSON.stringify(updated),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return updated;
  }

  async delete(id: string, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    const existing = await this.brandRepo.findById(id, operator.businessId);
    if (!existing) {
      throw new NotFoundError('Marca no encontrada');
    }

    const productsCount = await prisma.product.count({ where: { brandId: id } });
    if (productsCount > 0) {
      throw new ConflictError('No se puede eliminar la marca porque tiene productos asociados');
    }

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Brand',
      entityId: id,
      actionType: 'DELETE',
      previousValues: JSON.stringify(existing),
      newValues: null,
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    await this.brandRepo.delete(id, operator.businessId);
    return { id };
  }
}
