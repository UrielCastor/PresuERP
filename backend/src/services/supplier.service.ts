import { SupplierRepository } from '../repositories/supplier.repository';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { ConflictError, NotFoundError } from '../utils/appError';
import { prisma } from '../config/db';

export class SupplierService {
  private supplierRepo = new SupplierRepository();
  private activityLogRepo = new ActivityLogRepository();

  async list(businessId: string) {
    return this.supplierRepo.list(businessId);
  }

  async findById(id: string, businessId: string) {
    const supplier = await this.supplierRepo.findById(id, businessId);
    if (!supplier) {
      throw new NotFoundError('Proveedor no encontrado');
    }
    return supplier;
  }

  async create(data: any, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    // Check duplicate name
    const existingName = await this.supplierRepo.findByName(data.name, operator.businessId);
    if (existingName) {
      throw new ConflictError('Ya existe un proveedor con este nombre en la empresa');
    }

    // Check duplicate taxId if provided
    if (data.taxId) {
      const existingTax = await this.supplierRepo.findByTaxId(data.taxId, operator.businessId);
      if (existingTax) {
        throw new ConflictError('Ya existe un proveedor con este Identificador Fiscal (taxId) en la empresa');
      }
    }

    const supplier = await this.supplierRepo.create({
      name: data.name,
      taxId: data.taxId || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      contactName: data.contactName || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      businessId: operator.businessId,
    });

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Supplier',
      entityId: supplier.id,
      actionType: 'CREATE',
      previousValues: null,
      newValues: JSON.stringify(supplier),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return supplier;
  }

  async update(id: string, data: any, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    const existing = await this.supplierRepo.findById(id, operator.businessId);
    if (!existing) {
      throw new NotFoundError('Proveedor no encontrado');
    }

    // Check duplicate name
    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      const existingName = await this.supplierRepo.findByName(data.name, operator.businessId);
      if (existingName && existingName.id !== id) {
        throw new ConflictError('Ya existe otro proveedor con este nombre en la empresa');
      }
    }

    // Check duplicate taxId if provided
    if (data.taxId && data.taxId !== existing.taxId) {
      const existingTax = await this.supplierRepo.findByTaxId(data.taxId, operator.businessId);
      if (existingTax && existingTax.id !== id) {
        throw new ConflictError('Ya existe otro proveedor con este Identificador Fiscal (taxId) en la empresa');
      }
    }

    const updated = await this.supplierRepo.update(id, operator.businessId, {
      name: data.name,
      taxId: data.taxId !== undefined ? data.taxId : existing.taxId,
      email: data.email !== undefined ? data.email : existing.email,
      phone: data.phone !== undefined ? data.phone : existing.phone,
      address: data.address !== undefined ? data.address : existing.address,
      contactName: data.contactName !== undefined ? data.contactName : existing.contactName,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
    });

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Supplier',
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
    const existing = await this.supplierRepo.findById(id, operator.businessId);
    if (!existing) {
      throw new NotFoundError('Proveedor no encontrado');
    }

    const [productsCount, purchasesCount] = await Promise.all([
      prisma.product.count({ where: { supplierId: id } }),
      prisma.purchase.count({ where: { supplierId: id } }),
    ]);

    if (productsCount > 0 || purchasesCount > 0) {
      throw new ConflictError(
        'No se puede eliminar el proveedor porque posee productos o compras asociadas. Considere inactivarlo.'
      );
    }

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Supplier',
      entityId: id,
      actionType: 'DELETE',
      previousValues: JSON.stringify(existing),
      newValues: null,
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    await this.supplierRepo.delete(id, operator.businessId);
    return { id };
  }
}
