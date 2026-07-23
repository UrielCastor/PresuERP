import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import nodemailer from 'nodemailer';
import { env } from '../config/env';

export class BillingController {

  public saveConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { provider, accessToken, publicKey, webhookSecret, environment } = req.body;

      const config = await (prisma as any).systemGatewayConfig.upsert({
         where: { provider: provider || 'MERCADO_PAGO' },
         update: { accessToken, publicKey, webhookSecret, environment },
         create: { provider: provider || 'MERCADO_PAGO', accessToken, publicKey, webhookSecret, environment }
      });
      
      res.status(200).json({ success: true, data: config });
    } catch (e) { next(e); }
  };

  public testConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const config = await (prisma as any).systemGatewayConfig.findFirst({ where: { provider: 'MERCADO_PAGO' } });
      if (!config || !config.accessToken) {
         return res.status(400).json({ success: false, message: 'Mercado Pago no configurado.' });
      }

      // Initialize Native SDK to test credentials mapping correctly against ML APIs
      const client = new MercadoPagoConfig({ accessToken: config.accessToken });
      const preference = new Preference(client);

      try {
         // Create a dummy preference to validate token successfully authenticates
         const pref = await preference.create({
            body: {
               items: [{
                  id: 'TEST_ITEM',
                  title: 'SDK Validation Test',
                  quantity: 1,
                  unit_price: 10
               }],
               auto_return: 'approved'
            }
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

         res.status(200).json({ 
            success: true, 
            message: '✓ Credenciales válidas y conectividad verificada.',
            lastTestAt: now,
            lastTestStatus: 'SUCCESS'
         });
      } catch (err: any) {
         const now = new Date();
         const errorDetails = err.message || String(err);
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

         res.status(400).json({ 
            success: false, 
            message: `✗ Access Token inválido o permisos insuficientes. ${errorDetails}` 
         });
      }
    } catch (e) { next(e); }
  };

  public getConfig = async (req: Request, res: Response, next: NextFunction) => {
      try {
         const config = await (prisma as any).systemGatewayConfig.findFirst({ where: { provider: 'MERCADO_PAGO' } });
         res.status(200).json({ success: true, data: config });
      } catch(e) { next(e); }
  };

  public createPreference = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { businessId, planId, billingCycle, subscriptionId } = req.body;

      console.log(`[Billing Engine] Received request to create preference for Business: ${businessId}, Plan: ${planId}, Cycle: ${billingCycle}, Subscription: ${subscriptionId}`);

      const plan = await (prisma as any).plan.findUnique({
        where: { id: planId },
        include: { prices: true }
      });
      if (!plan) {
         console.warn(`[Billing Engine] CreatePreference failed: Plan ${planId} not found.`);
         return res.status(404).json({ success: false, message: 'Plan no encontrado o inactivo.' });
      }

      // Resolve price from PlanPrice matching billingCycle
      const planPrice = plan.prices.find((p: any) => p.billingCycle === billingCycle && p.active);
      if (!planPrice) {
         console.warn(`[Billing Engine] CreatePreference failed: Active price for cycle ${billingCycle} not found on plan ${plan.name}.`);
         return res.status(400).json({ success: false, message: `El plan no posee un precio activo para el ciclo ${billingCycle}.` });
      }

      const calculatedAmount = Number(planPrice.price);

      const sub = await (prisma as any).subscription.findUnique({
         where: { id: subscriptionId },
         include: { business: true }
      });
      if (!sub) {
         console.warn(`[Billing Engine] CreatePreference failed: Subscription ${subscriptionId} not found.`);
         return res.status(404).json({ success: false, message: 'Suscripción no encontrada.' });
      }

      // Structure billing logically checking idempotency loosely
      const preInvoice = await (prisma as any).invoice.create({
         data: {
            subscriptionId,
            planId,
            planCode: plan.code,
            planName: plan.name,
            billingCycle,
            amount: calculatedAmount,
            status: 'PENDING',
            provider: 'MERCADO_PAGO'
         }
      });
      console.log(`[Billing Engine] Pre-invoice created in database: InvoiceID=${preInvoice.id}, Status=PENDING, Amount=${calculatedAmount}`);

      // Special case for $0/FREE plan prices
      if (calculatedAmount <= 0) {
        console.log(`[Billing Engine] Initializing immediate activation for FREE/0-amount plan price for Invoice: ${preInvoice.id}`);
        // Mark as paid immediately and renew subscription
        await (prisma as any).invoice.update({
           where: { id: preInvoice.id },
           data: { status: 'PAID', paidAt: new Date() }
        });

        let newRenewal: Date | null = sub.renewalDate ? new Date(sub.renewalDate) : new Date();
        if (billingCycle === 'FREE') {
          newRenewal = null;
        } else if (billingCycle === 'MONTHLY') {
          newRenewal.setMonth(newRenewal.getMonth() + 1);
        } else if (billingCycle === 'QUARTERLY') {
          newRenewal.setMonth(newRenewal.getMonth() + 3);
        } else if (billingCycle === 'SEMIANNUAL') {
          newRenewal.setMonth(newRenewal.getMonth() + 6);
        } else if (billingCycle === 'YEARLY') {
          newRenewal.setFullYear(newRenewal.getFullYear() + 1);
        } else if (billingCycle === 'LIFETIME') {
          newRenewal = null;
        }

        await (prisma as any).subscription.update({
           where: { id: sub.id },
           data: { 
             status: 'ACTIVE', 
             renewalDate: newRenewal,
             planId,
             billingCycle
           }
        });

        await prisma.business.update({
           where: { id: sub.businessId },
           data: { 
              subscriptionPlan: plan.name,
              subscriptionEndsAt: newRenewal
           }
        });

        console.log(`[Billing Engine] FREE Subscription activated successfully. Ends at: ${newRenewal}`);

        return res.status(200).json({ 
          success: true, 
          data: { 
             checkoutUrl: null, 
             preferenceId: null, 
             invoiceId: preInvoice.id,
             isFree: true 
          }
        });
      }
      
      const config = await (prisma as any).systemGatewayConfig.findFirst({ where: { provider: 'MERCADO_PAGO' } });
      if (!config || !config.accessToken) {
         console.warn(`[Billing Engine] Decoupled payment aborted: system gateway configuration not active/valid in database.`);
         return res.status(400).json({ success: false, message: 'Gateways de pago inactivos.' });
      }

      // Native MercadoPago mapping
      const client = new MercadoPagoConfig({ accessToken: config.accessToken });
      const preference = new Preference(client);

      const pref = await preference.create({
         body: {
            items: [{
               id: plan.code || 'PLAN',
               title: `Suscripción SaaS - ${plan.name} (${billingCycle})`,
               quantity: 1,
               unit_price: calculatedAmount
            }],
            external_reference: preInvoice.id,
            back_urls: {
               success: `${env.FRONTEND_URL}/payment/success`,
               failure: `${env.FRONTEND_URL}/payment/failure`,
               pending: `${env.FRONTEND_URL}/payment/pending`
            },
            notification_url: `${env.BACKEND_URL}/api/v1/system/payments/webhook`,
            auto_return: 'approved',
            payer: {
               email: sub.business?.email || 'facturacion@presuerp.com'
            },
            metadata: {
               invoice_id: preInvoice.id,
               subscription_id: subscriptionId,
               business_id: businessId,
               plan_id: planId,
               billing_cycle: billingCycle
            }
         }
      });
      
      console.log(`[Billing Engine] Mercado Pago Preference created successfully. PreferenceID: ${pref.id}, InvoiceID: ${preInvoice.id}`);

      await (prisma as any).invoice.update({
          where: { id: preInvoice.id },
          data: { 
             providerReference: pref.id,
             externalReference: pref.id
          }
      });

      // We resolve the generic init_point if PROD, or sandbox if selected
      const checkoutUrl = config.environment === 'PRODUCTION' ? pref.init_point : pref.sandbox_init_point;
      console.log(`[Billing Engine] Returning Checkout url (${config.environment}): ${checkoutUrl}`);

      res.status(200).json({ 
          success: true, 
          data: { 
             checkoutUrl, 
             preferenceId: pref.id, 
             invoiceId: preInvoice.id 
          }
      });
    } catch (e) { 
       console.error(`[Billing Engine] Error creating Mercado Pago credential preference:`, e);
       next(e); 
    }
  };

  public webhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log(`[Billing Webhook] Incoming callback received from Mercado Pago. Body:`, JSON.stringify(req.body), `Query:`, JSON.stringify(req.query));
      
      const config = await (prisma as any).systemGatewayConfig.findFirst({ where: { provider: 'MERCADO_PAGO' } });

      // We respond 200 immediately to acknowledge receipt of the notification
      res.status(200).send('OK');

      // Extract payment ID from various possible formats of Webhook / IPN
      let paymentId: string | null = null;
      if (req.body && req.body.data && req.body.data.id) {
         paymentId = String(req.body.data.id);
      } else if (req.body && req.body.id && (req.body.type === 'payment' || req.body.action?.includes('payment'))) {
         paymentId = String(req.body.id);
      } else if (req.query && req.query.id && (req.query.topic === 'payment' || req.query.type === 'payment')) {
         paymentId = String(req.query.id);
      }

      if (!paymentId && req.body && req.body.resource) {
         const match = req.body.resource.match(/\/payments\/(\d+)/);
         if (match) {
            paymentId = match[1];
         }
      }

      if (!paymentId) {
         console.log(`[Billing Webhook] Callback body does not represent a payment event. Skipping processing.`);
         return;
      }

      console.log(`[Billing Webhook] Detected Payment ID: ${paymentId}. Starting asynchronous retrieval...`);
      
      // Async process
      const client = new MercadoPagoConfig({ accessToken: config?.accessToken || '' });
      const paymentObj = new Payment(client);
      
      let paymentData: any = null;
      try {
         console.log(`[Billing Webhook] Fetching payment details for ID ${paymentId} using standard SDK Client...`);
         paymentData = await paymentObj.get({ id: paymentId });
      } catch (sdkError: any) {
         console.warn(`[Billing Webhook] SDK failed to retrieve payment ${paymentId}: ${sdkError.message || sdkError}. Using direct fetch API as fallback...`);
         try {
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
               headers: { 'Authorization': `Bearer ${config?.accessToken}` }
            });
            if (response.ok) {
               paymentData = await response.json();
            } else {
               console.error(`[Billing Webhook] Direct fetch failed for payment ${paymentId}. Response Status: ${response.status}`);
            }
         } catch (fallbackError) {
            console.error(`[Billing Webhook] Direct fetch fallback failed as well:`, fallbackError);
         }
      }

      if (!paymentData) {
         console.error(`[Billing Webhook] Failed to retrieve payment info for ID: ${paymentId}. Aborting processing.`);
         return;
      }

      const status = paymentData.status;
      const invoiceId = paymentData.external_reference;

      console.log(`[Billing Webhook] Payment ${paymentId} details retrieved. Status: ${status}, InvoiceID (external_reference): ${invoiceId}`);

      if (status === 'approved' && invoiceId) {
         const invoice = await (prisma as any).invoice.findUnique({
            where: { id: invoiceId },
            include: { subscription: { include: { business: true } } }
         });

         if (!invoice) {
            console.error(`[Billing Webhook] Invoice ${invoiceId} not found in database! Payment ID: ${paymentId}`);
            return;
         }

         if (invoice.status === 'PAID') {
            console.log(`[Billing Webhook] Invoice ${invoiceId} is already marked as PAID. Skipping redundancy.`);
            return;
         }

         const sub = invoice.subscription;
         if (!sub) {
            console.error(`[Billing Webhook] Invoice ${invoiceId} does not associate with any SaaS Subscription object! Payment ID: ${paymentId}`);
            return;
         }

         console.log(`[Billing Webhook] Payment approved. Marking invoice ${invoiceId} as PAID and renewing subscription ${sub.id} for business "${sub.business?.name}"`);

         // 1. Mark Invoice as Paid
         await (prisma as any).invoice.update({
            where: { id: invoice.id },
            data: { status: 'PAID', paidAt: new Date() }
         });

         // 2. Compute Subscription next renewal cycle starting from today (if expired) or extending future renewal date (if active)
         const cycle = invoice.billingCycle || sub.billingCycle;
         let baseDate = new Date();
         if (sub.renewalDate && new Date(sub.renewalDate) > new Date()) {
            baseDate = new Date(sub.renewalDate);
         }
         let newRenewal: Date | null = new Date(baseDate);
         
         if (cycle === 'FREE') {
            newRenewal = null;
         } else if (cycle === 'MONTHLY') {
            newRenewal.setMonth(newRenewal.getMonth() + 1);
         } else if (cycle === 'QUARTERLY') {
            newRenewal.setMonth(newRenewal.getMonth() + 3);
         } else if (cycle === 'SEMIANNUAL') {
            newRenewal.setMonth(newRenewal.getMonth() + 6);
         } else if (cycle === 'YEARLY') {
            newRenewal.setFullYear(newRenewal.getFullYear() + 1);
         } else if (cycle === 'LIFETIME') {
            newRenewal = null;
         }

         // 3. Renew Subscription
         await (prisma as any).subscription.update({
            where: { id: sub.id },
            data: { 
               status: 'ACTIVE', 
               renewalDate: newRenewal,
               planId: invoice.planId || sub.planId,
               billingCycle: cycle
            }
         });

         // 4. Sync business object details
         const planName = invoice.planName || 'Professional';
         await prisma.business.update({
            where: { id: sub.businessId },
            data: { 
               subscriptionPlan: planName,
               subscriptionEndsAt: newRenewal
            }
         });

         console.log(`[Billing Webhook] Database synchronized successfully. New renewal date: ${newRenewal}`);

         // 5. Log Activity
         await (prisma as any).activityLog.create({
           data: {
              businessId: sub.businessId, // For isolating tenant specific view
              actionType: 'PAYMENT_APPROVED', // System standard mapped tags
              entityName: 'INVOICE',
              entityId: invoice.id,
              newValues: JSON.stringify({ amount: invoice.amount, paymentId: paymentId })
           }
         });
         
         await (prisma as any).activityLog.create({
           data: {
              businessId: sub.businessId,
              actionType: 'SUBSCRIPTION_RENEWED',
              entityName: 'SUBSCRIPTION',
              entityId: sub.id,
              newValues: JSON.stringify({ nextRenewal: newRenewal, cycle })
           }
         });
         
         console.log(`[Billing Webhook] System Audit logs entries successfully recorded for business ${sub.businessId}`);

         // 6. Fire Automated Subscribed Email
         const recipientEmail = sub.business.email || 'contacto@test.com';
         this.sendActivationEmail(recipientEmail, sub.business.name);
      } else {
         console.log(`[Billing Webhook] Event ignored (Payment status: "${status}" is not approved or external_reference not matching).`);
      }
    } catch (e) {
       console.error("[Billing Webhook] Webhook Handler general processing failure:", e);
    }
  };

  private sendActivationEmail = async (to: string, businessName: string) => {
     try {
         const transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
               user: "test@ethereal.email",
               pass: "testpassword"
            },
         });

         const htmlContent = `
         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
             <h2>Suscripción activada</h2>
             <p>Hola <strong>${businessName}</strong>,</p>
             <p>Hemos recibido correctamente el pago de tu suscripción.</p>
             <p>Tu plan ya se encuentra operando dentro de un nuevo ciclo activo.</p>
             <br/>
             <p>Gracias por utilizar PresuERP.</p>
             <p><strong>Equipo de Plataforma PresuERP.</strong></p>
         </div>`;

         await transporter.sendMail({
            from: '"PresuERP Admin" <no-reply@presuerp.com>',
            to,
            subject: 'Suscripción activada',
            html: htmlContent
         });

         console.log(`[Billing Engine] Activation email explicitly dispatched for ${to}`);
     } catch (e) {
         console.warn(`[Billing Engine] Failed delivering activation payload explicitly ${e}`);
     }
  };
}
