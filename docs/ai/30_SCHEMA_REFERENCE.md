# PRESUERP - AI DEVELOPMENT KIT: DATABASE SCHEMA REFERENCE

Este documento proporciona la referencia técnica y estructural oficial del **Esquema de Base de Datos (Database Schema)** de **PresuERP**, detallando los modelos de Prisma ORM mapeados en PostgreSQL, sus índices compuestos, restricciones de clave foránea y relaciones de aislamiento multi-tenant.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

La base de datos de PresuERP está modelada de forma relacional y expuesta a través de **Prisma ORM** sobre **PostgreSQL**.
*   **Fuente de Verdad**: La estructura física reside en `erp/backend/prisma/schema.prisma`. Toda alteración estructural exige correr migraciones controladas de Prisma.
*   **Aislamiento de Negocios**: A nivel de base de datos relacionales, el aislamiento se gestiona mediante la columna `businessId`, la cual vincula cada registro operativo al tenant de la empresa (`Business`).

---

## 2. ARQUITECTURA GENERAL E INTEGRIDAD REFERENCIAL

El modelo físico de PresuERP organiza las dependencias siguiendo este esquema relacional:

```
                            [ Business (businesses) ]
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
      [ User (users) ]         [ Product (products) ]   [ Active Modules Settings ]
             │                          │
             ▼                          ▼
      [ Role (roles) ]          [ Stock (stocks) ] 
             │                          │
             ▼                          ▼
  [ Permission (permissions) ] [ StockMovement (stock_movements) ]
```

---

## 3. ENUMERACIÓN COMPLETA DE ENTIDADES TRANSACCIONALES (PRISMA SPEC)

A continuación se detallan las tablas físicas de la base de datos real:

### 1. `Business` (Física postgres: `businesses`)
El núcleo multi-tenant del ERP.
*   `id` (String UUID, `@id`)
*   `name` (String, razón social de la empresa)
*   `isActive` (Boolean, con default `true`)
*   `createdAt` / `updatedAt` (DateTime)

### 2. `User` (Física postgres: `users`)
*   `id` (String UUID, `@id`)
*   `name` (String)
*   `email` (String)
*   `password` (String, contraseñas hasheadas en backend)
*   `isActive` (Boolean, con default `true`)
*   `roleId` (String UUID, clave foránea)
*   `businessId` (String UUID, clave foránea a `businesses`)
*   *Índices*: `@@unique([email, businessId])` para evitar duplicación del email de usuario en la misma organigrama.

### 3. `Product` (Física postgres: `products`)
*   `id` (String UUID, `@id`)
*   `name` (String)
*   `description` (String, opcional)
*   `sku` (String, código único)
*   `purchasePrice` (Decimal, `@db.Decimal(12, 4)`)
*   `salePrice` (Decimal, `@db.Decimal(12, 4)`)
*   `isActive` (Boolean, con default `true`)
*   `categoryId` (String UUID, clave foránea a `categories`)
*   `supplierId` (String UUID, opcional, clave foránea a `suppliers`)
*   `businessId` (String UUID, clave foránea a `businesses`)
*   *Índices*: `@@unique([sku, businessId])` para inpedir SKU duplicados en el mismo tenant.

### 4. `Stock` (Física postgres: `stocks`)
*   `id` (String UUID, `@id`)
*   `quantity` (Decimal, `@db.Decimal(12, 4)`, con default `0.0000`)
*   `reservedQuantity` (Decimal, `@db.Decimal(12, 4)`, con default `0.0000`)
*   `minimumStock` (Decimal, `@db.Decimal(12, 4)`, con default `0.0000`)
*   `maximumStock` (Decimal, `@db.Decimal(12, 4)`, con default `0.0000`)
*   `warehouseId` (String UUID, clave foránea a `warehouses`)
*   `productId` (String UUID, clave foránea a `products`)
*   `businessId` (String UUID, clave foránea a `businesses`)
*   *Índices*: `@@unique([warehouseId, productId, businessId])` que determina el saldo único del SKU por depósito.

### 5. `StockMovement` (Física postgres: `stock_movements`)
La bitácora contable de movimientos (Kardex).
*   `id` (String UUID, `@id`)
*   `movementType` (String: `ENTRY`, `EXIT`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT`)
*   `quantity` (Decimal, `@db.Decimal(12, 4)`)
*   `stockBefore` (Decimal, `@db.Decimal(12, 4)`)
*   `stockAfter` (Decimal, `@db.Decimal(12, 4)`)
*   `unitCost` (Decimal, `@db.Decimal(12, 4)`)
*   `totalCost` (Decimal, `@db.Decimal(12, 4)`)
*   `referenceType` (String: `PURCHASE`, `SALE`, `TRANSFER`, `ADJUSTMENT`)
*   `referenceId` (String)
*   `referenceNumber` (String, opcional)
*   `reason` / `notes` (String, opcionales)
*   `userId` (String UUID, clave foránea a `users`)
*   `productId` (String UUID, clave foránea a `products`)
*   `warehouseId` (String UUID, clave foránea a `warehouses`)
*   `businessId` (String UUID, clave foránea a `businesses`)

---

## 4. INTEGRIDAD REFERENCIAL Y DIRECTIVAS ON DELETE

Para resguardar los balances contables e históricos del ERP, los modelos de Prisma aplican las siguientes reglas relacionales en PostgreSQL:
*   **Directiva `onDelete: Restrict`**: Habilitada en relaciones clave como `User` contra `Role`, `Product` contra `Category`, y `StockMovement` contra `Product` y `Warehouse`. Si un operario intenta borrar físicamente un depósito o artículo con trazas físicas en inventario, el motor de base de datos interrumpe la remoción física.
*   **Directiva `onDelete: Cascade`**: Habilitada para limpiar preferenciales de configuración de subtablas satélites al eliminar un cliente (`Business`).

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Diferencia de Identificadores (Multi-Tenant)**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **Uso de Tipos Decimales de Alta Fidelidad**: Columnas financieras como `purchasePrice`, `salePrice`, `unitCost` y `quantity` se guardan en base de datos como `@db.Decimal(12, 4)`. Se prohíbe el uso de tipos `Float` en el backend para evitar desfases numéricos de redondeo matemático acumulados.
3.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
