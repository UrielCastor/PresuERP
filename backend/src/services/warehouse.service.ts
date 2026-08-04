import { WarehouseRepository } from '../repositories/warehouse.repository';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { ConflictError, NotFoundError } from '../utils/appError';
import { prisma } from '../config/db';

export class WarehouseService {
  private warehouseRepo = new WarehouseRepository();
  private activityLogRepo = new ActivityLogRepository();

  async list(businessId: string, userId?: string) {
    const allWarehouses = await this.warehouseRepo.list(businessId);

    const user = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          include: { role: true }
        })
      : null;

    // Determine condition path and select appropriate warehouses
    let path = 'user filter';
    let finalWarehouses = [];

    if (!userId) {
      path = 'no userId provided (bypass)';
      finalWarehouses = allWarehouses;
    } else if (user?.isStaff) {
      path = 'global staff bypass';
      finalWarehouses = allWarehouses;
    } else if (user?.role?.name === 'Administrator') {
      path = 'local Administrator bypass';
      finalWarehouses = allWarehouses;
    } else {
      // Normal user filter
      const userWarehouses = await prisma.userWarehouse.findMany({
        where: { userId },
        select: { warehouseId: true },
      });
      const allowedIds = new Set(userWarehouses.map((uw) => uw.warehouseId));
      finalWarehouses = allWarehouses.filter((w) => allowedIds.has(w.id));
    }

    console.log(`[WarehouseService.list] AUDIT LOG:
- user.id: ${userId || 'N/A'}
- user.role.name: ${user?.role?.name || 'N/A'}
- user.isStaff: ${user?.isStaff || false}
- businessId: ${businessId}
- condicion: ${path}
- cantidad encontrada antes del filtro: ${allWarehouses.length}
- cantidad encontrada después del filtro: ${finalWarehouses.length}`);

    return finalWarehouses;
  }

  async findById(id: string, businessId: string) {
    const warehouse = await this.warehouseRepo.findById(id, businessId);
    if (!warehouse) {
      throw new NotFoundError('Depósito no encontrado');
    }
    return warehouse;
  }

  async create(data: any, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    // Check duplicate name
    const existingName = await this.warehouseRepo.findByName(data.name, operator.businessId);
    if (existingName) {
      throw new ConflictError('Ya existe un depósito con este nombre en la empresa');
    }

    // Check duplicate code if provided
    const dbCode = (data.code && data.code.trim() !== '') ? data.code.trim() : null;
    if (dbCode) {
      const existingCode = await this.warehouseRepo.findByCode(dbCode, operator.businessId);
      if (existingCode) {
        throw new ConflictError('Ya existe un depósito con este código en la empresa');
      }
    }

    // Single main warehouse policy
    const isMain = !!data.isMain;
    if (isMain) {
      await this.warehouseRepo.resetMain(operator.businessId);
    }

    const warehouse = await this.warehouseRepo.create({
      name: data.name,
      code: dbCode,
      description: data.description || null,
      address: data.address || null,
      managerName: data.managerName || null,
      phone: data.phone || null,
      email: data.email || null,
      isMain,
      status: data.status || 'ACTIVE',
      businessId: operator.businessId,
    });

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Warehouse',
      entityId: warehouse.id,
      actionType: 'CREATE',
      previousValues: null,
      newValues: JSON.stringify(warehouse),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return warehouse;
  }

  async update(id: string, data: any, operator: { id: string; businessId: string }, ip?: string, userAgent?: string) {
    const existingRaw = await this.warehouseRepo.findById(id, operator.businessId);
    if (!existingRaw) {
      throw new NotFoundError('Depósito no encontrado');
    }
    const existing = existingRaw as any;

    // Check duplicate name
    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      const existingName = await this.warehouseRepo.findByName(data.name, operator.businessId);
      if (existingName && existingName.id !== id) {
        throw new ConflictError('Ya existe otro depósito con este nombre en la empresa');
      }
    }

    // Check duplicate code if provided
    const dbCode = (data.code && data.code.trim() !== '') ? data.code.trim() : null;
    if (dbCode && dbCode !== existing.code) {
      const existingCode = await this.warehouseRepo.findByCode(dbCode, operator.businessId);
      if (existingCode && existingCode.id !== id) {
        throw new ConflictError('Ya existe otro depósito con este código en la empresa');
      }
    }

    // Single main warehouse policy
    const isMain = data.isMain !== undefined ? !!data.isMain : existing.isMain;
    if (isMain && !existing.isMain) {
      await this.warehouseRepo.resetMain(operator.businessId);
    }

    const updated = await this.warehouseRepo.update(id, operator.businessId, {
      name: data.name,
      code: data.code !== undefined ? dbCode : existing.code,
      description: data.description !== undefined ? data.description : existing.description,
      address: data.address !== undefined ? data.address : existing.address,
      managerName: data.managerName !== undefined ? data.managerName : existing.managerName,
      phone: data.phone !== undefined ? data.phone : existing.phone,
      email: data.email !== undefined ? data.email : existing.email,
      isMain,
      status: data.status !== undefined ? data.status : existing.status,
    });

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'Warehouse',
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
    const existingRaw = await this.warehouseRepo.findById(id, operator.businessId);
    if (!existingRaw) {
      throw new NotFoundError('Depósito no encontrado');
    }
    const existing = existingRaw as any;

    const hasRel = await this.warehouseRepo.hasRelations(id);

    if (hasRel) {
      // Logical delete (Change status to INACTIVE)
      const updated = await this.warehouseRepo.update(id, operator.businessId, {
        status: 'INACTIVE',
      });

      await this.activityLogRepo.log({
        userId: operator.id,
        businessId: operator.businessId,
        entityName: 'Warehouse',
        entityId: id,
        actionType: 'DELETE_LOGICAL',
        previousValues: JSON.stringify(existing),
        newValues: JSON.stringify({ ...updated, changeReason }),
        ipAddress: ip || null,
        userAgent: userAgent || null,
      });

      return {
        id,
        status: 'INACTIVE',
        matches: true,
        message: 'El depósito posee registros asociados en el sistema. Fue desactivado de forma lógica automáticamente para resguardar el historial.',
      };
    } else {
      // Physical delete
      await this.activityLogRepo.log({
        userId: operator.id,
        businessId: operator.businessId,
        entityName: 'Warehouse',
        entityId: id,
        actionType: 'DELETE',
        previousValues: JSON.stringify(existing),
        newValues: JSON.stringify({ changeReason }),
        ipAddress: ip || null,
        userAgent: userAgent || null,
      });

      await this.warehouseRepo.delete(id);

      return {
        id,
        status: 'DELETED',
        matches: false,
        message: 'Depósito eliminado físicamente con éxito.',
      };
    }
  }
}
