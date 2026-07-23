# ⚙️ FLUJOS DE NEGOCIO ALGORÍTMICOS 

Este archivo traza la interacción automatizada entre tablas interdependientes durante transacciones operativas a nivel de Sistema y a nivel Inquilino (ERP).

---

## 1. FLUJO DE VENTAS / PUNTO DE VENTA (Retail)

**Actor:** Usuario (Con rol Salesman/Admin).
**Trigger:** Solicitud `POST /api/v1/pos` o `/api/v1/sales`.
**Tablas orquestadas:**
`Sale` ➡️ `SaleItem` ➡️ `SalePayment` ➡️ `CashMovement` ➡️ `Stock` ➡️ `StockMovement` ➡️ `ActivityLog`

**Ciclo de vida interno Backend (Transaction ACID):**
1. Deduce precios configurados contra el ID de Producto (`Product`).
2. Confirma `CashSession` abierta activa asociando la venta en curso al cajero.
3. Almacena Cabecera `Sale` e ítems serializados.
4. Efectúa el decremento (Salida) del sistema de Kardex `StockMovement` de las bodegas seleccionadas en tiempo real.
5. Inyecta `SalePayment` de la cantidad económica al balance de la caja (Ventas).
6. Log (Staff Traceability).

---

## 2. FLUJO DE RENOVACIÓN DE SUSCRIPCIÓN SAAS (Billing)

**Actor:** Automático (Servidor) a través de `Mercado Pago Webhook`.
**Trigger:** Petición HTTP silenciosa externa POST `/api/v1/system/payments/webhook`.
**Tablas orquestadas:**
`SystemGatewayConfig` (Validación) ➡️ `Invoice` (Actualización de Estado) ➡️ `Subscription` (Extensión Cronológica) ➡️ `ActivityLog` (Doble inserción).

**Ciclo de vida interno:**
1. Desencripta Payload HTTP contra Signature Secreta de API Key validando que sea legítimo de mercado pago.
2. Encuentra la Factura Pendiente atada (`Invoice.id == MP.external_reference`).
3. Setea `Status: PAID`.
4. Busca la vinculación `Business` -> `Subscription` respectiva y suma +1 unidad (30 días/365 días dependiendo el ciclo).
5. Invoca el `Nodemailer` remando un Mail de Agradecimiento vía HTML Template.

---

## 3. FLUJO MAESTRO DE INVENTARIO B2B (Compras)

**Actor:** Usuario operario del Almacén ERP.
**Trigger:** `POST /api/v1/purchases`.
**Tablas implicadas:**
`Purchase` ➡️ `PurchaseItem` ➡️ `Supplier` ➡️ `StockMovement` ➡️ `Warehouse` ➡️ `ActivityLog`.

**Ciclo de Vida:**
1. Autentica recepción de material proveniente de X `Supplier` hacia Y `Warehouse`.
2. Suma dinámicamente o crea unidades absolutas de `Stock`. Escribe iterativamente `StockMovements` de entrada por cada compra validada.
3. Actualiza contabilidad general o costo Unitario promedio base si es requerido.

---

## 4. FLUJO DE MULTITENANT (Discriminación de Negocios)
**Actor:** Todos los Endpoints estándar ERP (No SaaS).
**Mecanismo:** El Middleware JwtExtrae `businessId`.
**Ejecución Repositorio Automática:**
En vez de hacer `.findMany()`, todos los Repositorios inyectan obligatoriamente el Scope de segregación del Tenant:
```ts
prisma.sale.findMany({
   where: { businessId: userAuth.business.id }
});
```
*Ninguna excepción existe. Si ocurre filtración de BusinessID en una consulta general, prisma retornaría error 404 al contrastante físico o simplemente se perderá en un log.*
