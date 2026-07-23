import { UserRepository } from '../repositories/user.repository';
import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { ConflictError, NotFoundError, ForbiddenError } from '../utils/appError';
import { prisma } from '../config/db';
import bcrypt from 'bcryptjs';

const removePassword = (user: any) => {
  if (!user) return user;
  const { password, ...cleanUser } = user;
  return cleanUser;
};

export class UserService {
  private userRepo = new UserRepository();
  private activityLogRepo = new ActivityLogRepository();

  async list(businessId: string, page: number = 1, limit: number = 100) {
    const { items, total } = await this.userRepo.list(businessId, page, limit);
    return {
      items: items.map(removePassword),
      total,
    };
  }

  async findById(id: string, businessId: string) {
    const user = await this.userRepo.findById(id, businessId);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }
    return removePassword(user);
  }

  async create(data: any, operator: { id: string; role: string; businessId: string }, ip?: string, userAgent?: string) {
    // Only Administrator can assign roles
    if (operator.role !== 'Administrator') {
      throw new ForbiddenError('Solo el administrador puede asignar roles');
    }

    // Email uniqueness check
    const existingUser = await this.userRepo.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError('El email ya está en uso');
    }

    // Password encryption
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    // Force user creation in the operator's tenant
    const newUser = await this.userRepo.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      roleId: data.roleId,
      businessId: operator.businessId,
      isStaff: false,
    } as any);

    const userWithRole = await this.userRepo.findById(newUser.id, operator.businessId);

    // Register action in activity logs (exclude password plain or hash in details/values)
    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'User',
      entityId: newUser.id,
      actionType: 'CREATE_USER',
      previousValues: null,
      newValues: JSON.stringify(removePassword(userWithRole || newUser)),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return removePassword(userWithRole || newUser);
  }

  async update(id: string, data: any, operator: { id: string; role: string; businessId: string }, ip?: string, userAgent?: string) {
    const existing = await this.userRepo.findById(id, operator.businessId);
    if (!existing) {
      throw new NotFoundError('Usuario no encontrado');
    }

    // Role assignment check: only Administrator can change roles
    if (data.roleId && data.roleId !== existing.roleId) {
      if (operator.role !== 'Administrator') {
        throw new ForbiddenError('Solo el administrador puede asignar roles');
      }
    }

    // Email uniqueness check if email is modified
    if (data.email && data.email !== existing.email) {
      const emailUser = await this.userRepo.findByEmail(data.email);
      if (emailUser && emailUser.id !== id) {
        throw new ConflictError('El email ya está en uso');
      }
    }

    // Lockout prevention: do not deactivate the last active Administrator of the business
    if (data.isActive === false && existing.role?.name === 'Administrator' && existing.isActive) {
      const activeAdminsCount = await prisma.user.count({
        where: {
          businessId: operator.businessId,
          role: { name: 'Administrator' },
          isActive: true,
          id: { not: id },
        },
      });
      if (activeAdminsCount === 0) {
        throw new ConflictError('No se puede desactivar al único Administrador activo del negocio');
      }
    }

    // Build update object, excluding businessId
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.roleId !== undefined) updateData.roleId = data.roleId;
    if (data.isActive !== undefined) {
      // Prevent deactivating oneself
      if (id === operator.id && data.isActive === false) {
        throw new ConflictError('No puedes desactivar tu propio usuario');
      }
      updateData.isActive = data.isActive;
    }

    let isPasswordUpdate = false;
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(data.password, salt);
      isPasswordUpdate = true;
    }

    const updatedUser = await this.userRepo.update(id, operator.businessId, updateData);
    const updatedUserWithRole = await this.userRepo.findById(id, operator.businessId);

    // Register action in activity logs
    if (isPasswordUpdate) {
      await this.activityLogRepo.log({
        userId: operator.id,
        businessId: operator.businessId,
        entityName: 'User',
        entityId: id,
        actionType: 'UPDATE_PASSWORD',
        previousValues: JSON.stringify({ message: 'Contraseña previa' }),
        newValues: JSON.stringify({ message: 'Contraseña restablecida correctamente. Hash y texto omitidos.' }),
        ipAddress: ip || null,
        userAgent: userAgent || null,
      });
    }

    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'User',
      entityId: id,
      actionType: 'UPDATE',
      previousValues: JSON.stringify(removePassword(existing)),
      newValues: JSON.stringify(removePassword(updatedUserWithRole || updatedUser)),
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    return removePassword(updatedUserWithRole || updatedUser);
  }

  async delete(id: string, operator: { id: string; role: string; businessId: string; isStaff?: boolean }, ip?: string, userAgent?: string) {
    const existing = await this.userRepo.findById(id, operator.businessId);
    if (!existing) {
      throw new NotFoundError('Usuario no encontrado');
    }

    // Safety checks:
    // 1. Cannot self-delete
    if (id === operator.id) {
      throw new ConflictError('No puedes eliminar tu propio usuario');
    }

    // 2. Lockout prevention: Cannot delete the last active Administrator (bypassed if Super Admin)
    if (operator.isStaff !== true && existing.role?.name === 'Administrator' && existing.isActive) {
      const activeAdminsCount = await prisma.user.count({
        where: {
          businessId: operator.businessId,
          role: { name: 'Administrator' },
          isActive: true,
          id: { not: id },
        },
      });
      if (activeAdminsCount === 0) {
        throw new ConflictError('No se puede eliminar al único Administrador activo del negocio');
      }
    }

    // 3. Database dependencies checks (physical delete safeguard)
    const hasTransfers = await prisma.warehouseTransfer.count({ where: { createdById: id } });
    const hasStockMovements = await prisma.stockMovement.count({ where: { userId: id } as any });
    const hasInventories = await prisma.inventory.count({ where: { createdById: id } });
    const hasPurchases = await prisma.purchase.count({ where: { userId: id } });
    const hasSales = await prisma.sale.count({ where: { createdById: id } });
    const hasOpenedSessions = await prisma.cashSession.count({ where: { openedById: id } });
    const hasClosedSessions = await prisma.cashSession.count({ where: { closedById: id } });
    const hasCashMovements = await prisma.cashMovement.count({ where: { createdById: id } });

    if (
      hasTransfers > 0 ||
      hasStockMovements > 0 ||
      hasInventories > 0 ||
      hasPurchases > 0 ||
      hasSales > 0 ||
      hasOpenedSessions > 0 ||
      hasClosedSessions > 0 ||
      hasCashMovements > 0
    ) {
      throw new ConflictError(
        'No se puede eliminar físicamente este usuario porque tiene registros de actividad (ventas, compras, transferencias o arqueos) asociados en el sistema. Le recomendamos desactivarlo.'
      );
    }

    // Register log BEFORE deleting (since foreign keys will be deleted or set null)
    await this.activityLogRepo.log({
      userId: operator.id,
      businessId: operator.businessId,
      entityName: 'User',
      entityId: id,
      actionType: 'DELETE',
      previousValues: JSON.stringify(removePassword(existing)),
      newValues: null,
      ipAddress: ip || null,
      userAgent: userAgent || null,
    });

    await this.userRepo.delete(id, operator.businessId);

    return { id };
  }
}
