import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import QRCode from 'qrcode';
import { env } from '../config/env';
import { logger } from '../config/logger';

function normalizeCountry(country?: string): string {
  if (!country) {
    return 'AR';
  }

  const value = country.toLowerCase().trim();

  switch (value) {
    case 'argentina':
    case 'ar':
    case 'arg':
      return 'AR';

    case 'brasil':
    case 'brazil':
    case 'br':
      return 'BR';

    case 'chile':
    case 'cl':
      return 'CL';

    case 'uruguay':
    case 'uy':
      return 'UY';

    default:
      return country;
  }
}



function getDefaultCoordinates(countryCode: string) {
  switch (countryCode) {
    case 'AR':
      return { latitude: -34.6037, longitude: -58.3816 }; // Buenos Aires, Argentina
    case 'BR':
      return { latitude: -23.5505, longitude: -46.6333 }; // Sao Paulo, Brazil
    case 'CL':
      return { latitude: -33.4489, longitude: -70.6693 }; // Santiago, Chile
    case 'UY':
      return { latitude: -34.9011, longitude: -56.1645 }; // Montevideo, Uruguay
    default:
      return { latitude: -34.6037, longitude: -58.3816 };
  }
}

function sanitizeExternalId(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '');
}

export class MercadoPagoQrService {
  constructor() {
    logger.info('🔥 MERCADO PAGO QR SERVICE CARGADO');
    console.log('🔥 MERCADO PAGO QR SERVICE CARGADO');
  }

  /**
   * Generates a dynamic QR code for a POS payment order.
   * Ensures that a Store and a POS exist for the tenant in Mercado Pago,
   * associates the order with that POS, and generates a Base64 QR code image.
   */
  async createQrOrder(businessId: string, saleId: string, amount: number) {
    logger.info(`🔥 CREATE QR ORDER INICIADO - businessId: ${businessId}, saleId: ${saleId}, amount: ${amount}`);
    console.log(`🔥 CREATE QR ORDER INICIADO - businessId: ${businessId}, saleId: ${saleId}, amount: ${amount}`);
    // 1. Fetch backend business integration
    const integration = await prisma.businessIntegration.findUnique({
      where: {
        businessId_provider: {
          businessId,
          provider: 'MERCADO_PAGO'
        }
      }
    });

    if (!integration || integration.status !== 'ACTIVE') {
      throw new AppError('Integración de Mercado Pago no está activa para esta empresa.', 400);
    }

    const credentials = integration.credentials as any;
    if (!credentials || !credentials.accessToken) {
      throw new AppError('Credenciales de Mercado Pago incompletas.', 400);
    }

    const accessToken = credentials.accessToken;

    // Fetch real business details for location
    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business) {
      throw new AppError('La empresa no fue encontrada.', 404);
    }

    // Dynamic address parameters with fallbacks
    const streetName = business.address || 'Tarragona 1364 Bis Departamento 4 PB';
    const cityName = business.city || 'Rosario';
    const stateName = business.state || 'Santa Fe';
    const countryName = business.country || 'Argentina';
    const normalizedCountryCode = normalizeCountry(countryName);

    // Derive street number dynamically from street address
    let streetNumber = '1';
    const numMatch = streetName.match(/\d+/);
    if (numMatch) {
      streetNumber = numMatch[0];
    }

    // Compute coordinates dynamically matching the selected country
    const defaultCoords = getDefaultCoordinates(normalizedCountryCode);
    const latitude = Number((business as any).latitude) || defaultCoords.latitude;
    const longitude = Number((business as any).longitude) || defaultCoords.longitude;

