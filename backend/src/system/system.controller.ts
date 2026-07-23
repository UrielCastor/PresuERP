import { Request, Response, NextFunction } from 'express';
import { SystemService } from './system.service';
import { prisma } from '../config/db';

export class SystemController {
  private service: SystemService;

  constructor() {
    this.service = new SystemService();
  }

  getDashboardMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getDashboardMetrics();
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getBusinessOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getBusinessOverview(req.params.id);
      
      await prisma.activityLog.create({
         data: {
             userId: req.user!.id,
             businessId: req.params.id,
             actionType: 'VIEW_BUSINESS',
             entityName: 'BUSINESS',
             entityId: req.params.id,
             newValues: JSON.stringify({ name: data.business.name }),
             ipAddress: req.ip,
             userAgent: req.headers['user-agent']
         } as any
      });

      res.status(200).json({ success: true, ...data });
    } catch (error) { next(error); }
  };

  listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        search: req.query.search as string,
        businessId: req.query.businessId as string,
        roleId: req.query.roleId as string,
        isActive: req.query.isActive as string,
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };
      const data = await this.service.listAllUsers(filters);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  getUserDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getUserDetails(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        return;
      }

      try {
        const logBusinessId = data.user.business?.id || req.user!.businessId;
        if (logBusinessId) {
          await prisma.activityLog.create({
             data: {
                 userId: req.user!.id,
                 businessId: logBusinessId,
                 actionType: 'VIEW_USER',
                 entityName: 'USER',
                 entityId: req.params.id,
                 newValues: JSON.stringify({ name: data.user.name, email: data.user.email }),
                 ipAddress: req.ip,
                 userAgent: req.headers['user-agent']
             } as any
          });
        } else {
          console.warn(`User details viewed: ${data.user.name} (${data.user.email}) by Admin ${req.user!.email} (No corporate business context)`);
        }
      } catch (logErr) {
        console.error('Failed to log VIEW_USER activity:', logErr);
      }

      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (id === req.user!.id) {
        res.status(400).json({ success: false, message: 'No puedes cambiar tu propio estado' });
        return;
      }

      const originalUser = await prisma.user.findUnique({ where: { id } });
      if (!originalUser) {
        res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        return;
      }

      const result = await this.service.updateUserStatus(id, isActive);
      
      const actionType = isActive ? 'RESTORE_USER' : 'SUSPEND_USER';

      try {
        const logBusinessId = originalUser.businessId || req.user!.businessId;
        if (logBusinessId) {
          await prisma.activityLog.create({
             data: {
                 userId: req.user!.id,
                 businessId: logBusinessId,
                 actionType,
                 entityName: 'USER',
                 entityId: id,
                 newValues: JSON.stringify({ isActive }),
                 previousValues: JSON.stringify({ isActive: originalUser.isActive }),
                 ipAddress: req.ip,
                 userAgent: req.headers['user-agent']
             } as any
          });
        } else {
          console.warn(`User status (${actionType}) updated for ${originalUser.name} by Admin ${req.user!.email} (No corporate business context)`);
        }
      } catch (logErr) {
        console.error('Failed to log user status update activity:', logErr);
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const reason = req.body?.reason || req.query?.reason || undefined;

      // 1. Regla: No permitir eliminar el propio usuario logueado
      if (id === req.user!.id) {
        res.status(400).json({ success: false, message: 'No puedes eliminar tu propio usuario logueado.' });
        return;
      }

      const userToDelete = await prisma.user.findUnique({
        where: { id },
        include: { role: true }
      });

      if (!userToDelete) {
        res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        return;
      }

      // 2. Regla: No permitir eliminar el único propietario o último administrador de una empresa
      // NOTA: El Super Admin (isStaff === true) tiene control global y puede omitir este bloqueo de nivel de tenant
      const requestingIsStaff = req.user?.isStaff === true;

      if (!requestingIsStaff && userToDelete.businessId) {
        const isAdmin = userToDelete.isStaff || (userToDelete.role && userToDelete.role.name === 'Administrator') || !userToDelete.roleId;
         
        if (isAdmin) {
          const otherAdminCount = await prisma.user.count({
            where: {
              businessId: userToDelete.businessId,
              id: { not: id },
              OR: [
                { isStaff: true },
                { role: { name: 'Administrator' } },
                { roleId: null }
              ]
            }
          });
          if (otherAdminCount === 0) {
            res.status(400).json({ success: false, message: 'No se puede eliminar al último administrador de la empresa. Debe promover a otro usuario como administrador primero.' });
            return;
          }
        }

        const totalCompanyUsers = await prisma.user.count({
          where: { businessId: userToDelete.businessId }
        });
        if (totalCompanyUsers <= 1) {
          res.status(400).json({ success: false, message: 'No se puede eliminar al propietario / único usuario de la empresa.' });
          return;
        }
      }

      // 3. Regla: Incluso Super Admin NO debe poder eliminar al último administrador global del sistema (isStaff)
      if (userToDelete.isStaff) {
        const otherStaffCount = await prisma.user.count({
          where: { isStaff: true, id: { not: id } }
        });
        if (otherStaffCount === 0) {
          res.status(400).json({ success: false, message: 'No se puede eliminar al último administrador global del sistema (isStaff).' });
          return;
        }
      }

      // 4. Regla: No permitir eliminar usuarios con registros históricos (evitar errores de FK y proteger la integridad del sistema)
      const [salesCount, purchasesCount, transfersCount, sessionCount] = await Promise.all([
        prisma.sale.count({ where: { createdById: id } }),
        prisma.purchase.count({ where: { userId: id } }),
        prisma.warehouseTransfer.count({ where: { createdById: id } }),
        prisma.cashSession.count({ where: { OR: [{ openedById: id }, { closedById: id }] } })
      ]);

      const totalRecords = salesCount + purchasesCount + transfersCount + sessionCount;
      const possessesHistory = totalRecords > 0;

      if (possessesHistory && !requestingIsStaff) {
        res.status(400).json({
          success: false,
          message: 'No es posible eliminar físicamente al usuario debido a que tiene registros históricos de transacciones (ventas, compras, transferencias o sesiones de caja). Le sugerimos suspender el usuario para revocar su acceso sin romper la integridad histórica.'
        });
        return;
      }

      // 5. Proceder a eliminar
      // Si el Super Admin elimina a un usuario que posee historial, forzamos soft-delete en la base de datos para no romper FKs
      const useSoftDelete = possessesHistory && requestingIsStaff;
      await this.service.deleteUser(id, useSoftDelete);

      // 6. Registrar en ActivityLog: DELETE_USER o DELETE_USER_FORCED
      try {
        const logBusinessId = userToDelete.businessId || req.user!.businessId;
        const actionType = useSoftDelete ? 'DELETE_USER_FORCED' : 'DELETE_USER';

        if (logBusinessId) {
          await prisma.activityLog.create({
            data: {
              userId: req.user!.id,
              businessId: logBusinessId,
              actionType: actionType,
              entityName: 'USER',
              entityId: id,
              newValues: JSON.stringify({
                deletedName: userToDelete.name,
                deletedEmail: userToDelete.email,
                businessId: userToDelete.businessId || 'STAFF',
                deletedByStaff: req.user!.email,
                reason: reason || 'No especificado',
                actionDate: new Date().toISOString(),
                recordsAffected: totalRecords,
                forcedByStaff: requestingIsStaff,
                details: useSoftDelete ? 'Bypass de integridad histórica ejecutado via soft-delete' : 'Eliminación física completa ejecutada'
              }),
              ipAddress: req.ip,
              userAgent: req.headers['user-agent']
            } as any
          });
        } else {
          console.warn(`User deleted: ${userToDelete.name} (${userToDelete.email}) by Admin ${req.user!.email} (No corporate business context)`);
        }
      } catch (logErr) {
        console.error('Failed to log DELETE_USER activity:', logErr);
      }

      res.status(200).json({ success: true, message: 'Usuario eliminado exitosamente' });
    } catch (error) { next(error); }
  };

  getMercadoPagoWebhookLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const logs = await prisma.mercadoPagoWebhookLog.findMany({
        take: 100,
        orderBy: { createdAt: 'desc' }
      });

      const businessIds = Array.from(new Set(logs.map(l => l.businessId).filter(Boolean))) as string[];
      const businesses = await prisma.business.findMany({
        where: { id: { in: businessIds } },
        select: { id: true, name: true }
      });
      const businessMap = new Map(businesses.map(b => [b.id, b.name]));

      const formattedLogs = logs.map(l => ({
        ...l,
        businessName: l.businessId ? (businessMap.get(l.businessId) || 'Empresa Desconocida') : 'N/A'
      }));

      res.status(200).json({ success: true, data: formattedLogs });
    } catch (error) {
      next(error);
    }
  };
}
