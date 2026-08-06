import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/appError';
import { defaultCapabilities } from '../seeds/capabilities.seed';

export class CapabilityService {
  /**
   * Ensures default capabilities are seeded in global DB.
   */
  async ensureCapabilitiesSeeded() {
    for (const cap of defaultCapabilities) {
      await prisma.capability.upsert({
        where: { id: cap.id },
        update: {
          name: cap.name,
          description: cap.description,
          module: cap.module,
          type: cap.type,
          technicalPermission: cap.technicalPermission,
        },
        create: cap,
      });
    }
  }

  /**
   * Returns list of all capabilities grouped by module.
   */
  async getGroupedCapabilities() {
    await this.ensureCapabilitiesSeeded();
    const capabilities = await prisma.capability.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });

    const grouped: Record<string, any[]> = {};
    for (const cap of capabilities) {
      if (!grouped[cap.module]) {
        grouped[cap.module] = [];
      }
      grouped[cap.module].push(cap);
    }

    return Object.entries(grouped).map(([module, caps]) => ({
      module,
      capabilities: caps,
    }));
  }

  /**
   * Returns list of enabled capability IDs for a given roleId.
   */
  async getRoleCapabilities(roleId: string, businessId: string) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, businessId },
      include: {
        capabilities: {
          include: { capability: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundError('Rol no encontrado');
    }

    const enabledCapabilityIds = role.capabilities.map((rc) => rc.capabilityId);
    return {
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },
      capabilityIds: enabledCapabilityIds,
    };
  }

  /**
   * Updates capabilities assigned to a role and logs history with optional reason.
   */
  async updateRoleCapabilities(
    roleId: string,
    businessId: string,
    userId: string,
    capabilityIds: string[],
    reason?: string
  ) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, businessId },
    });

    if (!role) {
      throw new NotFoundError('Rol no encontrado');
    }

    if (role.name === 'Administrator' || role.name === 'SuperAdmin') {
      throw new BadRequestError('El rol Administrator es un rol protegido del sistema');
    }

    // Validate that capabilityIds exist
    const validCaps = await prisma.capability.findMany({
      where: { id: { in: capabilityIds } },
      select: { id: true },
    });
    const validCapIds = new Set(validCaps.map((c) => c.id));

    return prisma.$transaction(async (tx) => {
      // 1. Fetch current capabilities assigned to role
      const currentRoleCaps = await tx.roleCapability.findMany({
        where: { roleId },
      });
      const currentCapIds = new Set(currentRoleCaps.map((rc) => rc.capabilityId));

      const newCapIds = new Set(capabilityIds.filter((id) => validCapIds.has(id)));

      // 2. Identify additions and removals
      const toAdd = Array.from(newCapIds).filter((id) => !currentCapIds.has(id));
      const toRemove = Array.from(currentCapIds).filter((id) => !newCapIds.has(id));

      // 3. Remove capabilities
      if (toRemove.length > 0) {
        await tx.roleCapability.deleteMany({
          where: {
            roleId,
            capabilityId: { in: toRemove },
          },
        });

        // Audit History
        for (const capId of toRemove) {
          await tx.roleCapabilityHistory.create({
            data: {
              businessId,
              roleId,
              userId,
              capabilityId: capId,
              action: 'REMOVED',
              reason: reason || null,
            },
          });
        }
      }

      // 4. Add capabilities
      for (const capId of toAdd) {
        await tx.roleCapability.create({
          data: {
            roleId,
            capabilityId: capId,
          },
        });

        // Audit History
        await tx.roleCapabilityHistory.create({
          data: {
            businessId,
            roleId,
            userId,
            capabilityId: capId,
            action: 'ADDED',
            reason: reason || null,
          },
        });
      }

      // Return updated role capabilities
      const updatedRole = await tx.role.findUnique({
        where: { id: roleId },
        include: {
          capabilities: {
            include: { capability: true },
          },
        },
      });

      return {
        role: {
          id: updatedRole?.id,
          name: updatedRole?.name,
          description: updatedRole?.description,
          isSystem: updatedRole?.isSystem,
        },
        capabilityIds: updatedRole?.capabilities.map((rc) => rc.capabilityId) || [],
      };
    });
  }

  /**
   * Creates a custom business role based on an existing role's capabilities.
   */
  async createCustomRole(
    businessId: string,
    name: string,
    description: string | undefined,
    baseRoleId?: string
  ) {
    const existing = await prisma.role.findFirst({
      where: { name, businessId },
    });

    if (existing) {
      throw new BadRequestError(`Ya existe un rol llamado "${name}" en su empresa.`);
    }

    // Prevent cloning from Administrator (protected role)
    if (baseRoleId) {
      const baseRole = await prisma.role.findFirst({ where: { id: baseRoleId } });
      if (baseRole?.name === 'Administrator' || baseRole?.name === 'SuperAdmin') {
        throw new BadRequestError('No se pueden copiar las capacidades del rol Administrator.');
      }
    }

    return prisma.$transaction(async (tx) => {
      // 1. Create custom role
      const customRole = await tx.role.create({
        data: {
          name,
          description,
          businessId,
          isSystem: false,
        },
      });

      // 2. Clone base role capabilities if provided
      if (baseRoleId) {
        const baseRoleCaps = await tx.roleCapability.findMany({
          where: { roleId: baseRoleId },
        });

        for (const cap of baseRoleCaps) {
          await tx.roleCapability.create({
            data: {
              roleId: customRole.id,
              capabilityId: cap.capabilityId,
            },
          });
        }
      }

      return customRole;
    });
  }

  /**
   * Updates name and/or description of a non-system role.
   */
  async updateRole(
    roleId: string,
    businessId: string,
    data: { name?: string; description?: string }
  ) {
    const role = await prisma.role.findFirst({ where: { id: roleId, businessId } });

    if (!role) {
      throw new NotFoundError('Rol no encontrado');
    }

    if (role.name === 'Administrator' || role.name === 'SuperAdmin') {
      throw new BadRequestError('El rol Administrator es un rol protegido del sistema y no puede modificarse.');
    }

    // Check name uniqueness if changing name
    if (data.name && data.name !== role.name) {
      const nameConflict = await prisma.role.findFirst({
        where: { name: data.name, businessId, id: { not: roleId } },
      });
      if (nameConflict) {
        throw new BadRequestError(`Ya existe un rol llamado "${data.name}" en su empresa.`);
      }
    }

    return prisma.role.update({
      where: { id: roleId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });
  }

  /**
   * Deletes a role if it has no assigned users and is not a system role.
   */
  async deleteRole(roleId: string, businessId: string) {
    const role = await prisma.role.findFirst({
      where: { id: roleId, businessId },
    });

    if (!role) {
      throw new NotFoundError('Rol no encontrado');
    }

    if (role.name === 'Administrator' || role.name === 'SuperAdmin') {
      throw new BadRequestError('El rol Administrator es un rol protegido del sistema y no puede eliminarse.');
    }

    // Validate no users are assigned to this role
    const userCount = await prisma.user.count({
      where: { roleId, businessId, deletedAt: null },
    });

    if (userCount > 0) {
      throw new BadRequestError(
        `Este rol tiene ${userCount} usuario${userCount > 1 ? 's' : ''} asignado${userCount > 1 ? 's' : ''}. Debe reasignarlos antes de eliminar el rol.`
      );
    }

    // Delete capabilities and history, then the role
    await prisma.$transaction(async (tx) => {
      await tx.roleCapability.deleteMany({ where: { roleId } });
      await tx.roleCapabilityHistory.deleteMany({ where: { roleId } });
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.role.delete({ where: { id: roleId } });
    });

    return { id: roleId, deleted: true };
  }

  /**
   * History Log of Capability Changes with reason and user metadata.
   */
  async getRoleCapabilityHistory(roleId: string, businessId: string) {
    return prisma.roleCapabilityHistory.findMany({
      where: { roleId, businessId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
        role: { select: { id: true, name: true } },
      },
    });
  }
}

