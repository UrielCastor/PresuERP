import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { cleanExpiredRefreshTokens } from '../jobs/tokenCleanup.job';
import { UserRepository } from '../repositories/user.repository';
import { BusinessRepository } from '../repositories/business.repository';
import { RoleRepository } from '../repositories/role.repository';
import { UnauthorizedError, ConflictError, NotFoundError } from '../utils/appError';
import { User, Business } from '@prisma/client';

const whitelistPermissions = [
  // Users
  { name: 'users:read', description: 'Read users', module: 'users' },
  { name: 'users:write', description: 'Create and modify users', module: 'users' },
  { name: 'users:delete', description: 'Delete users', module: 'users' },
  // Products
  { name: 'products:read', description: 'Read products', module: 'products' },
  { name: 'products:create', description: 'Create products', module: 'products' },
  { name: 'products:update', description: 'Update products', module: 'products' },
  { name: 'products:delete', description: 'Delete products', module: 'products' },
  { name: 'products:write', description: 'Create and modify products (legacy)', module: 'products' },
  // Categories
  { name: 'categories:read', description: 'Read categories', module: 'categories' },
  { name: 'categories:create', description: 'Create categories', module: 'categories' },
  { name: 'categories:update', description: 'Update categories', module: 'categories' },
  { name: 'categories:delete', description: 'Delete categories', module: 'categories' },
  // Suppliers
  { name: 'suppliers:read', description: 'Read suppliers', module: 'suppliers' },
  { name: 'suppliers:create', description: 'Create suppliers', module: 'suppliers' },
  { name: 'suppliers:update', description: 'Update suppliers', module: 'suppliers' },
  { name: 'suppliers:delete', description: 'Delete suppliers', module: 'suppliers' },
  // Warehouses
  { name: 'warehouses:read', description: 'Read warehouses info', module: 'warehouses' },
  { name: 'warehouses:create', description: 'Create warehouses', module: 'warehouses' },
  { name: 'warehouses:update', description: 'Update warehouses', module: 'warehouses' },
  { name: 'warehouses:delete', description: 'Delete warehouses', module: 'warehouses' },
  // Sales
  { name: 'sales:read', description: 'Read sales data', module: 'sales' },
  { name: 'sales:write', description: 'Create and edit sales', module: 'sales' },
  { name: 'sales:cancel', description: 'Cancel/void completed sales', module: 'sales' },
  // Customers
  { name: 'customers:read', description: 'Read customers', module: 'customers' },
  { name: 'customers:write', description: 'Create and modify customers', module: 'customers' },
  // Settings
  { name: 'settings:read', description: 'Read business settings', module: 'settings' },
  { name: 'settings:write', description: 'Change business settings', module: 'settings' },
  { name: 'settings:pos:read', description: 'Read POS settings', module: 'settings' },
  { name: 'settings:pos:write', description: 'Change POS settings', module: 'settings' },
  // Stocks
  { name: 'stocks:read', description: 'Read stock levels', module: 'stocks' },
  { name: 'stocks:update', description: 'Adjust stock levels and settings', module: 'stocks' },
  // Kardex
  { name: 'kardex:read', description: 'Read stock movements ledger', module: 'kardex' },
  { name: 'kardex:export', description: 'Export stock movements PDF/Excel/CSV', module: 'kardex' },
  // Purchases
  { name: 'purchases:read', description: 'Read purchase orders', module: 'purchases' },
  { name: 'purchases:create', description: 'Create purchase orders', module: 'purchases' },
  { name: 'purchases:update', description: 'Edit draft purchase orders', module: 'purchases' },
  { name: 'purchases:approve', description: 'Approve purchase orders and increment stock', module: 'purchases' },
  { name: 'purchases:cancel', description: 'Cancel purchase orders and reverse stock', module: 'purchases' },
  // Cash
  { name: 'cash:view', description: 'View cash register status', module: 'cash' },
  { name: 'cash:open', description: 'Open cash register session', module: 'cash' },
  { name: 'cash:close', description: 'Close cash register session (Z)', module: 'cash' },
  { name: 'cash:movement', description: 'Register manual manual IN/OUT', module: 'cash' },
  { name: 'cash:audit', description: 'View full history of cash registers', module: 'cash' },
  // Reports
  { name: 'reports:read', description: 'View business reports', module: 'reports' },
];

