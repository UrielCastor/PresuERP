import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError, ForbiddenError } from '../utils/appError';

interface JWTPayload {
  userId: string;
  email: string;
  role: string | null;
  businessId: string | null;
  permissions: string[];
  isStaff: boolean;
  defaultWarehouseId?: string;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token is missing or invalid');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role as string,
      businessId: decoded.businessId as string,
      permissions: decoded.permissions,
      isStaff: decoded.isStaff,
      defaultWarehouseId: decoded.defaultWarehouseId,
    };


    return next();
  } catch (error: any) {
    if (error instanceof jwt.TokenExpiredError || error?.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Access token has expired'));
    }
    if (error instanceof jwt.JsonWebTokenError || error?.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid access token signature'));
    }
    return next(new UnauthorizedError('Authentication failed'));
  }
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const { permissions, role, isStaff } = req.user;

    // Staff (SuperAdmin SaaS) bypasses all permission checks
    if (isStaff) {
      return next();
    }

    // Tenant Administrator bypasses permission checks.
    // This ensures new permissions work without re-running seeds.
    if (role && role === 'Administrator') {
      return next();
    }

    if (!permissions.includes(permission)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }

    return next();
  };
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      return next(new ForbiddenError('Forbidden: Access denied'));
    }

    return next();
  };
};

export const requireSystemAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new UnauthorizedError('Acceso denegado - Token requerido'));
  }

  if (req.user.isStaff !== true) {
    return next(new ForbiddenError('Acceso denegado - Privilegios globales requeridos'));
  }

  return next();
};

export const requireAnyPermission = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const { permissions, role, isStaff } = req.user;

    // Staff (SuperAdmin SaaS) and Tenant Administrator bypass checks
    if (isStaff) {
      return next();
    }

    if (role && role === 'Administrator') {
      return next();
    }

    const hasAny = requiredPermissions.some(perm => permissions.includes(perm));
    if (!hasAny) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }

    return next();
  };
};

export const requireCapability = (capabilityId: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const { permissions, role, isStaff } = req.user;

    // Staff (SuperAdmin SaaS) and Tenant Administrator bypass checks
    if (isStaff || role === 'Administrator' || role === 'SuperAdmin') {
      return next();
    }

    // Map capability ID to technical permission check fallback
    const capabilityPermissionMap: Record<string, string> = {
      'cash.view': 'cash:view',
      'cash.open': 'cash:open',
      'cash.close': 'cash:close',
      'cash.movement': 'cash:movement',
      'cash.audit': 'cash:audit',
      'sales.create': 'sales:write',
      'sales.history': 'sales:read',
      'sales.discount': 'sales:write',
      'sales.cancel': 'sales:cancel',
      'customers.view': 'customers:read',
      'customers.create': 'customers:write',
      'customers.update': 'customers:write',
      'customers.delete': 'customers:write',
      'products.view': 'products:read',
      'products.create': 'products:create',
      'products.update': 'products:update',
      'products.delete': 'products:delete',
      'stocks.view': 'stocks:read',
      'stocks.adjust': 'stocks:update',
      'stocks.costs': 'stocks:update',
      'kardex.view': 'kardex:read',
      'kardex.export': 'kardex:export',
      'purchases.view': 'purchases:read',
      'purchases.create': 'purchases:create',
      'purchases.update': 'purchases:update',
      'purchases.approve': 'purchases:approve',
      'purchases.cancel': 'purchases:cancel',
      'logistics.request.view': 'transfer_requests:read',
      'logistics.request.create': 'transfer_requests:create',
      'logistics.request.update': 'transfer_requests:update',
      'logistics.request.send': 'transfer_requests:send',
      'logistics.request.approve': 'transfer_requests:approve',
      'logistics.request.reject': 'transfer_requests:reject',
      'logistics.request.cancel': 'transfer_requests:update',
      'logistics.transfer.view': 'transfers:read',
      'logistics.transfer.create': 'transfers:create',
      'logistics.transfer.prepare': 'transfers:prepare',
      'logistics.transfer.dispatch': 'transfers:dispatch',
      'logistics.transfer.receive': 'transfers:receive',
      'users.view': 'users:read',
      'users.create': 'users:write',
      'users.update': 'users:write',
      'users.delete': 'users:delete',
      'roles.manage': 'users:write',
      'settings.view': 'settings:read',
      'settings.update': 'settings:write',
      'settings.pos.update': 'settings:pos:write',
      'reports.view': 'reports:read',
      'reports.export': 'reports:read',
      'audit.view': 'AUDIT_VIEW',
    };

    const mappedPermission = capabilityPermissionMap[capabilityId] || capabilityId;
    if (permissions && permissions.includes(mappedPermission)) {
      return next();
    }

    if (role && req.user.businessId) {
      const { prisma } = await import('../config/db');
      const userRole = await prisma.role.findFirst({
        where: { name: role, businessId: req.user.businessId },
        select: { id: true },
      });
      if (userRole) {
        const hasCapInDb = await prisma.roleCapability.findFirst({
          where: { roleId: userRole.id, capabilityId },
        });
        if (hasCapInDb) {
          return next();
        }
      }
    }

    return next(new ForbiddenError('No posee la capacidad requerida para ejecutar esta acción'));
  };
};

