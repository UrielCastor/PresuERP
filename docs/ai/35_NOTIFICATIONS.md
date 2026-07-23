# PRESUERP - AI DEVELOPMENT KIT: NOTIFICATION SYSTEM

Este documento proporciona la especificación técnica y de desarrollo oficial del **Sistema de Notificaciones (Notification System)** de **PresuERP**, detallando los disparadores basados en eventos transaccionales, las interfaces de transmisión y los canales de comunicación.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **Notifications** tiene como fin informar en tiempo real a los operarios, cajeros y supervisores sobre incidencias de inventarios, cierres impositivos y alertas transaccionales del negocio.
*   **Diseño Reactivo**: Acoplado a eventos del sistema para evitar consultas polling repetitivas del frontend.
*   **Gobernanza de Canal**: Clasificar notificaciones por nivel de prioridad para emitir correos o despachar eventos rápidos WebSockets.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El motor de notificaciones opera bajo un modelo de Publicador/Suscriptor (Pub-Sub) reactivo:

```
[ Operación en Service ] (Aprobación Compras / Ajuste Stock)
            │
            ▼
[ EventEmitter / Dispatcher ] (Emite evento del sistema)
            │
            ▼
[ NotificationService ] (Determina destinatarios del businessId)
            │
      ┌─────┴───────────────────────────────────┐
      ▼                                         ▼
[ Canal Asincrónico: Email ]             [ Canal Sincrónico: WS ]
(Envío vía SMTP de PDFs o alertas)     (Notificación realtime en UI React)
```

---

## 3. CATÁLOGO DE EVENTOS TRANSAIONALES DISPARADOS

El sistema reacciona y despacha ante los siguientes hitos de negocio:
1.  **`STOCK_BELOW_MINIMUM`**: Disparado inmediatamente cuando `StockMovementService` registra una salida que decrementa el stock consolidado del producto por debajo del `minimumStock` parametrizado en la tabla `stocks`.
2.  **`PURCHASE_APPROVED`**: Alerta despachada tras transicionar una compra a `APPROVED`, notificando al depósito destino para preparar la recepción física.
3.  **`USER_ROLE_CHANGED`**: Notificación de seguridad transaccional emitida al operario tras modificarse sus privilegios RBAC en Express.

---

## 4. CANALES DE COMUNICACIÓN INTEGRADOS

### 1. Canal Real-Time (WebSockets / Socket.io)
*   **Propósito**: Entrega inmediata de alertas emergentes (Popups) dentro de la SPA React.
*   **Aislamiento**: Durante el evento `connection`, el socket recupera e inspecciona el JWT de autenticación para suscribir al cliente al canal exclusivo del tenant: `socket.join(businessId)`. Queda terminantemente prohibido despachar alertas web sin filtrado por sala de socket.

### 2. Canal Asincrónico (Email Engine)
*   **Propósito**: Despacho de comprobantes (PDF) de compras formalizadas o reportes agregados semanales.
*   **Infraestructura**: Integrado vía **Nodemailer** parametrizando credenciales seguras SMTP en el archivo `.env` del backend. Las plantillas de email deben compilarse en formato HTML inline adaptándose a clientes móviles.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en las notificaciones para evitar fugas de información inter-empresa.
2.  **Locks Concurrentes por Ráfagas de Emails**: El envío de correos es una operación de red lenta. Se prohíbe colgar la llamada de Nodemailer de forma directa en el flujo transaccional del controlador principal del backend. Los desvíos a emails deben correr de forma asíncrona (utilizando promesas desacopladas `Promise.resolve().then(...)` o colas de fondo), liberando de inmediato la respuesta al operario de caja.
3.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
