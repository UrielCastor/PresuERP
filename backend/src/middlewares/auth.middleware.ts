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
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Access token has expired'));
    }
    return next(new UnauthorizedError('Authentication failed'));
  }
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    const { permissions, role } = req.user;

    // Super Admin or general Admin can bypass if role match (or if permissions match)
    if (role === 'Administrator') {
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
