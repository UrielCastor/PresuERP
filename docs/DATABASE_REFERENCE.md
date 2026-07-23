# 🗄️ DATABASE REFERENCE GLOBAL - Ecosistema PRESUERP

Prisma Architecture (Schema versión 2026/07). PostegreSQL base. 
Este archivo consolida las principales Entidades de Datos sin omitir su interdependencia obligatoria hacia las validaciones funcionales Multi-tenant.

## ZONA A: SAAS STAFF GLOBAL 🌍

### 1. Sistema & Planes
- **`Plan`** 
  - *Uso:* Plantillas dinámicas base SaaS.
  - *Campos:* `name`, `price`, `maxUsers`, `features` (JSON).
  - *Relaciones:* Nutre a múltiples `Subscription`.

- **`Subscription`**
  - *Uso:* Estado comercial contractual de un INQUILINO (Tenant).
  - *Campos:* `billingCycle`, `status` (ACTIVE, OVERDUE), `currentPeriodEnd`.
  - *Relaciones:* Pertenece a (1) `Business` y deriva en (n) `Invoice`.

- **`Invoice`**
  - *Uso:* Generación per-se de una cuota SaaS para pagar por gateways (Mercado Pago).
  - *Campos:* `amount`, `status` (PAID, PENDING), `paymentUrl`.
  - *Relaciones:* Vinculada a un `Business` nativo.

- **`SystemGatewayConfig`**
  - *Uso:* Configuración maestra Criptográfica para webhook de cobros (Mercado Pago).
  - *Campos:* `provider`, `accessToken`, `publicKey`, `webhookSecret`, `lastTestStatus`.

- **`ActivityLog`** (Auditoria Core)
  - *Uso:* Rastreo histórico de la operación e intromisión de Usuarios y Sistema Global.
  - *Campos:* `entityName`, `actionType`, `newValues` (JSON), `previousValues` (JSON), `ipAddress`.
  - *Relaciones:* Asignada a un `BusinessId` y un `UserId`.

---

## ZONA B: MULTI-TENANT CORE ERP 🏢

### 1. Inquilino y Configuraciones B2B
- **`Business`**
  - *Uso:* Tenant Discriminator (Entidad Principal en un SaaS Multitenant Row-Level). 
  - *Campos:* `name`, `taxId`, `domain`.
  - *Relaciones:* ABSOLUTAMENTE todo en la zona B hereda su ID en forma de discriminador `businessId`.

- **`User`**
  - *Uso:* Acceso funcional de perfiles al panel.
  - *Campos:* `email`, `password`, `isStaff` (Flag evasor total), `isActive`.
  - *Relaciones:* Link a Role si `isStaff = false`. Atado a `Business`.

### 2. Catálogo & Stock System
- **`Product` / `Category` / `Warehouse`**
  - *Uso:* Creación de ítems tangibles e inventariados B2B.
- **`Stock` (Agregador) / `StockMovement` (Kardex)**
  - *Uso:* Matriz inmutable matemática de salidas/entradas.
  - *Relaciones:* StockReference apunta a un Warehouse, a un Product ya un Tipo (ENTRY, OUT, TRANSFER).

### 3. Operativa Comercial Finanzas
- **`Sale` & `SaleItem`**
  - *Uso:* Registro ticket TPV / Venta al consumidor.
  - *Relaciones:* Pertenece a un `Business`, Creador `User`, Cliente `Customer`, desglose en Array `SaleItem` (-> Producto).
- **`CashSession` & `CashRegister`**
  - *Uso:* Turno físico de recaudación de empleados de un comercio. Limitante temporal previo a ejecutar VENTAS.
- **`Purchase`**
  - *Uso:* Registro de gastos o abastecedores B2B `Suppliers`. Deriva en impacto a Kardex por recepciones.

---

*Nota Arquitectónica Restrictiva*: **NUNCA** elimines un `businessId` de los modelos o consultas Prisma (salvo la Zona A que es Staff). Es el pasaporte transaccional básico para evitar fugas de confidencialidad inter-tenant.
