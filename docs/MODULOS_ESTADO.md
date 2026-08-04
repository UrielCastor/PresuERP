# 📦 ESTADO ACTIVO E INVENTARIO DE MÓDULOS

A continuación se indexan las agrupaciones lógicas de funcionales, estableciendo un mapa de trazabilidad entre sus actores Fullstack en PresuERP.

---

## 1. Módulo Core / Auth
**Estado:** FUNCIONAL COMPLETAMENTE
**Ubicación Backend:** `auth.controller.ts`, `auth.service.ts`, `auth.routes.ts`
**Ubicación Frontend:** `Login.tsx`, `AuthContext.tsx`
**Descripción:** Provee acceso seguro al ecosistema validando contraseñas Bcrypt y emitiendo JSON Web Tokens (Access + Refresh tokens). Resuelve interrupciones de sesión expidiendo auto-renovaciones.
**Funcionalidades:**
✅ Login usuario
✅ Autorefresh de Token API silencioso
✅ Validación Inquilino base (`businessId`)

---

## 2. Módulo Sistema (SaaS Global Staff)
**Estado:** FUNCIONAL COMPLETAMENTE
**Ubicación Backend:** `/src/system/*` (`system.routes.ts`, `billing`, `plan`, `audit`)
**Ubicación Frontend:** `/system/pages/*` (`SystemDashboard`, `SystemSettings`, `SystemAudit`)
**Descripción:** El núcleo de infraestructura comercial de la plataforma SaaS (Billing & Subscriptions).
**Funcionalidades:**
✅ Tarjetas Analíticas Globales (MRR, Renovaciones).
✅ Suscripciones e integraciones SDK nativas (Mercado Pago Checkout Pro + Webhooks).
✅ Auditoría Global Segurizada con JSON masking (Logs centralizados).
✅ Suspend / Activate de Tenants independientes.

---

## 3. Módulo Catálogo (Productos, Categorías, Marcas)
**Estado:** FUNCIONAL COMPLETAMENTE
**Ubicación Backend:** `product.*`, `category.*`, `brand.*`
**Ubicación Frontend:** `Products.tsx`, `Categories.tsx`, `Brands.tsx`
**Descripción:** Control exhaustivo de ABM (Alta, Baja y Modificación) del inventariado para el ERP comercial.
**Funcionalidades:**
✅ Listado cruzado con precios, impuestos, y jerarquías (Categoría -> SubCategoría).
✅ Soporte de Barcodes.
✅ Modificadores de Stock referenciados.

---

## 4. Módulo Punto de Venta (POS) & Ventas B2B
**Estado:** FUNCIONAL COMPLETAMENTE
**Ubicación Backend:** `pos.*`, `sales.*` y `cash.*`
**Ubicación Frontend:** `POS.tsx`, `Sales.tsx`, `Cash.tsx`
**Descripción:** El motor de registro de comercialización e impresión.
**Funcionalidades:**
✅ Interfaz POS interactiva y minimalista.
✅ Flujo automatizado: Transacción POS descuento de cajas y reducción real paramétrica de inventario (Stock API).
✅ Sesiones de Cajeros (Arqueo de Entradas).

---

## 5. Módulo Compras & Stock Engine (Kardex)
**Estado:** FUNCIONAL COMPLETAMENTE
**Ubicación Backend:** `purchase.*`, `supplier.*`, `stock.*`, `warehouse.*`
**Ubicación Frontend:** `Purchases.tsx`, `Suppliers.tsx`, `Stocks.tsx`, `Kardex.tsx`
**Descripción:** El eje de abastecimiento B2B que cruza proveedores con bodegas.
**Funcionalidades:**
✅ Recepción de Ítems e inyección masiva al `Warehouse`.
✅ Registro en Kardex inmutable (`StockMovement`) al recibir compra.
✅ Cuentas de Pasivos con Proveedores (Mapeadas parcialmente).

---

## 6. Módulo Zonas Críticas No Modificables (Staff y RBAC)
**Estado:** FUNCIONAL COMPLETAMENTE
**Descripción:** Tablas y Hooks intrínsecos al motor de Permisos (`roles.routes.ts`, `Auth Interceptors`). Evita transacciones no autorizadas (Middlewares como `requireSystemAdmin`, `canDo('SALES_CREATE')`). Solo para administradores de franquicias o de sistema interno.