export class AuthService {
  private userRepo = new UserRepository();
  private businessRepo = new BusinessRepository();
  private roleRepo = new RoleRepository();

  async registerBusinessTenant(data: {
    businessName: string;
    taxId: string;
    adminName: string;
    adminEmail: string;
    adminPasswordPlain: string;
  }): Promise<{ business: Business; admin: User }> {
    // 1. Check if business already exists
    const existingBiz = await this.businessRepo.findByTaxId(data.taxId);
    if (existingBiz) {
       throw new ConflictError('Business with this Tax ID already registered');
    }

    // 2. Check if admin user already exists
    const existingUser = await this.userRepo.findByEmail(data.adminEmail);
    if (existingUser) {
      throw new ConflictError('Email already in use');
    }

    // 3. Resolve FREE plan BEFORE starting the transaction (read-only, safe outside tx)
    const freePlan =
      await prisma.plan.findFirst({ where: { code: 'FREE' } }) ||
      await prisma.plan.findFirst({ where: { name: 'FREE' } });

    if (!freePlan) {
      throw new Error(
        'Plan FREE no encontrado en la base de datos. Por favor asegúrese de que el plan FREE exista antes de registrar empresas.'
      );
    }

    // 4. Start database transaction
    return prisma.$transaction(async (tx: any) => {
      // 4.1 Create Business
      const business = await tx.business.create({
        data: {
          name: data.businessName,
          taxId: data.taxId,
          subscriptionPlan: freePlan.name
        },
      });

      // 4.2 Create initial FREE Subscription — every business must have one
      await tx.subscription.create({
        data: {
          businessId: business.id,
          planId: freePlan.id,
          status: 'ACTIVE',
          billingCycle: 'FREE',
          startDate: new Date()
        }
      });

      // 4.3 Create Permissions (Upsert if global)
      const permissionsMap = [];
      for (const perm of whitelistPermissions) {
        const dbPerm = await tx.permission.upsert({
          where: { name: perm.name },
          update: {},
          create: perm,
        });
        permissionsMap.push(dbPerm);
      }

      // 3.3 Create Default Roles
      const adminRole = await tx.role.create({
        data: {
          name: 'Administrator',
          description: 'Full business management control',
          businessId: business.id,
          isSystem: true,
        },
      });

      const supervisorRole = await tx.role.create({
        data: {
          name: 'Supervisor',
          description: 'Store operations supervisor',
          businessId: business.id,
          isSystem: true,
        },
      });

      const cajeroRole = await tx.role.create({
        data: {
          name: 'Cajero',
          description: 'Cashier checkout access',
          businessId: business.id,
          isSystem: true,
        },
      });




      // Assign all permissions to Administrator
      for (const p of permissionsMap) {
        await tx.rolePermission.create({
          data: {
            roleId: adminRole.id,
            permissionId: p.id,
          },
        });
      }

      // Assign subset of permissions to Supervisor
      const supervisorPermCodes = [
        'products:read', 'products:create', 'products:update', 'products:delete', 'products:write',
        'categories:read', 'categories:create', 'categories:update', 'categories:delete',
        'suppliers:read', 'suppliers:create', 'suppliers:update', 'suppliers:delete',
        'warehouses:read', 'warehouses:create', 'warehouses:update', 'warehouses:delete',
        'stocks:read', 'stocks:update',
        'kardex:read', 'kardex:export',
        'sales:read', 'sales:write', 'sales:cancel',
        'customers:read', 'customers:write',
        'purchases:read', 'purchases:create', 'purchases:update', 'purchases:approve', 'purchases:cancel',
        'cash:view', 'cash:open', 'cash:close', 'cash:movement', 'cash:audit',
        'reports:read',
        'settings:pos:read', 'settings:pos:write',
      ];
      const supervisorPerms = permissionsMap.filter((p) => supervisorPermCodes.includes(p.name));
      for (const p of supervisorPerms) {
        await tx.rolePermission.create({
          data: {
            roleId: supervisorRole.id,
            permissionId: p.id,
          },
        });
      }

      // Assign to Cashier (Cajero)
      const cashierPermCodes = [
        'products:read',
        'warehouses:read',
        'stocks:read',
        'sales:read', 'sales:write',
        'customers:read', 'customers:write',
        'cash:view', 'cash:open', 'cash:close', 'cash:movement',
      ];
      const cashierPerms = permissionsMap.filter((p) => cashierPermCodes.includes(p.name));
      for (const p of cashierPerms) {
        await tx.rolePermission.create({
          data: {
            roleId: cajeroRole.id,
            permissionId: p.id,
          },
        });
      }

      // Hash Password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.adminPasswordPlain, salt);

      // Create Admin User
      const admin = await tx.user.create({
        data: {
          name: data.adminName,
          email: data.adminEmail,
          password: hashedPassword,
          roleId: adminRole.id,
          businessId: business.id,
        },
      });

      // Provisoning Default Warehouse
      await tx.warehouse.create({
        data: {
          businessId: business.id,
          name: 'Depósito Central',
          code: 'CENTRAL',
          isMain: true,
          status: 'ACTIVE',
        },
      });

      // Provisoning Document Types
      await tx.documentType.createMany({
        data: [
          {
            businessId: business.id,
            name: 'Ticket POS',
            code: 'TICKET',
            prefix: 'T',
            nextNumber: 1,
            isFiscal: false,
            direction: 'OUTGOING',
          },
          {
            businessId: business.id,
            name: 'Factura Electrónica',
            code: 'FACTURA',
            prefix: 'F',
            nextNumber: 1,
            isFiscal: true,
            direction: 'OUTGOING',
          }
        ],
        skipDuplicates: true,
      });

      // Provisoning Default Cash Register
      await tx.cashRegister.create({
        data: {
          businessId: business.id,
          name: 'Caja Principal',
          code: 'CAJA-01',
          isActive: true,
        },
      });

      return { business, admin };
    });
  }

