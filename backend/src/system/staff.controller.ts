import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { ActivityLogRepository } from '../repositories/activityLog.repository';

export class StaffController {
  private logRepo = new ActivityLogRepository();

  public promoteToStaff = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const user = await prisma.user.update({
        where: { id },
        data: {
          isStaff: true,
          businessId: null, // Staff no pertenece a ningún tenant
          roleId: null,     // Staff no ocupa rol RBAC
        } as any
      });

      await this.logRepo.log({
        userId: req.user!.id,
        businessId: 'SYSTEM', // Contexto global
        entityName: 'User',
        entityId: user.id,
        actionType: 'CREATE_STAFF',
        previousValues: null,
        newValues: JSON.stringify({ isStaff: true, message: 'Usuario promovido a Staff Global' }),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      } as any);

      res.status(200).json({ success: true, message: 'Usuario promovido a Staff', data: user });
    } catch (error) { next(error); }
  };

  public demoteFromStaff = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (id === req.user!.id) {
        throw new Error('No puedes remover tus propios privilegios de Staff');
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          isStaff: false,
        } as any
      });

      await this.logRepo.log({
        userId: req.user!.id,
        businessId: 'SYSTEM', // Contexto global
        entityName: 'User',
        entityId: user.id,
        actionType: 'REMOVE_STAFF',
        previousValues: JSON.stringify({ isStaff: true }),
        newValues: JSON.stringify({ isStaff: false, message: 'Privilegios de Staff removidos' }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      } as any);

      res.status(200).json({ success: true, message: 'Usuario demovido de Staff', data: user });
    } catch (error) { next(error); }
  };
}
