import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';

const userService = new UserService();

export class UserController {
  static async list(req: any, res: any, next: any) {
    try {
      const businessId = req.user.businessId;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const result = await userService.list(businessId, page, limit);
      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async findById(req: any, res: any, next: any) {
    try {
      const businessId = req.user.businessId;
      const id = req.params.id;

      const user = await userService.findById(id, businessId);
      return res.status(200).json({
        status: 'success',
        data: user,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async create(req: any, res: any, next: any) {
    try {
      const operator = req.user;
      console.log('🔥 [BACKEND USER CREATE REQ.BODY]', JSON.stringify(req.body, null, 2));
      const result = await userService.create(
        req.body,
        operator,
        req.ip,
        req.headers['user-agent']
      );

      return res.status(201).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async update(req: any, res: any, next: any) {
    try {
      const id = req.params.id;
      const operator = req.user;
      console.log(`🔥 [BACKEND USER UPDATE ${id} REQ.BODY]`, JSON.stringify(req.body, null, 2));
      const result = await userService.update(
        id,
        req.body,
        operator,
        req.ip,
        req.headers['user-agent']
      );

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req: any, res: any, next: any) {
    try {
      const id = req.params.id;
      const operator = req.user;
      const result = await userService.delete(
        id,
        operator,
        req.ip,
        req.headers['user-agent']
      );

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }
}
