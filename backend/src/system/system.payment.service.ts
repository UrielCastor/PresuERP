import { MercadoPagoConfig, User } from 'mercadopago';
import { prisma } from '../config/db';

export interface TestConnectionContext {
  userId?: string;
  businessId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class SystemPaymentService {
  async testConnection(context: TestConnectionContext) {
    try {
      // 1. Get credentials from DB
      const config = await (prisma as any).systemGatewayConfig.findFirst({
        where: { provider: 'MERCADO_PAGO' }
      });

      // 2. Validate Access Token exists
      if (!config || !config.accessToken) {
        return {
          status: 400,
          body: {
            success: false,
            message: "No hay Access Token configurado."
          }
        };
      }

      // 3. Create Mercado Pago SDK client
      const client = new MercadoPagoConfig({ accessToken: config.accessToken });
      const userClient = new User(client);

      try {
        // 4. Call official user API
        await userClient.get();

        // 5. Successful connection: register positive Activity Log
        await this.logActivity(context, config.id, 'MP_CONNECTION_TEST', {
          status: 'SUCCESS',
          message: 'Mercado Pago connection tested successfully.'
        });

        const now = new Date();
        await (prisma as any).systemGatewayConfig.update({
          where: { id: config.id },
          data: {
            lastTestStatus: 'SUCCESS',
            lastTestAt: now,
            lastTestVersion: '2.0.x'
          }
        });

        console.log(`Mercado Pago connection test saved\nstatus: SUCCESS\ndate: ${now.toISOString()}`);

        return {
          status: 200,
          body: {
            success: true,
            connected: true,
            environment: config.environment ? config.environment.toLowerCase() : 'sandbox',
            sdk: 'v2',
            message: 'Conexión exitosa con Mercado Pago.'
          }
        };
      } catch (err: any) {
        const errorDetails = err.message || String(err);
        const now = new Date();
        
        try {
          await (prisma as any).systemGatewayConfig.update({
            where: { id: config.id },
            data: {
              lastTestStatus: 'FAILED',
              lastTestAt: now,
              lastTestVersion: '2.0.x'
            }
          });
        } catch (dbErr: any) {
          console.error(`Failed to update systemGatewayConfig on test failure: ${dbErr.message}`);
        }

        console.log(`Mercado Pago connection test failed\nreason: ${errorDetails}`);

        // 6. Token is invalid or permissions issue
        const isUnauthorized = 
          (err.status === 401 || err.statusCode === 401) ||
          (err.cause && (err.cause.status === 401 || err.cause.statusCode === 401)) ||
          (err.message && (
            err.message.includes('401') || 
            err.message.toLowerCase().includes('unauthorized') || 
            err.message.toLowerCase().includes('invalid client') ||
            err.message.toLowerCase().includes('invalid_token') ||
            err.message.toLowerCase().includes('credential')
          ));

        if (isUnauthorized) {
          // Register failed Activity Log
          await this.logActivity(context, config.id, 'MP_CONNECTION_TEST', {
            status: 'FAILED',
            message: 'Mercado Pago connection failed.'
          });

          return {
            status: 401,
            body: {
              success: false,
              connected: false,
              message: "Access Token inválido."
            }
          };
        }

        // 7. Communication or network/unexpected error
        await this.logActivity(context, config.id, 'MP_CONNECTION_TEST', {
          status: 'FAILED',
          message: 'Mercado Pago connection failed.'
        });

        return {
          status: 500,
          body: {
            success: false,
            connected: false,
            message: "No fue posible comunicar con Mercado Pago.",
            error: errorDetails
          }
        };
      }
    } catch (e: any) {
      const errorDetails = e.message || String(e);
      return {
        status: 500,
        body: {
          success: false,
          connected: false,
          message: "No fue posible comunicar con Mercado Pago.",
          error: errorDetails
        }
      };
    }
  }

  private async logActivity(context: TestConnectionContext, configId: string, actionType: string, values: any) {
    try {
      // businessId is non-nullable in schema, so resolve user business or fallback to first business in the system
      let businessId = context.businessId;
      if (!businessId) {
        const firstBusiness = await prisma.business.findFirst({ select: { id: true } });
        if (firstBusiness) {
          businessId = firstBusiness.id;
        }
      }

      if (businessId) {
        await prisma.activityLog.create({
          data: {
            userId: context.userId || null,
            businessId: businessId,
            actionType,
            entityName: 'SYSTEM_GATEWAY_CONFIG',
            entityId: configId || 'SYSTEM',
            newValues: JSON.stringify(values),
            ipAddress: context.ipAddress || null,
            userAgent: context.userAgent || null
          } as any
        });
      } else {
        console.warn(`[System Payment Service] Activity log skipped. No businesses exist.`);
      }
    } catch (e) {
      console.error(`[System Payment Service] Failed to write ActivityLog:`, e);
    }
  }
}
