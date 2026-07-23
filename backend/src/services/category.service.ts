import { CategoryRepository } from '../repositories/category.repository';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { ConflictError, NotFoundError } from '../utils/appError';
import { prisma } from '../config/db';

export class CategoryService {
  private categoryRepo = new CategoryRepository();
  private activityLogRepo = new ActivityLogRepository();

  async list(businessId: string) {
    return this.categoryRepo.list(businessId);
  }

  async findById(id: string, businessId: string) {
    const category = await this.categoryRepo.findById(id, businessId);
    if (!category) {
      throw new NotFoundError('Categoría no encontrada');
    }
    return category;
  }

  async create(data: any, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    const exists = await this.categoryRepo.findByName(data.name, operator.businessId);
    if (exists) {
      throw new ConflictError('Ya existe una categoría con este nombre');
    }

    const category = await this.categoryRepo.create({
      name: data.name,
      description: data.description,
      businessId: operator.businessId,
    });

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Category',
      entityId: category.id,
      actionType: 'CREATE',
      previousValues: null,
      newValues: JSON.stringify(category),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return category;
  }

  async update(id: string, data: any, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    if (!data.changeReason) {
      throw new ConflictError('El motivo del cambio es obligatorio');
    }

    const existing = await this.categoryRepo.findById(id, operator.businessId);
    if (!existing) {
      throw new NotFoundError('Categoría no encontrada');
    }

    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      const exists = await this.categoryRepo.findByName(data.name, operator.businessId);
      if (exists && exists.id !== id) {
        throw new ConflictError('Ya existe una categoría con este nombre');
      }
    }

    const updated = await this.categoryRepo.update(id, operator.businessId, {
      name: data.name,
      description: data.description,
      status: data.status,
    });

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Category',
      entityId: id,
      actionType: 'UPDATE',
      previousValues: JSON.stringify(existing),
      newValues: JSON.stringify({ ...updated, changeReason: data.changeReason }),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return updated;
  }

  async delete(id: string, changeReason: string, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    if (!changeReason) {
      throw new ConflictError('El motivo de la eliminación es obligatorio');
    }
    const existing = await this.categoryRepo.findById(id, operator.businessId);
    if (!existing) {
      throw new NotFoundError('Categoría no encontrada');
    }

    const productsCount = await prisma.product.count({ where: { categoryId: id } });
    if (productsCount > 0) {
      // Perform logical delete: status = INACTIVE
      const updated = await this.categoryRepo.update(id, operator.businessId, { status: 'INACTIVE' });

      await this.activityLogRepo.log({
        userId: operator.id,
        businessId: operator.businessId,
        entityName: 'Category',
        entityId: id,
        actionType: 'DELETE_LOGICAL',
        previousValues: JSON.stringify(existing),
        newValues: JSON.stringify({ ...updated, changeReason }),
        ipAddress: ip || null,
        userAgent: userAgent || null,
      });

      throw new ConflictError('La categoría tiene productos asociados. Debe desactivarla o mover los productos antes de eliminar.');
    }

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Category',
      entityId: id,
      actionType: 'DELETE',
      previousValues: JSON.stringify(existing),
      newValues: JSON.stringify({ changeReason }),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    await this.categoryRepo.delete(id, operator.businessId);
    return { id, isPhysical: true };
  }
}
