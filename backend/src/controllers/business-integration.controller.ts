import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { BusinessIntegrationService } from '../services/business-integration.service';
import { MercadoPagoQrService } from '../services/mercado-pago-qr.service';
import { prisma } from '../config/db';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { AppError } from '../utils/appError';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { PointsService } from '../services/points.service';

export class BusinessIntegrationController {
  private service = new BusinessIntegrationService();
  private qrService = new MercadoPagoQrService();
  private pointsService = new PointsService();

  getIntegrations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.businessId;
      const data = await this.service.getIntegrations(businessId);
      res.status(200).json({ success: true, data });
    } catch (e) {
      next(e);
    }
  };

  saveMercadoPago = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.businessId;
      const context = {
        userId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      };
      const result = await this.service.saveMercadoPago(businessId, req.body, context);
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  };

  testMercadoPago = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.businessId;
      const context = {
        userId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      };
      const result = await this.service.testMercadoPago(businessId, context);
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  };

  createSalePreference = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.businessId;
      const { saleId } = req.body;

      if (!saleId) {
        throw new AppError('El saleId es obligatorio', 400);
      }

      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { items: { include: { product: true } } }
      });

      if (!sale || sale.businessId !== businessId) {
        throw new AppError('Venta no encontrada para este tenant.', 404);
      }

      const integration = await (prisma as any).businessIntegration.findUnique({
        where: {
          businessId_provider: {
            businessId,
            provider: 'MERCADO_PAGO'
          }
        }
      });

      if (!integration || integration.status !== 'ACTIVE') {
        throw new AppError('La integración de Mercado Pago no está configurada o activa.', 400);
      }

      const creds = integration.credentials as any;
      if (!creds || !creds.accessToken) {
        throw new AppError('La integración no posee Access Token configurado.', 400);
      }

      const mpConfig = new MercadoPagoConfig({ accessToken: creds.accessToken });
      const preferenceClient = new Preference(mpConfig);

      const items = sale.items.map((item: any) => ({
        id: item.productId,
        title: item.product.name,
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice),
        currency_id: 'ARS'
      }));

      const notificationUrl = `${env.BACKEND_URL}/api/v1/business/integrations/mercado-pago/webhook?businessId=${businessId}`;

      const prefResponse = await preferenceClient.create({
        body: {
          items,
          external_reference: saleId,
          notification_url: notificationUrl,
          back_urls: {
            success: `${env.FRONTEND_URL}/pos/payment-success?saleId=${saleId}`,
            failure: `${env.FRONTEND_URL}/pos/payment-failure?saleId=${saleId}`,
            pending: `${env.FRONTEND_URL}/pos/payment-pending?saleId=${saleId}`
          },
          auto_return: 'approved'
        }
      });

      res.status(200).json({
        success: true,
        data: {
          preferenceId: prefResponse.id,
          initPoint: prefResponse.init_point,
          sandboxInitPoint: prefResponse.sandbox_init_point
        }
      });
    } catch (e) {
      next(e);
    }
  };

  createQrOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user!.businessId;
      const { saleId, amount } = req.body;

      if (!saleId || !amount) {
        throw new AppError('El saleId y amount son obligatorios', 400);
      }

      const sale = await prisma.sale.findUnique({
        where: { id: saleId }
      });

      if (!sale || sale.businessId !== businessId) {
        throw new AppError('Venta no encontrada para este tenant.', 404);
      }

      const result = await this.qrService.createQrOrder(businessId, saleId, amount);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (e) {
      next(e);
    }
  };

  getPaymentStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { saleId } = req.params;
      if (!saleId) {
        throw new AppError('saleId es obligatorio.', 400);
      }

      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        select: {
          id: true,
          status: true,
          paymentStatus: true
        }
      });

      if (!sale) {
        throw new AppError('Venta no encontrada.', 404);
      }

      const isPaid = sale.paymentStatus === 'PAID' || sale.status === 'COMPLETED';
      const isFailed = sale.paymentStatus === 'FAILED' || sale.status === 'CANCELLED';

      return res.status(200).json({
        success: true,
        status: isPaid ? 'PAID' : isFailed ? 'FAILED' : 'PENDING'
      });
    } catch (e) {
      next(e);
    }
  };

  webhook = async (req: Request, res: Response, next: NextFunction) => {
    let webhookLogId: string | null = null;
    try {
      // ━━━ DIAGNOSTIC LOG ━━━
      // If this log does NOT appear in production, the 401 comes from OUTSIDE Express
      // (reverse proxy, firewall, CDN, or stale deploy).
      logger.info(`[MP WEBHOOK HIT] method=${req.method} url=${req.originalUrl} ip=${req.ip} content-type=${req.headers['content-type']} user-agent=${req.headers['user-agent']}`);

      logger.info(`[MP WEBHOOK QUERY] ${JSON.stringify(req.query)}`);
      logger.info(`[MP WEBHOOK BODY] ${JSON.stringify(req.body)}`);

      const topic = (req.query.topic as string) || (req.query.type as string) || req.body?.topic || req.body?.type || req.body?.action || 'unknown';
      let resourceId = '';
      if (req.body && req.body.data && req.body.data.id) {
        resourceId = String(req.body.data.id);
      } else if (req.body && req.body.id) {
        resourceId = String(req.body.id);
      } else if (req.query.id) {
        resourceId = String(req.query.id);
      } else if (req.query['data.id']) {
        resourceId = String(req.query['data.id']);
      } else if (req.body && req.body.resource) {
        const resourceStr = String(req.body.resource);
        const match = resourceStr.match(/\/(payments|orders|merchant_orders)\/([^\/]+)/);
        if (match) {
          resourceId = match[2];
        }
      }

      logger.info(`[MP WEBHOOK RECEIVED] event=${topic} resourceId=${resourceId}`);

      try {
        const logRecord = await prisma.mercadoPagoWebhookLog.create({
          data: {
            eventType: topic,
            resourceId: resourceId || null,
            payload: req.body || {},
            signatureValid: false,
            processed: false
          }
        });
        webhookLogId = logRecord.id;
        logger.info(`[MP WEBHOOK STORED] id=${webhookLogId}`);
      } catch (err) {
        console.error('[MP Webhook] Error saving initial webhook log:', err);
      }

      if (!resourceId) {
        return res.status(200).json({ success: true, message: 'Ignored: No resource ID found in payload' });
      }

      const rawExternalRef = (req.query.external_reference as string) || req.body?.external_reference || req.body?.data?.external_reference;

      let sale: any = null;

      if (rawExternalRef) {
        sale = await prisma.sale.findUnique({ where: { id: rawExternalRef }, include: { payments: true } });
      }

      if (!sale) {
        sale = await prisma.sale.findFirst({
          where: {
            OR: [
              { id: resourceId },
              { mpOrderId: resourceId },
              { mpPaymentId: resourceId }
            ]
          },
          include: { payments: true }
        });
      }

      let businessId: string | null = sale?.businessId || (req.query.businessId as string) || null;
      let integration: any = null;

      if (businessId) {
        integration = await (prisma as any).businessIntegration.findUnique({
          where: {
            businessId_provider: {
              businessId,
              provider: 'MERCADO_PAGO'
            }
          }
        });
      }

      if (!sale || !integration) {
        const activeIntegrations = await (prisma as any).businessIntegration.findMany({
          where: { provider: 'MERCADO_PAGO', status: 'ACTIVE' }
        });

        for (const integ of activeIntegrations) {
          const token = (integ.credentials as any)?.accessToken;
          if (!token) continue;

          const orderRes = await fetch(`https://api.mercadopago.com/v1/orders/${resourceId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (orderRes.ok) {
            const orderData: any = await orderRes.json();
            if (orderData.external_reference) {
              const foundSale = await prisma.sale.findUnique({
                where: { id: orderData.external_reference },
                include: { payments: true }
              });
              if (foundSale) {
                sale = foundSale;
                businessId = foundSale.businessId;
                integration = integ;
                break;
              }
            }
          }

          const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (paymentRes.ok) {
            const paymentData: any = await paymentRes.json();
            if (paymentData.external_reference) {
              const foundSale = await prisma.sale.findUnique({
                where: { id: paymentData.external_reference },
                include: { payments: true }
              });
              if (foundSale) {
                sale = foundSale;
                businessId = foundSale.businessId;
                integration = integ;
                break;
              }
            }
          }
        }
      }

      if (!sale || !businessId) {
        logger.warn(`[MP WEBHOOK] Could not resolve sale or tenant businessId for resourceId=${resourceId}`);
        if (webhookLogId) {
          await prisma.mercadoPagoWebhookLog.update({
            where: { id: webhookLogId },
            data: { error: 'Could not resolve tenant or sale' }
          }).catch(() => {});
        }
        return res.status(200).json({ success: true, message: 'Ignored: Could not resolve tenant or sale' });
      }

      logger.info(`[MP WEBHOOK TENANT RESOLVED] saleId=${sale.id} businessId=${businessId}`);

      const xSignature = req.headers['x-signature'] as string;
      const xRequestId = req.headers['x-request-id'] as string;
      const tenantWebhookSecret = integration?.webhookSecret;
      let signatureValid = false;

      if (tenantWebhookSecret) {
        if (!xSignature) {
          logger.warn(`[MP WEBHOOK SIGNATURE NOTICE] businessId=${businessId} resourceId=${resourceId} - Missing x-signature header (proceeding with MP API verification)`);
          if (webhookLogId) {
            await prisma.mercadoPagoWebhookLog.update({
              where: { id: webhookLogId },
              data: { businessId, saleId: sale.id, signatureValid: false, error: 'Missing x-signature header' }
            }).catch(() => {});
          }
        } else {
          const parts = xSignature.split(',');
          let ts = '';
          let hashV1 = '';
          for (const part of parts) {
            const [k, v] = part.split('=').map(s => s?.trim());
            if (k === 'ts') ts = v;
            if (k === 'v1') hashV1 = v;
          }

          const manifestTemplate = `id:${resourceId};request-id:${xRequestId || ''};ts:${ts};`;
          const calculatedHash = crypto.createHmac('sha256', tenantWebhookSecret).update(manifestTemplate).digest('hex');

          if (calculatedHash === hashV1) {
            signatureValid = true;
            logger.info(`[MP SIGNATURE VALIDATION] businessId=${businessId} resourceId=${resourceId} signatureValid=true`);
          } else {
            logger.warn(`[MP SIGNATURE VALIDATION NOTICE] businessId=${businessId} resourceId=${resourceId} - Signature mismatch (proceeding with MP API verification)`);
            if (webhookLogId) {
              await prisma.mercadoPagoWebhookLog.update({
                where: { id: webhookLogId },
                data: { businessId, saleId: sale.id, signatureValid: false, error: 'Signature mismatch' }
              }).catch(() => {});
            }
          }
        }
      } else {
        signatureValid = true;
        logger.info(`[MP WEBHOOK SIGNATURE] valid=true (Secret no configurado para el tenant)`);
      }

      const existingProcessedLog = await prisma.mercadoPagoWebhookLog.findFirst({
        where: {
          resourceId,
          eventType: topic,
          processed: true
        }
      });

      if (sale.paymentStatus === 'PAID' || sale.status === 'COMPLETED' || existingProcessedLog) {
        logger.info(`[MP WEBHOOK PROCESSED] saleId=${sale.id} businessId=${businessId} status=ALREADY_PAID (Idempotent skip)`);
        if (webhookLogId) {
          await prisma.mercadoPagoWebhookLog.update({
            where: { id: webhookLogId },
            data: {
              businessId,
              saleId: sale.id,
              signatureValid,
              processed: true,
              status: 'PAID'
            }
          }).catch(() => {});
        }
        return res.status(200).json({ success: true, message: 'Pago ya procesado previamente' });
      }

      const accessToken = integration?.credentials?.accessToken;
      const isOrderNotification = 
        topic === 'order' || 
        topic === 'merchant_order' || 
        topic === 'order.processed' || 
        req.body?.action === 'order.processed' || 
        (req.body?.resource && (String(req.body.resource).includes('/orders/') || String(req.body.resource).includes('/merchant_orders/')));
      
      let paymentId: string | null = null;
      let orderId: string | null = null;
      let isApproved = false;
      let isCancelledOrFailed = false;
      let amountPaid: number | undefined = undefined;

      if (isOrderNotification || resourceId.startsWith('ORD') || (sale.mpOrderId === resourceId)) {
        orderId = resourceId;

        if (accessToken) {
          let orderRes = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (!orderRes.ok) {
            orderRes = await fetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
          }

          if (orderRes.ok) {
            const orderData: any = await orderRes.json();
            const orderStatus = orderData.status;
            const payments = orderData.transactions?.payments || orderData.payments || [];
            if (payments.length > 0) {
              paymentId = String(payments[0].id || '');
              if (payments[0].amount || payments[0].total_paid_amount || payments[0].transaction_amount) {
                amountPaid = Number(payments[0].amount || payments[0].total_paid_amount || payments[0].transaction_amount);
              }
            }

            if (orderStatus === 'processed' || orderStatus === 'closed' || orderStatus === 'paid' || payments.some((p: any) => p.status === 'approved')) {
              isApproved = true;
            } else if (orderStatus === 'cancelled' || orderStatus === 'rejected') {
              isCancelledOrFailed = true;
            }
          }
        } else {
          isApproved = true;
        }
      } else {
        paymentId = resourceId;
        if (accessToken) {
          try {
            const mpConfig = new MercadoPagoConfig({ accessToken });
            const paymentClient = new Payment(mpConfig);
            const paymentDetails: any = await paymentClient.get({ id: paymentId });
            amountPaid = Number(paymentDetails.transaction_amount);
            if (paymentDetails.status === 'approved') {
              isApproved = true;
            } else if (paymentDetails.status === 'rejected' || paymentDetails.status === 'cancelled') {
              isCancelledOrFailed = true;
            }
          } catch (err: any) {
            const fallbackRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (fallbackRes.ok) {
              const paymentDetails: any = await fallbackRes.json();
              amountPaid = Number(paymentDetails.transaction_amount);
              if (paymentDetails.status === 'approved') {
                isApproved = true;
              } else if (paymentDetails.status === 'rejected' || paymentDetails.status === 'cancelled') {
                isCancelledOrFailed = true;
              }
            }
          }
        }
      }

      if (isApproved) {
        await prisma.$transaction(async (tx) => {
          let paymentMethod = await tx.paymentMethod.findFirst({
            where: { businessId, type: 'MERCADO_PAGO' }
          });

          if (!paymentMethod) {
            paymentMethod = await tx.paymentMethod.findFirst({
              where: { businessId, name: { contains: 'Mercado Pago', mode: 'insensitive' } }
            });
          }

          if (!paymentMethod) {
            paymentMethod = await tx.paymentMethod.create({
              data: {
                businessId,
                name: 'Mercado Pago',
                type: 'MERCADO_PAGO',
                isActive: true
              }
            });
          }

          const totalAmountToUse = amountPaid && amountPaid > 0 ? amountPaid : Number(sale.totalAmount);

          const pendingPayment = await tx.salePayment.findFirst({
            where: {
              saleId: sale.id,
              provider: 'MERCADO_PAGO',
              status: 'PENDING'
            }
          });

          if (pendingPayment) {
            await tx.salePayment.update({
              where: { id: pendingPayment.id },
              data: {
                status: 'APPROVED',
                amount: totalAmountToUse,
                transactionReference: paymentId || orderId || '',
                providerPaymentId: paymentId || null,
                externalReference: sale.id,
                details: `Cobro Mercado Pago Webhook (Aprobado: ${paymentId || orderId})`
              }
            });
          } else {
            await tx.salePayment.create({
              data: {
                saleId: sale.id,
                paymentMethodId: paymentMethod.id,
                amount: totalAmountToUse,
                transactionReference: paymentId || orderId || '',
                providerPaymentId: paymentId || null,
                provider: 'MERCADO_PAGO',
                status: 'APPROVED',
                externalReference: sale.id,
                details: `Cobro Mercado Pago Webhook (Aprobado: ${paymentId || orderId})`
              }
            });
          }

          await tx.sale.update({
            where: { id: sale.id },
            data: {
              status: 'COMPLETED',
              paymentStatus: 'PAID',
              mpOrderId: orderId || sale.mpOrderId,
              mpPaymentId: paymentId || sale.mpPaymentId
            }
          });

          // Acreditación/Canje de puntos para Mercado Pago Webhook
          await this.pointsService.processSale(sale.id, sale.createdById, tx);

          if (sale.cashSessionId) {
            await tx.cashMovement.create({
              data: {
                businessId,
                cashSessionId: sale.cashSessionId,
                createdById: sale.createdById,
                paymentMethodId: paymentMethod.id,
                paymentMethod: 'MERCADO_PAGO',
                type: 'IN',
                amount: totalAmountToUse,
                referenceType: 'SALE',
                referenceId: sale.id,
                reason: `Cobro Mercado Pago Webhook Venta #${sale.documentNumber} (ID: ${paymentId || orderId})`
              } as any
            });

            await tx.cashSession.update({
              where: { id: sale.cashSessionId },
              data: {
                cashTransactionsTotal: { increment: totalAmountToUse }
              }
            });
          }

          await tx.activityLog.create({
            data: {
              businessId,
              userId: sale.createdById,
              entityName: 'SalePayment',
              entityId: paymentId || orderId || sale.id,
              actionType: 'MP_PAYMENT_APPROVED',
              previousValues: '{}',
              newValues: JSON.stringify({
                paymentId,
                orderId,
                saleId: sale.id,
                amount: totalAmountToUse,
                status: 'approved'
              })
            } as any
          });
        });

      } else if (isCancelledOrFailed) {
        await prisma.sale.update({
          where: { id: sale.id },
          data: {
            status: 'CANCELLED',
            paymentStatus: 'FAILED'
          }
        });

        const pendingPayment = await prisma.salePayment.findFirst({
          where: {
            saleId: sale.id,
            provider: 'MERCADO_PAGO',
            status: 'PENDING'
          }
        });

        if (pendingPayment) {
          await prisma.salePayment.update({
            where: { id: pendingPayment.id },
            data: {
              status: 'FAILED',
              transactionReference: paymentId || orderId || '',
              providerPaymentId: paymentId || null,
              details: `Cobro Mercado Pago Webhook (Rechazado/Cancelado: ${paymentId || orderId})`
            }
          });
        }

        await prisma.activityLog.create({
          data: {
            businessId,
            userId: sale.createdById,
            entityName: 'SalePayment',
            entityId: paymentId || orderId || sale.id,
            actionType: 'MP_PAYMENT_FAILED',
            previousValues: '{}',
            newValues: JSON.stringify({
              paymentId,
              orderId,
              saleId: sale.id,
              status: 'failed'
            })
          } as any
        });
      }

      const finalStatusStr = isApproved ? 'approved' : isCancelledOrFailed ? 'failed' : 'pending';

      if (webhookLogId) {
        await prisma.mercadoPagoWebhookLog.update({
          where: { id: webhookLogId },
          data: {
            businessId,
            saleId: sale.id,
            orderId,
            paymentId,
            status: finalStatusStr,
            signatureValid,
            processed: true
          }
        }).catch(() => {});
      }

      logger.info(`[MP WEBHOOK SAVED] event=${topic} orderId=${orderId} paymentId=${paymentId} businessId=${businessId} processed=true`);

      return res.status(200).json({ success: true });
    } catch (e: any) {
      console.error('[MP Tenant Webhook] Webhook error processing notification:', e);
      if (webhookLogId) {
        await prisma.mercadoPagoWebhookLog.update({
          where: { id: webhookLogId },
          data: { processed: false, error: e.message || String(e) }
        }).catch(() => {});
      }
      return res.status(200).json({ success: false, error: e.message || String(e) });
    }
  };
}