    try {
      // 2. Fetch User info (collector_id) from Mercado Pago
      const userRes = await fetch('https://api.mercadopago.com/users/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!userRes.ok) {
        throw new AppError('Error al obtener datos de cuenta de Mercado Pago.', 400);
      }

      const userData = await userRes.json();
      const collectorId = userData.id;

      if (!collectorId) {
        throw new AppError('No se pudo identificar el collector_id de Mercado Pago.', 400);
      }

      // 3. Define unique external identifiers (must be strictly alphanumeric for Mercado Pago)
      const sanitizedBusinessId = sanitizeExternalId(businessId);
      const storeExternalId = `STORE${sanitizedBusinessId}`;
      const posExternalId = `POS${sanitizedBusinessId}`;

      // Logs: External IDs generated
      logger.info(
        `[MP QR] External IDs generated`,
        {
          businessId,
          storeExternalId,
          posExternalId
        }
      );

      // 4. Resolve Store in Mercado Pago
      let storeId: number | null = null;
      const lookupStore = async () => {
        logger.info(
          `[MP STORE SEARCH DEBUG] collectorId=${collectorId} externalId=${storeExternalId}`
        );
        const storeSearchRes = await fetch(
          `https://api.mercadopago.com/users/${collectorId}/stores/search?external_id=${storeExternalId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );
        if (storeSearchRes.ok) {
          const storeSearchData = await storeSearchRes.json();
          logger.info(
            `[MP STORE LIST RESPONSE] ${JSON.stringify(storeSearchData)}`
          );
          if (storeSearchData.results && storeSearchData.results.length > 0) {
            return storeSearchData.results[0].id;
          }
        } else {
          const errText = await storeSearchRes.text();
          logger.error(`[MP STORES SEARCH ERROR] Status: ${storeSearchRes.status}, Body: ${errText}`);
        }
        return null;
      };

      storeId = await lookupStore();

      if (storeId) {
        logger.info(
          `[MP STORE EXISTS]\nexternalId:\n${storeExternalId}\nstoreId:\n${storeId}`
        );
      }

      // If store does not exist, create it
      if (!storeId) {
        // Log store creation and specify which businessId initiated it
        logger.info(`[MP QR Service] Creating Mercado Pago Store for businessId: ${businessId} with location details: street_name="${streetName}", city_name="${cityName}", state_name="${stateName}", country_name="${normalizedCountryCode}"`);

        const createStoreRes = await fetch(`https://api.mercadopago.com/users/${collectorId}/stores`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `PresuERP Sucursal`,
            external_id: storeExternalId,
            location: {
              street_number: streetNumber,
              street_name: streetName,
              city_name: cityName,
              state_name: stateName,
              latitude,
              longitude
            }
          })
        });

        if (!createStoreRes.ok) {
          const errText = await createStoreRes.text();
          // If already assigned or similar: lookup again
          if (errText.includes('already assigned') || errText.includes('already exists') || createStoreRes.status === 400 || createStoreRes.status === 409) {
            logger.info(`[MP QR Service] Store creation returned error but external_id might already exist, falling back to lookup: ${errText}`);
            storeId = await lookupStore();
            if (storeId) {
              logger.info(
                `[MP STORE EXISTS]\nexternalId:\n${storeExternalId}\nstoreId:\n${storeId}`
              );
            }
          }
          if (!storeId) {
            console.error('[MP QR Service] Store creation error:', errText);
            throw new AppError(`Fallo al dar de alta la sucursal en Mercado Pago: ${errText}`, 400);
          }
        } else {
          const newStore = await createStoreRes.json();
          storeId = newStore.id;
          logger.info(
            `[MP STORE CREATED]\nexternalId:\n${storeExternalId}\nstoreId:\n${storeId}`
          );
        }
      }

      // Log: [MP DEBUG STORE]
      logger.info(
        `[MP DEBUG STORE]\ncollectorId:\n${collectorId}\nexternalStoreId:\n${storeExternalId}\nstoreId:\n${storeId}`
      );

      // 5. Resolve POS in Mercado Pago
      let posCreatedOrFound = false;
      let posId: number | null = null;
      let posObj: any = null;
      const lookupPos = async () => {
        const posListRes = await fetch(
          `https://api.mercadopago.com/pos?external_id=${posExternalId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );
        if (posListRes.ok) {
          const posListData = await posListRes.json();
          if (posListData.results && posListData.results.length > 0) {
            return posListData.results[0];
          }
        }
        return null;
      };

      posObj = await lookupPos();
      if (posObj) {
        posId = posObj.id;
        posCreatedOrFound = true;
      }

      // If POS does not exist, create it
      if (!posCreatedOrFound) {
        const createPosRes = await fetch('https://api.mercadopago.com/pos', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Caja POS ERP',
            fixed_amount: true,
            external_id: posExternalId,
            store_id: storeId
          })
        });

        if (!createPosRes.ok) {
          const errText = await createPosRes.text();
          // If already assigned or similar: lookup again
          if (errText.includes('already assigned') || errText.includes('already exists') || createPosRes.status === 400 || createPosRes.status === 409) {
            logger.info(`[MP QR Service] POS creation returned error but external_id might already exist, falling back to lookup: ${errText}`);
            posObj = await lookupPos();
            if (posObj) {
              posId = posObj.id;
              posCreatedOrFound = true;
            }
          }
          if (!posCreatedOrFound) {
            console.error('[MP QR Service] POS creation error:', errText);
            throw new AppError(`Fallo al dar de alta la caja POS en Mercado Pago: ${errText}`, 400);
          }
        } else {
          posObj = await createPosRes.json();
          // Assertions on newly created POS
          if (!posObj || !posObj.external_id) {
            throw new AppError('La caja POS no pudo registrarse correctamente en Mercado Pago (external_id ausente).', 400);
          }
          posId = posObj.id;
          posCreatedOrFound = true;
        }
      }

      // Log: [MP DEBUG POS]
      logger.info(
        `[MP DEBUG POS]\nexternalPosId:\n${posExternalId}\nposId:\n${posId}`
      );

      // 6. Crear orden usando la nueva API oficial POST /v1/orders
      // Documentación: https://www.mercadopago.com.ar/developers/es/reference/in-person-payments/qr-code/orders/create-order/post
      // Respuesta esperada: HTTP 201 con type_response.qr_data
      const idempotencyKey = `${saleId}-${Date.now()}`;
      const formattedAmount = Number(amount).toFixed(2);

      const requestPayload = {
        type: 'qr',
        total_amount: formattedAmount,
        description: `Venta POS #${saleId.substring(0, 8)}`,
        external_reference: saleId,
        config: {
          qr: {
            external_pos_id: posExternalId,
            mode: 'dynamic'
          }
        },
        transactions: {
          payments: [
            {
              amount: formattedAmount
            }
          ]
        },
        items: [
          {
            title: 'Cobro Venta ERP',
            unit_price: formattedAmount,
            quantity: 1,
            unit_measure: 'unit'
          }
        ]
      };

      const requestTimestamp = new Date().toISOString();

      // Log inmediatamente antes del fetch
      console.log(`[MP BEFORE FETCH TIMESTAMP]: ${requestTimestamp}`);
      console.log(`[MP SENT X-Idempotency-Key]: ${idempotencyKey}`);
      console.log(`[MP SENT requestPayload]:\n${JSON.stringify(requestPayload, null, 2)}`);
      logger.info(`🔥 MP BEFORE FETCH | Timestamp: ${requestTimestamp} | URL: https://api.mercadopago.com/v1/orders | Idempotency-Key: ${idempotencyKey} | Payload:\n${JSON.stringify(requestPayload, null, 2)}`);

      const orderRes = await fetch('https://api.mercadopago.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(requestPayload)
      });

      const orderText = await orderRes.text();
      let orderData: any = {};
      try {
        if (orderText) orderData = JSON.parse(orderText);
      } catch (err) {}
      const responseTimestamp = new Date().toISOString();

      // Extraer headers de respuesta
      const responseHeaders: Record<string, string> = {};
      orderRes.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const xRequestId = orderRes.headers.get('x-request-id') || responseHeaders['x-request-id'] || null;
      const xIdempotencyKeyResp = orderRes.headers.get('x-idempotency-key') || responseHeaders['x-idempotency-key'] || null;

      // Log inmediatamente después del fetch
      console.log(`[MP AFTER FETCH TIMESTAMP]: ${responseTimestamp}`);
      console.log(`[MP RESPONSE STATUS]: ${orderRes.status} ${orderRes.statusText}`);
      console.log(`[MP RESPONSE x-request-id]: ${xRequestId}`);
      console.log(`[MP RESPONSE x-idempotency-key]: ${xIdempotencyKeyResp}`);
      console.log(`[MP RESPONSE HEADERS]:\n${JSON.stringify(responseHeaders, null, 2)}`);
      console.log(`[MP RESPONSE BODY]:\n${orderText}`);

      logger.info(`🔥 MP RESPONSE STATUS: ${orderRes.status} ${orderRes.statusText} | x-request-id: ${xRequestId}`);
      logger.info(`🔥 MP RESPONSE BODY: ${orderText}`);

      logger.info(`[MP V1 ORDERS RESPONSE]
Timestamp: ${responseTimestamp}
Sent X-Idempotency-Key: ${idempotencyKey}
HTTP Status: ${orderRes.status} ${orderRes.statusText}
x-request-id: ${xRequestId}
x-idempotency-key: ${xIdempotencyKeyResp}
Headers: ${JSON.stringify(responseHeaders, null, 2)}
Body: ${orderText}`);

      // 3. Parseo
      logger.info(`[MP PARSED RESPONSE]\nid: ${orderData.id ?? null}\nstatus: ${orderData.status ?? null}\ntype: ${orderData.type ?? null}\ntype_response: ${JSON.stringify(orderData.type_response ?? null)}\nqr_data: ${orderData.type_response?.qr_data ?? orderData.qr_data ?? null}\nconfig: ${JSON.stringify(orderData.config ?? null)}\nFull Object: ${JSON.stringify(orderData, null, 2)}`);

      // 4. Comparación automática respecto a la documentación oficial
      const comparison: string[] = [];

      if (orderRes.status !== 201) {
        comparison.push(`- Status HTTP devuelto (${orderRes.status}) difiere del esperado por la API Orders oficial (201 Created).`);
      }

      if (orderText.includes("additionalProperties '$.notification_url' not allowed")) {
        comparison.push(`- El payload incluía 'notification_url' en la raíz. La API Orders v1 de Mercado Pago rechaza este parámetro no soportado en la raíz con error 'unsupported_properties'.`);
      }

      if (orderRes.ok) {
        if (!orderData.id) {
          comparison.push(`- Campo obligatorio faltante en respuesta: 'id'.`);
        }
        if (!orderData.status) {
          comparison.push(`- Campo obligatorio faltante en respuesta: 'status'.`);
        }
        const qrData = orderData.type_response?.qr_data || orderData.qr_data;
        if (!qrData) {
          comparison.push(`- Campo obligatorio faltante para la generación del QR: 'type_response.qr_data'.`);
          const posMode = orderData.config?.qr?.mode || requestPayload.config.qr.mode;
          if (posMode === 'static') {
            comparison.push(`- La configuración de la aplicación/caja opera en modo 'static'. En este modo Mercado Pago no genera 'qr_data' en la respuesta HTTP.`);
          } else {
            comparison.push(`- Se solicitó modo '${posMode}', pero Mercado Pago no devolvió 'qr_data'. La cuenta/aplicación puede no tener habilitada la emisión de QR dinámico presencial.`);
          }
        }
      } else {
        comparison.push(`- Mercado Pago rechazó la solicitud debido a propiedades no permitidas en la especificación de API Orders v1 o errores de validación/autorización.`);
      }

      logger.info(`[MP COMPARISON]\n${comparison.join('\n')}`);

      if (!orderRes.ok) {
        throw new AppError(
          `Fallo al crear la orden QR en Mercado Pago. Status: ${orderRes.status}, Body: ${orderText}`,
          400
        );
      }

      // El qr_data está en type_response.qr_data según la API oficial
      const qrCodeString: string =
        orderData.type_response?.qr_data ||
        orderData.qr_data ||
        orderData.qr_code ||
        orderData.qr_code_base64 ||
        '';

      // ── Sin fallbacks: error claro si MP no devolvió QR oficial ────────────
      logger.info(`[MP QR FINAL VALUE] length=${qrCodeString?.length ?? 0}  value=${qrCodeString || '(vacío)'}`);

      if (!qrCodeString) {
        throw new AppError(
          'Mercado Pago creó la orden pero no devolvió un QR de pago válido.',
          400
        );
      }


      // Extraer datos de la orden creada
      const mpOrderId = orderData.id ? String(orderData.id) : null;
      const mpPaymentId = orderData.transactions?.payments?.[0]?.id 
        ? String(orderData.transactions.payments[0].id) 
        : (orderData.type_response?.payment_id ? String(orderData.type_response.payment_id) : null);

      // Guardar mpOrderId, mpPaymentId y status en Sale
      await prisma.sale.update({
        where: { id: saleId },
        data: {
          mpOrderId,
          mpPaymentId,
          paymentStatus: 'PENDING'
        }
      });

      logger.info(`[MP QR CREATED] orderId=${mpOrderId || '(none)'} paymentId=${mpPaymentId || '(none)'} saleId=${saleId} businessId=${businessId}`);

      // Generar Base64 a partir del string QR oficial
      logger.info(`[MP QR DEBUG]
length=${qrCodeString.length}
value=${qrCodeString}
`);
      const qrCodeBase64 = await QRCode.toDataURL(qrCodeString);

      // 8. Register MP Reference in SalePayment as PENDING
      // Fetch or create the PaymentMethod for MP
      let paymentMethod = await prisma.paymentMethod.findFirst({
        where: { businessId, type: 'MERCADO_PAGO' }
      });

      if (!paymentMethod) {
        paymentMethod = await prisma.paymentMethod.create({
          data: {
            businessId,
            name: 'Mercado Pago',
            type: 'MERCADO_PAGO',
            isActive: true
          }
        });
      }

      // Create a transient pending payment record (allowing webhook reconciliation)
      await prisma.salePayment.create({
        data: {
          saleId,
          paymentMethodId: paymentMethod.id,
          amount: Number(amount),
          transactionReference: mpPaymentId || '',
          provider: 'MERCADO_PAGO',
          providerPaymentId: mpPaymentId || null,
          status: 'PENDING',
          externalReference: saleId,
          details: `Cobro por QR pendiente en Caja ${posExternalId}`
        }
      });

      // 9. Return required format (always return success: true format)
      return {
        success: true,
        qrCode: qrCodeString || '',
        qrCodeBase64: qrCodeBase64 || '',
        paymentId: '', // initially empty
        saleId
      };
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      console.error('[MP QR Service] Error:', e);
      throw new AppError(`Error en el servicio de pago QR Mercado Pago: ${e.message || String(e)}`, 500);
    }
  }
}