  async login(email: string, passwordPlain: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(passwordPlain, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const permissions = user.roleId ? await this.roleRepo.listPermissions(user.roleId as string) : [];
    const permissionCodes = permissions.map((p) => p.name);

    console.log('🔥 [DEBUG LOGIN PRISMA USER]', {
      id: user.id,
      businessId: user.businessId,
      role: user.role?.name,
      permissionsCount: permissionCodes.length,
      userWarehouses: (user as any).userWarehouses,
      defaultWarehouse: (user as any).defaultWarehouse,
    });

    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role?.name || '',
        businessId: user.businessId || '',
        permissions: permissionCodes,
        isStaff: (user as any).isStaff,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
    );

    // Save refresh token to db
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Matches '30d' limit

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    const userClean = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name || '',
      businessId: user.businessId || '',
      permissions: permissionCodes,
      isStaff: (user as any).isStaff,
      defaultWarehouseId: (user as any).defaultWarehouseId || null,
      defaultWarehouse: (user as any).defaultWarehouse || null,
      userWarehouses: (user as any).userWarehouses || [],
    };

    return { accessToken, refreshToken, user: userClean };
  }

  async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decodedPayload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };

      const storedToken = await prisma.refreshToken.findUnique({
        where: { token },
        include: { user: { include: { role: true } } },
      });

      if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedError('Refresh token is invalid or expired');
      }

      // Revoke the old token
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked: true },
      });

      const user = storedToken.user;
      const permissions = user.roleId ? await this.roleRepo.listPermissions(user.roleId as string) : [];
      const permissionCodes = permissions.map((p) => p.name);

      const newAccessToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role?.name || '',
          businessId: user.businessId || '',
          permissions: permissionCodes,
          isStaff: (user as any).isStaff,
        },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN as any }
      );

      const newRefreshToken = jwt.sign(
        { userId: user.id },
        env.JWT_REFRESH_SECRET,
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Matches '30d' limit

      await prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: user.id,
          expiresAt,
        },
      });

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (err) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  async logout(token?: string, userId?: string): Promise<void> {
    if (!token && !userId) return;

    const conditions: any[] = [];
    if (token) conditions.push({ token });
    if (userId) conditions.push({ userId });

    await prisma.refreshToken.updateMany({
      where: {
        OR: conditions,
      },
      data: { revoked: true },
    });
  }

  async cleanExpiredTokens(): Promise<number> {
    return cleanExpiredRefreshTokens();
  }

  static async bootstrapPermissions() {
    // 1. Check/create permissions
    const permissionsMap = [];
    for (const perm of whitelistPermissions) {
      const dbPerm = await prisma.permission.upsert({
        where: { name: perm.name },
        update: {},
        create: perm,
      });
      permissionsMap.push(dbPerm);
    }

    // 2. Fetch all businesses
    const businesses = await prisma.business.findMany({ select: { id: true } });
    for (const biz of businesses) {
      // Find default roles for this business
      const roles = await prisma.role.findMany({
        where: { businessId: biz.id },
      });

      const adminRole = roles.find((r) => r.name.toLowerCase() === 'administrator');
      const supervisorRole = roles.find((r) => r.name.toLowerCase() === 'supervisor');
      const cashierRole = roles.find((r) => r.name.toLowerCase() === 'cajero');

      // Administrator assigns all permissions
      if (adminRole) {
        for (const p of permissionsMap) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: adminRole.id,
                permissionId: p.id,
              },
            },
            create: {
              roleId: adminRole.id,
              permissionId: p.id,
            },
            update: {},
          });
        }
      }

      // Supervisor assigns subset
      if (supervisorRole) {
        const supervisorPermCodes = [
          'products:read', 'products:create', 'products:update', 'products:delete', 'products:write',
          'categories:read', 'categories:create', 'categories:update', 'categories:delete',
          'suppliers:read', 'suppliers:create', 'suppliers:update', 'suppliers:delete',
          'warehouses:read', 'warehouses:create', 'warehouses:update', 'warehouses:delete',
          'stocks:read', 'stocks:update',
          'kardex:read', 'kardex:export',
          'sales:read', 'sales:write', 'sales:cancel',
          'customers:read', 'customers:write',
          'purchases:read', 'purchases:create', 'purchases:update', 'purchases:approve', 'purchases:cancel',
          'cash:view', 'cash:open', 'cash:close', 'cash:movement', 'cash:audit',
          'reports:read',
          'settings:pos:read', 'settings:pos:write',
        ];
        const supervisorPerms = permissionsMap.filter((p) => supervisorPermCodes.includes(p.name));
        for (const p of supervisorPerms) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: supervisorRole.id,
                permissionId: p.id,
              },
            },
            create: {
              roleId: supervisorRole.id,
              permissionId: p.id,
            },
            update: {},
          });
        }
      }

      // Cashier assigns subset
      if (cashierRole) {
        const cashierPermCodes = [
          'products:read',
          'warehouses:read',
          'stocks:read',
          'sales:read', 'sales:write',
          'customers:read', 'customers:write',
          'cash:view', 'cash:open', 'cash:close', 'cash:movement',
        ];
        const cashierPerms = permissionsMap.filter((p) => cashierPermCodes.includes(p.name));
        for (const p of cashierPerms) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: cashierRole.id,
                permissionId: p.id,
              },
            },
            create: {
              roleId: cashierRole.id,
              permissionId: p.id,
            },
            update: {},
          });
        }
      }
    }
  }
}
