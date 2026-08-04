import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
  private authService = new AuthService();

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessName, taxId, adminName, adminEmail, adminPasswordPlain } = req.body;
      const result = await this.authService.registerBusinessTenant({
        businessName,
        taxId,
        adminName,
        adminEmail,
        adminPasswordPlain,
      });

      res.status(201).json({
        status: 'success',
        message: 'Business tenant and administrator registered successfully',
        data: {
          business: {
            id: result.business.id,
            name: result.business.name,
            taxId: result.business.taxId,
          },
          admin: {
            id: result.admin.id,
            name: result.admin.name,
            email: result.admin.email,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const { accessToken, refreshToken, user } = await this.authService.login(email, password);

      // Optionally set as HTTP-only cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.status(200).json({
        status: 'success',
        message: 'Logged in successfully',
        data: {
          accessToken,
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.body.token || req.cookies?.refreshToken;
      const { accessToken, refreshToken } = await this.authService.refreshToken(token);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.status(200).json({
        status: 'success',
        data: {
          accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.body?.token || req.cookies?.refreshToken;
      const userId = (req as any).user?.id;

      if (token || userId) {
        await this.authService.logout(token, userId);
      }

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
