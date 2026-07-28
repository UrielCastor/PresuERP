import { Router } from 'express';
import { BusinessIntegrationController } from '../controllers/business-integration.controller';

/**
 * Ruta DEDICADA para el webhook de Mercado Pago.
 * 
 * Se monta en app.ts ANTES de CORS, Helmet y cualquier otro middleware global
 * para garantizar que ninguna capa pueda bloquear las notificaciones server-to-server
 * que envía Mercado Pago (sin JWT, sin Origin header, sin cookies).
 * 
 * Seguridad:
 * - Validación de firma HMAC (x-signature) cuando el tenant tiene webhookSecret configurado
 * - Verificación contra la API de Mercado Pago (consulta payment/order con accessToken del tenant)
 * - Resolución de tenant vía external_reference / sale lookup (no accede a datos de otros tenants)
 */
const router = Router();
const controller = new BusinessIntegrationController();

// Body parser inline — necesario porque este router se monta ANTES del express.json() global
import express from 'express';
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

router.post('/', controller.webhook);

export default router;
