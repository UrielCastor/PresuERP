# PRESUERP - AI DEVELOPMENT KIT: THIRD-PARTY INTEGRATIONS

Este documento proporciona la especificación técnica y de desarrollo oficial de las **Integraciones de Terceros (Integrations)** de **PresuERP**, detallando los patrones de comunicación con Mercado Pago para cobros integrados, facturación fiscal con la AFIP de Argentina, y mensajería automatizada por WhatsApp/API.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

PresuERP interactúa con servicios externos para automatizar procesamientos fiscales y pasarelas de pago de mostrador.
*   **Abstracción y Resiliencia**: Toda llamada externa se envuelve en clientes desacoplados con reintentos automáticos, asegurando que un fallo transitorio del proveedor externo no bloquee la interacción en base del sistema local.
*   **Seguridad de Claves de Acceso**: Prohibición de guardar credenciales de producción de pasarelas de pago en bases de datos locales o archivos de código fuente.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El consumo de servicios externos de comunicaciones y cobro sigue este patrón modular:

```
[ Capa de Dominio / Services ]
               │
               ▼
[ Integration Adapter Interface ] (Define métodos abstractos)
               │
               ▼
  [ Concrete Adapter: AFIP / MP ]
 (Consume API Externa con Axios / SDKs)
               │
      ┌────────┴────────┐
      ▼                 ▼
[ Mercado Pago SDK ]  [ AFIP Soap WebService ]
```

---

## 3. INTEGRACIÓN CON MERCADO PAGO O PASARELAS DE PAGO

Utilizado por el mostrador POS rápido para procesar pagos vía QR o enlaces de cobro:
1.  **Firma del Cobro**: El `POSService` dispara al adaptador local un pedido de cobro inyectando el importe y el `businessId`.
2.  **Generación de Preferencias**: Se consume la API de Mercado Pago (`/v1/payments`) inyectando las credenciales guardadas en el `.env`. Se recibe la URL de pago de destino y se actualiza el ticket local a estado de espera de cobro.
3.  **Webhook de Cierre (IPN)**: Endpoint abierto en el backend (`/api/v1/webhooks/mercadopago`) que recibe el ping de Mercado Pago avisando de la acreditación. El controlador verifica con el SDK la autenticidad del pago y confirma la venta rápida de forma transparente en caja.

---

## 4. INTEGRACIÓN DE FACTURACIÓN FISCAL AFIP (ARGENTINA WEBSERVICES)

*   **Infraestructura**: Comunicación bajo protocolo SOAP/XML consumiendo los endpoints de la AFIP (Factura Electrónica).
*   **Autenticación**: Mediante el servicio de autorización de AFIP (WSAA) inyectando el certificado digital privado (`.key`) y el certificado homologado (`.crt`) del inquilino propietario (`businessId`), obteniendo un token y firma temporales de acceso (TA).
*   **Cierre de Factura (CAE)**: Envío del lote de compras e impuestos del POS para obtener el Código de Autorización Electrónico (CAE) indispensable para la fiscalidad del remito comercial.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en la arquitectura de integraciones para evitar cobros o facturaciones cruzadas entre inquilinos.
2.  **Operación Asíncrona en Redes (Timeouts)**: Las APIs gubernamentales o pasarelas pueden sufrir latencias severas. Se prohíbe bloquear transacciones de base de datos Postgres locales durante llamadas HTTP salientes síncronas. Todo procesamiento fiscal debe desacoplarse para evitar agotar las conexiones del pool de Prisma.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
