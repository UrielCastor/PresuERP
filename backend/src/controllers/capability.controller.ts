import { Request, Response, NextFunction } from 'express';
import { CapabilityService } from '../services/capability.service';

const service = new CapabilityService();

export class CapabilityController {
  /**
   * GET /api/v1/system/capabilities
   * List all master capabilities grouped by module
   */
  static async getGroupedCapabilities(req: Request, res: Response, next: NextFunction) {
    try {
      const grouped = await service.getGroupedCapabilities();
      return res.status(200).json({
        success: true,
        data: grouped,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/roles/:id/capabilities
   * Get capabilities assigned to a role
   */
  static async getRoleCapabilities(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const roleId = req.params.id;

      const result = await service.getRoleCapabilities(roleId, businessId);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PUT /api/v1/roles/:id/capabilities
   * Update capabilities assigned to a role (supports optional reason)
   */
  static async updateRoleCapabilities(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const roleId = req.params.id;
      const { capabilityIds, reason } = req.body;

      const result = await service.updateRoleCapabilities(
        roleId,
        businessId,
        userId,
        Array.isArray(capabilityIds) ? capabilityIds : [],
        reason
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/roles/custom
   * Create a new custom role for the business based on an existing role
   */
  static async createCustomRole(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const { name, description, baseRoleId } = req.body;

      const newRole = await service.createCustomRole(
        businessId,
        name,
        description,
        baseRoleId
      );

      return res.status(201).json({
        success: true,
        data: newRole,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/roles/:id/capabilities/history
   * Audit log of capability modifications for a role
   */
  static async getRoleCapabilityHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const roleId = req.params.id;

      const history = await service.getRoleCapabilityHistory(roleId, businessId);
      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /api/v1/roles/:id
   * Update role name and/or description
   */
  static async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const roleId = req.params.id;
      const { name, description } = req.body;

      const updated = await service.updateRole(roleId, businessId, { name, description });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * DELETE /api/v1/roles/:id
   * Delete a non-system role (validates no users assigned)
   */
  static async deleteRole(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const roleId = req.params.id;

      const result = await service.deleteRole(roleId, businessId);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }
}

