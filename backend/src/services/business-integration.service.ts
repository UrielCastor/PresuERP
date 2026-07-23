import { prisma } from '../config/db';
import { BusinessIntegrationRepository } from '../repositories/business-integration.repository';
import { MercadoPagoConfig, User } from 'mercadopago';
import { AppError } from '../utils/appError';
import { logger } from '../config/logger';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class BusinessIntegrationService {
  private repository = new BusinessIntegrationRepository();

  private maskString(str: string | null | undefined, visibleCount: number = 8) {
    if (!str) return '';
    if (str.length <= visibleCount) return '********';
    return `${str.substring(0, visibleCount)}********`;
  }

  async getIntegrations(businessId: string) {
    const integrations = await this.repository.findAllByBusiness(businessId);
    
    // Format response enmasking sensitive keys
    return integrations.map((item: any) => {
      const creds = item.credentials as any;
      const isTokenConfigured = !!creds?.accessToken;
      const isSecretConfigured = !!item.webhookSecret;
      return {
        id: item.id,
        provider: item.provider,
        type: item.type,
        status: item.status,
        lastTestStatus: item.lastTestStatus,
        lastTestAt: item.lastTestAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        hasWebhookSecret: isSecretConfigured,
        webhookSecretConfigured: isSecretConfigured,
        webhookSecretMasked: isSecretConfigured ? '••••••••' : '',
        webhookSecret: '',
        credentials: {
          publicKey: creds?.publicKey || '',
          environment: creds?.environment || 'SANDBOX',
          accessToken: '',
          accessTokenMasked: isTokenConfigured ? '••••••••' : '',
          hasAccessToken: isTokenConfigured,
          accessTokenConfigured: isTokenConfigured
        }
      };
    });
  }

  async getIntegrationByProvider(businessId: string, provider: string) {
    const integration = await this.repository.findByBusinessAndProvider(businessId, provider);
    if (!integration) return null;
    
    const creds = integration.credentials as any;
    const isTokenConfigured = !!creds?.accessToken;
    const isSecretConfigured = !!integration.webhookSecret;
    return {
      id: integration.id,
      provider: integration.provider,
      type: integration.type,
      status: integration.status,
      lastTestStatus: integration.lastTestStatus,
      lastTestAt: integration.lastTestAt,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
      hasWebhookSecret: isSecretConfigured,
      webhookSecretConfigured: isSecretConfigured,
      webhookSecretMasked: isSecretConfigured ? '••••••••' : '',
      webhookSecret: '',
      credentials: {
        publicKey: creds?.publicKey || '',
        environment: creds?.environment || 'SANDBOX',
        accessToken: '',
        accessTokenMasked: isTokenConfigured ? '••••••••' : '',
        hasAccessToken: isTokenConfigured,
        accessTokenConfigured: isTokenConfigured
      }
    };
  }

  async saveMercadoPago(businessId: string, data: { accessToken?: string | null; publicKey?: string; environment?: string; webhookSecret?: string | null }, context: AuditContext) {
    // Fetch existing integration for credentials merge
    const existing = await this.repository.findByBusinessAndProvider(businessId, 'MERCADO_PAGO');
    const existingCreds = (existing?.credentials as any) || {};

    const isDummyOrEmpty = (val?: string | null) => {
      if (!val) return true;
      const trimmed = val.trim();
      return trimmed === '' || trimmed === '••••••••' || trimmed.includes('********');
    };

    let finalAccessToken = existingCreds.accessToken || '';
    let accessTokenChanged = false;

    if (!isDummyOrEmpty(data.accessToken)) {
      finalAccessToken = data.accessToken!.trim();
      accessTokenChanged = true;
    }

    if (!finalAccessToken) {
      throw new AppError('AccessToken es obligatorio para configurar la integración.', 400);
    }

    let finalPublicKey = existingCreds.publicKey || '';
    if (data.publicKey && data.publicKey.trim() !== '') {
      finalPublicKey = data.publicKey.trim();
    }

    if (!finalPublicKey) {
      throw new AppError('PublicKey es obligatoria para configurar la integración.', 400);
    }

    const credentials = {
      accessToken: finalAccessToken,
      publicKey: finalPublicKey,
      environment: data.environment || existingCreds.environment || 'SANDBOX'
    };

    let finalWebhookSecret = existing?.webhookSecret || undefined;
    let webhookSecretChanged = false;

    if (!isDummyOrEmpty(data.webhookSecret)) {
      finalWebhookSecret = data.webhookSecret!.trim();
      webhookSecretChanged = true;
    }

    logger.info(`[MP CONFIG UPDATE] businessId=${businessId} accessTokenChanged=${accessTokenChanged} webhookSecretChanged=${webhookSecretChanged}`);

    const result = await this.repository.upsert(
      businessId,
      'MERCADO_PAGO',
      'PAYMENTS',
      credentials,
      'ACTIVE',
      finalWebhookSecret
    );

    // Register Activity Log
    await prisma.activityLog.create({
      data: {
        userId: context.userId || null,
        businessId,
        actionType: 'MP_INTEGRATION_SAVE',
        entityName: 'BUSINESS_INTEGRATION',
        entityId: result.id,
        newValues: JSON.stringify({
          provider: 'MERCADO_PAGO',
          environment: credentials.environment,
          publicKey: credentials.publicKey
        }),
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null
      } as any
    });

    return {
      success: true,
      data: {
        id: result.id,
        provider: result.provider,
        status: result.status,
        lastTestStatus: result.lastTestStatus,
        lastTestAt: result.lastTestAt
      }
    };
  }

  async testMercadoPago(businessId: string, context: AuditContext) {
    const config = await this.repository.findByBusinessAndProvider(businessId, 'MERCADO_PAGO');
    if (!config) {
      throw new AppError('Mercado Pago no está configurado para esta empresa.', 404);
    }

    const creds = config.credentials as any;
    if (!creds || !creds.accessToken) {
      throw new AppError('Falta el Access Token en la configuración.', 400);
    }

    try {
      const client = new MercadoPagoConfig({ accessToken: creds.accessToken });
      const userClient = new User(client);
      await userClient.get();

      const now = new Date();
      await (prisma as any).businessIntegration.update({
        where: { id: config.id },
        data: {
          lastTestStatus: 'SUCCESS',
          lastTestAt: now
        }
      });

      console.log(`Mercado Pago connection test saved\nstatus: SUCCESS\ndate: ${now.toISOString()}`);

      // Log success activity
      await prisma.activityLog.create({
        data: {
          userId: context.userId || null,
          businessId,
          actionType: 'MP_INTEGRATION_TEST_SUCCESS',
          entityName: 'BUSINESS_INTEGRATION',
          entityId: config.id,
          newValues: JSON.stringify({ status: 'SUCCESS', date: now }),
          ipAddress: context.ipAddress || null,
          userAgent: context.userAgent || null
        } as any
      });

      return {
        success: true,
        message: 'Conexión exitosa con Mercado Pago'
      };

    } catch (err: any) {
      const now = new Date();
      const errorMsg = err.message || String(err);

      try {
        await (prisma as any).businessIntegration.update({
          where: { id: config.id },
          data: {
            lastTestStatus: 'FAILED',
            lastTestAt: now
          }
        });
      } catch (dbErr: any) {
        console.error(`Failed to update businessIntegration on test failure: ${dbErr.message}`);
      }

      console.log(`Mercado Pago connection test failed\nreason: ${errorMsg}`);

      // Log failure activity
      await prisma.activityLog.create({
        data: {
          userId: context.userId || null,
          businessId,
          actionType: 'MP_INTEGRATION_TEST_FAILED',
          entityName: 'BUSINESS_INTEGRATION',
          entityId: config.id,
          newValues: JSON.stringify({ status: 'FAILED', reason: errorMsg }),
          ipAddress: context.ipAddress || null,
          userAgent: context.userAgent || null
        } as any
      });

      return {
        success: false,
        message: 'Error de conexión'
      };
    }
  }
}
