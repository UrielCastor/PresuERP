# PRESUERP - AI DEVELOPMENT KIT: KARDEX MODULE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Módulo de Kardex e Historial de Movimientos** de **PresuERP**, detallando los modelos relacionales PostgreSQL, la política de inmutabilidad transaccional nativa, los catálogos lógicos de clasificación física, y los endpoints de API backend.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **Kardex** representa la bitácora financiera e histórica de la mercadería en PresuERP. A diferencia de las tablas acumuladoras de visualización rápida, el Kardex contiene registros puros, inmutables y secuenciales de todo ingreso o egreso de stock físico.

### Principios Fundamentales:
*   **Bitácora Histórica**: Stock detalla la cantidad disponible actual; el Kardex relata las transacciones matemáticas consecutivas que derivaron en dicho saldo.
*   **Seguridad Transaccional**: Queda excluida cualquier modificación directa o reseteo sobre los registros persistidos de movimientos.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El balance del inventario físico se procesa mediante contra-asientos compensatorios lógicos para corregir saldos en caso de devoluciones o siniestros:

```
                  [ Operación Comercial o Ajuste ]
                                 │
                                 ▼
                     [ StockMovementService ]
    (Obtiene existencias previas y calcula saldo resultante)
                                 │
                                 ▼
         [ Inserta Asiento Físico en stock_movements ]
                (Inyección secuencial inmutable)
                                 │
                                 ▼
           [ Afectación Realizada: stocks.quantity ]
             (Modificación final de unidades en DB)
```

---

## 3. MODELADO DE DATOS (EN PRISMA)

La base transaccional se compone de la siguiente tabla indexada en PostgreSQL vía `schema.prisma`:

### Model `StockMovement` (Físico postgres: `stock_movements`)
*   **Campos**:
```prisma
model StockMovement {
  id              String    @id @default(uuid())
  businessId      String
  business        Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  warehouseId     String
  warehouse       Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  productId       String
  product         Product   @relation(fields: [productId], references: [id], onDelete: Restrict)
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Restrict)
  movementType    String    // 'ENTRY', 'EXIT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'INVENTORY'
  quantity        Decimal   @db.Decimal(12, 4)
  stockBefore     Decimal   @db.Decimal(12, 4)
  stockAfter      Decimal   @db.Decimal(12, 4)
  unitCost        Decimal   @default(0.00) @db.Decimal(12, 4)
  totalCost       Decimal   @default(0.00) @db.Decimal(12, 4)
  referenceType   String?   // 'PURCHASE', 'SALE', 'TRANSFER', 'ADJUSTMENT'
  referenceId     String?
  referenceNumber String?
  reason          String?
  notes           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([businessId, productId])
  @@index([businessId, warehouseId])
  @@index([businessId, createdAt])
  @@map("stock_movements")
}
```

---

## 4. INMUTABILIDAD Y REGISTRO COMPENSATORIO (REVERSAL STANDARD)

*   **Ventanilla Cerrada de Ediciones**: La tabla física `stock_movements` no cuenta con ningún endpoint de tipo `PUT` o `DELETE` expuesto a nivel de ruteo Express, bloqueando la falsificación de auditoría.
*   **Rutina de Compensación (Reversal)**: Si un operario ingresó mercadería por error (ej: Entrada +50 unidades), el sistema no edita la fila errónea. La única operación aceptada es inyectar un nuevo movimiento compensatorio complementario (ej: Egreso -50 unidades) bajo el campo descriptivo `'REVERSAL'`, asociando el ID secuencial original en el campo `referenceId`.

---

## 5. CLASIFICACIÓN REAL DE MOVIMIENTOS DETECTADOS

El backend gobierna las consultas parametrizando el string `movementType` basado en el catálogo estructural:
1.  **`ENTRY`**: Ingresos ordinarios de stock (ej. confirmación fiscal de compras en `PurchaseService`).
2.  **`EXIT`**: Salidas ordinarias de saldo de depósito (ej. despacho por POS o ventas).
3.  **`TRANSFER_IN` / `TRANSFER_OUT`**: Control interno en transferencias interdepósitos.
4.  **`ADJUSTMENT`**: Ajustes de control generados tras inventarios físicos (auditoría).
5.  **`INVENTORY`**: Consolidaciones atómicas e inicializaciones del sistema.

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Diferencia de Identificadores (Multi-Tenant)**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **Indexación en Consultas Masivas**: El modelo incluye índices compuestos: `@@index([businessId, productId])`, `@@index([businessId, warehouseId])` y `@@index([businessId, createdAt])`. Esto agiliza la velocidad de carga de reportes históricos o de valorización mercantil sobre PostgreSQL.
3.  **Caspas de Costeo Promedio Histórico**: Al registrar en cada movimiento el `unitCost` y `totalCost` en formato `Decimal(12, 4)`, el sistema retiene el estado financiero real de la mercadería en la fecha del movimiento, previniendo distorsiones por fluctuación inflacionaria. Es mandatorio calcular estos valores en backend utilizando la clase `Decimal` nativa de Prisma para mitigar errores de flotación en Javascript.
