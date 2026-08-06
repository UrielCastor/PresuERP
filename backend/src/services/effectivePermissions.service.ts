import { prisma } from '../config/db';
import { NotFoundError } from '../utils/appError';
import { defaultCapabilities } from '../seeds/capabilities.seed';

export interface ModuleAllowedActions {
  module: string;
  actions: string[];
}

export interface BlockedAction {
  module: string;
  action: string;
  capabilityId: string;
  reason: string;
}

export interface UserSecuritySummary {
  user: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    isStaff: boolean;
  };
  role: {
    id: string | null;
    name: string;
    isSystem?: boolean;
  };
  warehouses: {
    defaultWarehouse: { id: string; name: string } | null;
    authorizedWarehouses: Array<{ id: string; name: string }>;
    scopeDescription: string;
  };
  isSuperAdmin: boolean;
  isAdministrator: boolean;
  allowedCount: number;
  blockedCount: number;
  allowedGrouped: ModuleAllowedActions[];
  blocked: BlockedAction[];
}

export class EffectivePermissionsService {
  /**
   * Resolves the complete effective security summary for a given user.
   */
  async getUserSecuritySummary(userId: string, businessId: string): Promise<UserSecuritySummary> {
    const user = await prisma.user.findFirst({
      where: { id: userId, businessId },
      include: {
        role: true,
        defaultWarehouse: { select: { id: true, name: true } },
        userWarehouses: {
          include: {
            warehouse: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const isAdministrator = user.role?.name === 'Administrator' || user.role?.name === 'SuperAdmin';
    const isSuperAdmin = user.isStaff;

    const authorizedWarehouses = user.userWarehouses.map((uw) => ({
      id: uw.warehouseId,
      name: uw.warehouse?.name || uw.warehouseId,
    }));

    let scopeDescription = 'Acceso restringido al depósito predeterminado asignado';
    if (isAdministrator || isSuperAdmin) {
      scopeDescription = 'Acceso global a todos los depósitos de la empresa (Superusuario)';
    } else if (authorizedWarehouses.length > 0) {
      scopeDescription = `Acceso multidepósito autorizado en ${authorizedWarehouses.length} depósitos`;
    }

    // Load dynamic capabilities assigned to user's role
    let assignedCapIds = new Set<string>();

    if (user.roleId) {
      const roleCaps = await prisma.roleCapability.findMany({
        where: { roleId: user.roleId },
        select: { capabilityId: true },
      });
      assignedCapIds = new Set(roleCaps.map((rc) => rc.capabilityId));
    }

    const allowedGroupedMap: Record<string, string[]> = {};
    const blocked: BlockedAction[] = [];

    for (const cap of defaultCapabilities) {
      const isAllowed = isAdministrator || isSuperAdmin || assignedCapIds.has(cap.id);

      if (isAllowed) {
        if (!allowedGroupedMap[cap.module]) {
          allowedGroupedMap[cap.module] = [];
        }
        allowedGroupedMap[cap.module].push(cap.name);
      } else {
        blocked.push({
          module: cap.module,
          action: cap.name,
          capabilityId: cap.id,
          reason: `Falta asignar la capacidad ${cap.id}`,
        });
      }
    }

    const allowedGrouped: ModuleAllowedActions[] = Object.keys(allowedGroupedMap).map((module) => ({
      module,
      actions: allowedGroupedMap[module],
    }));

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        isStaff: user.isStaff,
      },
      role: {
        id: user.roleId,
        name: user.role?.name || 'Sin Rol',
        isSystem: user.role?.isSystem,
      },
      warehouses: {
        defaultWarehouse: user.defaultWarehouse,
        authorizedWarehouses,
        scopeDescription,
      },
      isSuperAdmin,
      isAdministrator,
      allowedCount: defaultCapabilities.length - blocked.length,
      blockedCount: blocked.length,
      allowedGrouped,
      blocked,
    };
  }

  /**
   * Returns list of direct capabilities assigned to user's role.
   */
  async getUserCapabilities(userId: string, businessId: string) {
    const summary = await this.getUserSecuritySummary(userId, businessId);
    return {
      userId,
      roleName: summary.role.name,
      isAdministrator: summary.isAdministrator,
      capabilities: summary.allowedGrouped,
    };
  }

  /**
   * Returns effective permissions technical codes list.
   */
  async getUserEffectivePermissions(userId: string, businessId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, businessId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    if (user.role?.name === 'Administrator' || user.isStaff) {
      return {
        userId,
        isAdministrator: true,
        permissions: defaultCapabilities.map((c) => c.technicalPermission),
      };
    }

    if (!user.roleId) {
      return { userId, isAdministrator: false, permissions: [] };
    }

    const roleCaps = await prisma.roleCapability.findMany({
      where: { roleId: user.roleId },
      include: { capability: true },
    });

    const permSet = new Set<string>();
    roleCaps.forEach((rc) => {
      if (rc.capability?.technicalPermission) {
        permSet.add(rc.capability.technicalPermission);
      }
    });

    return {
      userId,
      isAdministrator: false,
      permissions: Array.from(permSet),
    };
  }
}
