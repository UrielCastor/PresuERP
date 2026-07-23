# PRESUERP - AI DEVELOPMENT KIT: STOCK MODULE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Módulo de Stock e Inventario** de **PresuERP**, detallando el modelo de existencias de base de datos relacionales, las políticas de prevención de inventario negativo, las mutaciones transaccionales de Kardex e ingresos/egresos y los endpoints de API backend.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **Stock** centraliza la lógica física del inventario disponible por producto y almacén. No es un mero acumulador; opera acoplado de forma estricta a asientos inmutables de control para respaldar la valorización de stock, transferencias inter-sucursales y auditorías operativas.

### Reglas de Diseño de Inventario:
*   **Principio de Auditoría**: Está estrictamente prohibido alterar campos de stock mediante llamadas inline directas. Todo cambio de cantidad exige invocar previamente el servicio unificado de Kardex (`StockMovement`).
*   **Políticas de Negativo**: Validar saldos remanentes antes de procesar egresos de mercaderías para evitar inconsistencias logísticas.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

```
                      [ Solicitud de Movimiento ]
                   (De Compras, Ventas o Ajustes)
                                 │
                                 ▼
                     [ StockMovementService ]
       (Valida depósitos y saldo actual de existencias)
                                 │
                   ┌─────────────┴─────────────┐
                   ▼                           ▼
        [ Afectación del Stock ]      [ Historial de Kardex ]
        Incrementa o decrementa       Crea asiento inmutable
         unidades en target key        en stock_movements
                   │                           │
                   └─────────────┬─────────────┘
                                 ▼
                       [ Log de Auditoría ]
                    Inserta en activity_logs
```

---

## 3. MODELADO DE DATOS (EN PRISMA)

El inventario de mercaderías e históricos de flujos se rige sobre los siguientes modelos de base de datos relacionales PostgreSQL:

### Model `Stock` (Físico postgres: `stocks`)
*   **Estructura**:
```prisma
model Stock {
  id               String    @id @default(uuid())
  businessId       String
  business         Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  warehouseId      String
  warehouse        Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Cascade)
  productId        String
  product          Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  quantity         Decimal   @default(0.000) @db.Decimal(12, 4)
  reservedQuantity Decimal   @default(0.000) @db.Decimal(12, 4)
  minimumStock     Decimal   @default(0.000) @db.Decimal(12, 4)
  maximumStock     Decimal   @default(0.000) @db.Decimal(12, 4)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@unique([warehouseId, productId, businessId])
  @@index([productId])
  @@index([warehouseId])
  @@index([businessId])
  @@map("stocks")
}
```

### Model `StockMovement` (Físico postgres: `stock_movements`)
```prisma
model StockMovement {
  id             String   @id @default(uuid())
  businessId     String
  business       Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  warehouseId    String
  warehouse      Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  productId      String
  product        Product  @relation(fields: [productId], references: [id], onDelete: Restrict)
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  movementType   String   // 'ENTRY', 'EXIT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT'
  quantity       Decimal  @db.Decimal(12, 4)
  stockBefore    Decimal  @db.Decimal(12, 4)
  stockAfter     Decimal  @db.Decimal(12, 4)
  unitCost       Decimal  @default(0.00) @db.Decimal(12, 4)
  totalCost      Decimal  @default(0.00) @db.Decimal(12, 4)
  referenceType  String?  // 'PURCHASE', 'SALE', 'TRANSFER', 'ADJUSTMENT'
  referenceId    String?
  referenceNumber String?
  reason         String?
  notes          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([businessId, productId])
  @@index([businessId, warehouseId])
  @@index([businessId, createdAt])
  @@map("stock_movements")
}
```

---

## 4. REGISTRO UNIFICADO DE EXISTENCIAS (CAPA DE DATOS ATÓMICA)

El servicio `StockMovementService.registerMovement` centraliza toda mutación sobre las cantidades de los depósitos:

1.  **Garantía Transaccional**: El servicio acepta inyección opcional del cliente Prisma Client `tx` para correr dentro de transacciones atómicas mayores.
2.  **Upsert Automático de Registros**: Si el producto ingresa por primera vez a un almacén (o depósito), el sistema maneja la excepción inicializando una fila con cantidad disponible `0.000` en la tabla `Stock`.
3.  **Seguridad contra Stock Negativo**:
    *   Si el tipo de movimiento implica un egreso (ej. `movementType: 'EXIT'` o `'TRANSFER_OUT'`), restringe la confirmación si la resta de unidades deja saldo menor a cero.
    *   *Excepción:* Verifica si las configuraciones del tenant inyectadas en caché o base habilitan el permiso explícito de vender con stock negativo. De lo contrario, interrumpe el flujo arrojando una excepción de negocio unificada (`ForbiddenError`).
4.  **Balance de Kardex**: Calcula y persiste el estado actual del inventario antes (`stockBefore`) y después (`stockAfter`) de la transacción, para ofrecer auditorías inmediatas.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: Es crítico no emplear nombres desactualizados como `tenantId` en nuevas consultas Prisma. La columna física y relacional unificada en base de datos PostgreSQL se llama estrictamente `businessId`.
2.  **Caspas de Costeo de Promedio Ponderado**: A diferencia del diseño teórico, la tabla física `stocks` no recopila columnas de `averageCost` ni `lastPurchaseCost`. Estos campos residen agregados e indexados históricamente a nivel de la tabla `stock_movements`. Al correr reportes de costos o contabilidad de activos, los cálculos de valorización deben derivarse parseando las filas de `stock_movements` indexadas por fecha.
3.  **Locks de Concurrencia**: Transacciones masivas concurrentes sobre items populares (ej: aprobación de una compra de 500 ítems sumada a egresos en el POS) bloquean temporalmente filas sobre la terna única `@@unique([warehouseId, productId, businessId])`. Las operaciones deben implementarse reduciendo el tiempo de duración del objeto de transacción `$transaction`.
4.  **Régimen Strict de Eliminación**: La directiva `onDelete: Restrict` en `StockMovement` bloquea la eliminación física de cualquier depósito (`Warehouse`) u artículo que cuente con trazas de inventario históricas, asegurando la no alteración del Kardex de comités empresariales.
