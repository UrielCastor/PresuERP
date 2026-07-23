import { Request, Response, NextFunction } from 'express';
import { SystemPaymentService } from './system.payment.service';

export class SystemPaymentController {
  private service = new SystemPaymentService();

  public testConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = {
        userId: req.user?.id,
        businessId: req.user?.businessId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      };

      const result = await this.service.testConnection(context);
      res.status(result.status).json(result.body);
    } catch (error) {
      next(error);
    }
  };
}
