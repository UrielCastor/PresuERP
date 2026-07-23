# PRESUERP - AI DEVELOPMENT KIT: POINT OF SALE MODULE (POS)

Este documento proporciona la especificación técnica y de desarrollo oficial del **Módulo de Punto de Venta (POS / Ventas Rápidas)** de **PresuERP**, detallando los modelos relacionales PostgreSQL, el estado de implementación parcial detectado, las mutaciones transaccionales en Kardex y existencias de stock, y los contratos de API expuestos en el backend.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **POS (Point of Sale)** coordina el egreso rápido de mercaderías e inserción de transacciones de caja comercial del ERP. Su objetivo comprende:
*   **Velocidad de Caja**: Operar flujos de salida ágiles buscando artículos por código de barras o código interno SKU.
*   **Consistencia Física**: Vincular el flujo con las capas transaccionales de Stock y Asientos de Kardex de forma atómica.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO (ESTADO REAL ACTUAL)

```
                            [ POST /api/v1/sales ]
                                       │
                                       ▼
                       [ SalesController (Backend) ]
                   (Inyecta automáticamente businessId)
                                       │
                                       ▼
                             [ Dynamic Transaction ]
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
 [ Descuenta Unidades en Stock ]                        [ Registra en Kardex ]
   Afecta Stock.quantity en Dep.                       Inserta asiento de tipo EXIT
            │                                                     │
            └──────────────────────────┬──────────────────────────┘
                                       ▼
                         * Brecha de Persistencia *
                 (No escribe cabecera en tabla 'sales' 
                       ni ítems en 'sale_items')
```

---

## 3. MODELADO DE DATOS (EN PRISMA)

El esquema relacional de ventas en `schema.prisma` se define sobre las tablas PostgreSQL:

### Model `Sale` (Físico postgres: `sales`) - *Parcialmente Acoplado*
```prisma
model Sale {
  id            String        @id @default(uuid())
  businessId    String
  business      Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  saleNumber    String
  saleDate      DateTime      @default(now())
  status        String        @default("PENDING")
  paymentStatus String        @default("PENDING")
  paymentMethod String?
  subtotal      Decimal       @db.Decimal(12, 4)
  discount      Decimal       @default(0.00) @db.Decimal(12, 4)
  tax           Decimal       @default(0.00) @db.Decimal(12, 4)
  total         Decimal       @db.Decimal(12, 4)
  notes         String?
  warehouseId   String
  warehouse     Warehouse     @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  userId        String
  user          User          @relation(fields: [userId], references: [id], onDelete: Restrict)
  items         SaleItem[]
  payments      SalePayment[]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@unique([saleNumber, businessId])
  @@map("sales")
}
```

### Model `SaleItem` (Físico postgres: `sale_items`) - *Parcialmente Acoplado*
```prisma
model SaleItem {
  id        String   @id @default(uuid())
  saleId    String
  sale      Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Restrict)
  quantity  Decimal  @db.Decimal(12, 4)
  unitPrice Decimal  @db.Decimal(12, 4)
  cost      Decimal? @db.Decimal(12, 4)
  discount  Decimal  @default(0.00) @db.Decimal(12, 4)
  subtotal  Decimal  @db.Decimal(12, 4)

  @@map("sale_items")
}
```

---

## 4. AUDITORÍA DEL ESTADO DE IMPLEMENTACIÓN (REPORTE DE ESTADO PARTIAL)

> [!WARNING]
> **Brecha en Lógica del Controller**: El endpoint expuesto `POST /api/v1/sales` procesa de forma óptima el descuento físico de unidades en depósito y crea el movimiento inmutable tipo `'EXIT'` en la tabla `stock_movements`. Sin embargo, **no inserta** cabeceras de ventas ni detalles en las tablas `sales` y `sale_items`. Por consiguiente, la realización de consultas retrospectivas en `/api/v1/sales` (históricos) y reportes de facturación de venta retornará listines vacíos hasta que se complete su desarrollo transaccional del backend.

---

## 5. RECOMPILACIÓN DE ACCIONES Y ENDPOINTS DEL NEGOCIO

### 1. Ventas Rápidas (POST `/api/v1/sales`)
*   **Acceso**: Privado (requiere JWT válido).
*   **Payload**:
```json
{
  "warehouseId": "w3b4a209-...",
  "items": [
    {
      "productId": "p3b4c109-...",
      "quantity": 5
    }
  ]
}
```
*   **Operación Física**:
    *   Verifica saldo en `Stock`. Si el saldo disponible es menor a `5`, bloquea la ejecución.
    *   Sustrae cantidades en el depósito logístico e inserta la salida en la tabla `stock_movements`.

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **Inmutabilidad de Salidas del Pos**: Dado que las ventas no se escriben formalmente en las tablas relacionales de la base de datos `sales`, no existe lógica de cancelación de ticket (`/cancel`) relacional habilitada que devuelva stock de manera inversa o registre counter-asientos compensatorios de ventas en el Kardex.
3.  **Seguridad Multi-Tenant Compuesta**: El CUIT y los privilegios son inyectados transparentemente desde el token JWT decodificado en Express, asegurándole a las operaciones de caja la imposibilidad de sustraer existencias de depósitos de terceros.
