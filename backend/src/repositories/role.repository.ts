import { prisma } from '../config/db';
import { Role, Permission } from '@prisma/client';

export class RoleRepository {
  async findByName(name: string, businessId: string): Promise<Role | null> {
    return prisma.role.findFirst({
      where: { name, businessId },
    });
  }

  async findById(id: string, businessId: string): Promise<Role | null> {
    return prisma.role.findFirst({
      where: { id, businessId },
    });
  }

  async create(data: { name: string; description?: string; businessId: string; isSystem?: boolean }): Promise<Role> {
    return prisma.role.create({
      data,
    });
  }

  async addPermission(roleId: string, permissionId: string): Promise<void> {
    await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
      },
    });
  }

  async listPermissions(roleId: string): Promise<Permission[]> {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    return rolePermissions.map((rp: any) => rp.permission);
  }

  async list(businessId: string): Promise<Role[]> {
    return prisma.role.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }
}
