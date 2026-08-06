import { Request, Response, NextFunction } from 'express';
import { EffectivePermissionsService } from '../services/effectivePermissions.service';

const effectivePermissionsService = new EffectivePermissionsService();

export class UserPermissionsAuditController {
  async getSecuritySummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessId = req.user!.businessId!;
      const data = await effectivePermissionsService.getUserSecuritySummary(id, businessId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getUserCapabilities(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessId = req.user!.businessId!;
      const data = await effectivePermissionsService.getUserCapabilities(id, businessId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getEffectivePermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessId = req.user!.businessId!;
      const data = await effectivePermissionsService.getUserEffectivePermissions(id, businessId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
