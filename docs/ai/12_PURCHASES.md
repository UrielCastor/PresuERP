# PRESUERP - AI DEVELOPMENT KIT: PURCHASES MODULE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Módulo de Compras (Purchases)** de **PresuERP**, detallando los modelos de datos en PostgreSQL, las rutinas de confirmación fiscal y financiera, el acoplamiento con la gestión de inventario y Kardex, y los endpoints de API expuestos en el backend.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **Purchases** coordina e instrumentaliza el ingreso fiscal y logístico de mercaderías de la empresa. Gestiona los pedidos, la recepción en depósitos específicos, el costeo y la liquidación contable de impuestos en transacciones de adquisición.

### Lógica Transaccional:
*   **Gestión de Estados**: Ciclo de vida que viaja desde `'DRAFT'` (edición libre sin afectación de existencias) hasta `'APPROVED'` (ingreso del stock y afectación de costos) o `'CANCELLED'`.
*   **Coordinación de Kardex**: Vinculación id-referencia inmutable para respaldar auditorías legales de control de mercaderías.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

```
                 [ POST /purchases (Crea DRAFT) ]
                               │
                               ▼
        [ Aprobación de Factura: POST /purchases/:id/approve ]
                               │
                  ┌────────────┴────────────┐
                  ▼                         ▼
        [ Afecta Stocks ]         [ Inserta Kardex ]
        Suma unidades en dep.      Crea línea ENTRY
                  │                         │
                  └────────────┬────────────┘
                               ▼
                [ Actualiza Ficha de Artículos ]
               Costo base (purchasePrice) + salePrice
```

---

## 3. MODELADO DE DATOS (EN PRISMA)

La base transaccional se compone de dos tablas mapeadas en PostgreSQL mediante `schema.prisma`:

### Model `Purchase` (Físico postgres: `purchases`)
*   **Campos**:
```prisma
model Purchase {
  id              String         @id @default(uuid())
  purchaseNumber  String
  documentType    String         @default("FACTURA")
  documentNumber  String?
  status          String         @default("DRAFT")
  paymentStatus   String         @default("PENDING")
  purchaseDate    DateTime
  expectedDate    DateTime?
  subtotal        Decimal        @db.Decimal(12, 4)
  discount        Decimal        @default(0.00) @db.Decimal(12, 4)
  tax             Decimal        @db.Decimal(12, 4)
  total           Decimal        @db.Decimal(12, 4)
  notes           String?
  hasInvoiceTaxes Boolean        @default(false)
  vatRate         Decimal        @default(21.00) @db.Decimal(5, 2)
  vatAmount       Decimal        @default(0.00) @db.Decimal(12, 4)
  otherTaxes      String?        // Texto para JSON stringified
  invoicedTotal   Decimal?       @db.Decimal(12, 4)
  supplierId      String
  supplier        Supplier       @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  warehouseId     String
  warehouse       Warehouse      @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  userId          String
  user            User           @relation(fields: [userId], references: [id], onDelete: Restrict)
  items           PurchaseItem[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@unique([purchaseNumber, businessId])
  @@map("purchases")
}
```

### Model `PurchaseItem` (Físico postgres: `purchase_items`)
```prisma
model PurchaseItem {
  id         String   @id @default(uuid())
  purchaseId String
  purchase   Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Restrict)
  quantity   Decimal  @db.Decimal(12, 4)
  unitCost   Decimal  @db.Decimal(12, 4)
  discount   Decimal  @default(0.00) @db.Decimal(12, 4)
  subtotal   Decimal  @db.Decimal(12, 4)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("purchase_items")
}
```

---

## 4. CICLO DE VIDA Y ACCIONES ESPECIALES (APROBADO Y CANCELADO)

### 1. Creación en Estado Borrador (`'DRAFT'`)
*   Se guardan cantidades y costos estimados. No impacta en Kardex ni modifica existencias logísticas.

### 2. Aprobación Fiscal (`approve`)
*   **Acceso**: Middleware `requirePermission('purchases:approve')`.
*   **Lógica Realizada (Atómica en Transacción Prisma)**:
    1.  Modifica el estado de la cabecera a `status: 'APPROVED'` y `paymentStatus: 'PAID'`.
    2.  Recorre el desglose de productos en `PurchaseItem`.
    3.  Afecta el stock físico incrementando unidades: `Stock.quantity += item.quantity`.
    4.  Registra un asiento inmutable de movimiento en Kardex (`StockMovement`) de tipo `'ENTRY'` con referencia `'PURCHASE'`.
    5.  Actualiza el costo (`purchasePrice`) del catálogo de productos y recalcula de forma inmediata el precio de venta (`salePrice`).
    6.  Inserta auditoría en `activity_logs`.

### 3. Cancelación (`cancel`)
*   **Lógica Realizada**:
    1.  Modifica la compra a `status: 'CANCELLED'`.
    2.  Si la compra ya estaba aprobada, ejecuta egresos inversos en stock: `Stock.quantity -= item.quantity`.
    3.  Registra un asiento de salida `'EXIT'` en el Kardex y asigna log `'PURCHASE_CANCELLED'`.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Diferencia de Nomenclatura**: La especificación funcional tradicional sugería estados `'CONFIRMED'` y endpoint `/confirm`. Sin embargo, el código implementado y en funcionamiento real utiliza estrictamente la nomenclatura `'APPROVED'` y el endpoint de control `/approve`. Toda expansión de la API debe alinearse a este estándar para evitar errores de tipeo y fallas de compilación.
2.  **Caspas de Impuestos Serializados**: El campo `otherTaxes` mapea impuestos complementarios (ej. tasas municipales) como string. Esto flexibiliza el frontend de compras al no exigir esquemas relacionales complejos, pero impide realizar auditorías impositivas agregadas nativas eficientes en Postgres sin parsear programáticamente a nivel de base.
3.  **Restricciones de Integridad**: Si se intenta eliminar un proveedor (`Supplier`) o un almacén (`Warehouse`) referenciado por una compra preexistente, Postgres bloqueará físicamente la transacción (`onDelete: Restrict`) para salvaguardar el histórico financiero del inquilino, asegurando la consistencia temporal relacional.
