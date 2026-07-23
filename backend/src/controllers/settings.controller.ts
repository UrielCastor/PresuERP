import { Request, Response, NextFunction } from 'express';
import { SettingsService } from '../services/settings.service';
import { ForbiddenError } from '../utils/appError';
import {
  updateBusinessSchema,
  updateBusinessSettingsSchema,
  updateFiscalSettingsSchema,
  updatePOSSettingsSchema,
  updatePrintSettingsSchema,
  updateEmailSettingsSchema,
  updateNumberSettingsSchema,
} from '../validators/settings.validator';

const settingsService = new SettingsService();

export class SettingsController {
  static async getSettings(req: any, res: any, next: any) {
    try {
      const businessId = req.user.businessId;
      const settings = await settingsService.getSettings(businessId);
      return res.status(200).json({
        status: 'success',
        data: settings,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateBusiness(req: any, res: any, next: any) {
    try {
      const businessId = req.user.businessId;
      const userId = req.user.id;
      const parsedBody = updateBusinessSchema.parse(req.body);
      const updated = await settingsService.updateBusinessInfo(
        businessId,
        userId,
        parsedBody,
        req.ip,
        req.headers['user-agent']
      );
      return res.status(200).json({
        status: 'success',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateBusinessSettings(req: any, res: any, next: any) {
    try {
      const businessId = req.user.businessId;
      const userId = req.user.id;
      const parsedBody = updateBusinessSettingsSchema.parse(req.body);

      // Check if user is trying to change allowNegativeStock and is not Administrator
      if (parsedBody.allowNegativeStock !== undefined && req.user.role !== 'Administrator') {
        throw new ForbiddenError('Solo el Administrador puede modificar la configuración de stock negativo');
      }

      const updated = await settingsService.updateBusinessSettings(
        businessId,
        userId,
        parsedBody,
        req.ip,
        req.headers['user-agent']
      );
      return res.status(200).json({
        status: 'success',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateFiscalSettings(req: any, res: any, next: any) {
    try {
      const businessId = req.user.businessId;
      const userId = req.user.id;
      const parsedBody = updateFiscalSettingsSchema.parse(req.body);
      const updated = await settingsService.updateFiscalSettings(
        businessId,
        userId,
        parsedBody,
        req.ip,
        req.headers['user-agent']
      );
      return res.status(200).json({
        status: 'success',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updatePOSSettings(req: any, res: any, next: any) {
    try {
      const businessId = req.user.businessId;
      const userId = req.user.id;
      const parsedBody = updatePOSSettingsSchema.parse(req.body);
      const updated = await settingsService.updatePOSSettings(
        businessId,
        userId,
        parsedBody,
        req.ip,
        req.headers['user-agent']
      );
      return res.status(200).json({
        status: 'success',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updatePrintSettings(req: any, res: any, next: any) {
    try {
      const businessId = req.user.businessId;
      const userId = req.user.id;
      const parsedBody = updatePrintSettingsSchema.parse(req.body);
      const updated = await settingsService.updatePrintSettings(
        businessId,
        userId,
        parsedBody,
        req.ip,
        req.headers['user-agent']
      );
      return res.status(200).json({
        status: 'success',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateEmailSettings(req: any, res: any, next: any) {
    try {
      const businessId = req.user.businessId;
      const userId = req.user.id;
      const parsedBody = updateEmailSettingsSchema.parse(req.body);
      const updated = await settingsService.updateEmailSettings(
        businessId,
        userId,
        parsedBody,
        req.ip,
        req.headers['user-agent']
      );
      return res.status(200).json({
        status: 'success',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async updateNumberSettings(req: any, res: any, next: any) {
    try {
      const businessId = req.user.businessId;
      const userId = req.user.id;
      const parsedBody = updateNumberSettingsSchema.parse(req.body);
      const updated = await settingsService.updateNumberSettings(
        businessId,
        userId,
        parsedBody,
        req.ip,
        req.headers['user-agent']
      );
      return res.status(200).json({
        status: 'success',
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  }
}
