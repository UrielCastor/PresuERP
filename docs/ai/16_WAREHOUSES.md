# PRESUERP - AI DEVELOPMENT KIT: WAREHOUSES MODULE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Módulo de Depósitos (Warehouses)** de **PresuERP**, detallando los modelos de base de datos relacionales en PostgreSQL, la configuración de depósitos predeterminados, las restricciones ante inactivación y los contratos de API expuestos.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **Warehouses** brinda soporte a la parametrización de localizaciones físicas y virtuales donde las empresas de cada inquilino almacenan stock de mercadería.
*   **Abstracción Logística**: Sirve como contenedor espacial obligado para los inventarios consolidados (`stocks`) e históricos (`stock_movements`).
*   **Consistencia Operativa**: Bloquea el procesamiento de entradas de compras o transferencias sobre depósitos desactivados por el administrador.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

```
[ POST /warehouses ] OR [ PUT /warehouses/:id ]
                           │
                           ▼
                 [ WarehouseController ]
       (Valida estructura y unicidad del código)
                           │
                           ▼
                  [ WarehouseService ]
  (Gobernanza de depósito predeterminado: isDefault)
                           │
                           ▼
                 [ WarehouseRepository ]
       (Sentencia Prisma: insert / update a db)
```

---

## 3. MODELADO DE DATOS (EN PRISMA)

El esquema de almacenes se define físicamente en la siguiente tabla PostgreSQL vía `schema.prisma`:

### Model `Warehouse` (Físico postgres: `warehouses`)
*   **Estructura**:
```prisma
model Warehouse {
  id              String          @id @default(uuid())
  businessId      String
  business        Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name            String
  code            String
  description     String?
  address         String?
  city            String?
  province        String?
  country         String?         @default("Argentina")
  responsibleName String?
  phone           String?
  email           String?
  status          String          @default("ACTIVE")
  isDefault       Boolean         @default(false)
  stocks          Stock[]
  stockMovements  StockMovement[]
  purchases       Purchase[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([code, businessId])
  @@map("warehouses")
}
```

---

## 4. GOBERNANZA DE ARCHIVO PREDETERMINADO (ISDEFAULT RULE)

### Único Almacén Default por Tenant
*   El backend asegura en `WarehouseService` que solo exista **un único** depósito marcado con `isDefault: true` a nivel del inquilino `businessId`.
*   Si se crea o actualiza un depósito pasándole el flag `isDefault: true`, el servicio ejecuta una transacción Prisma para poner en `false` todos los depósitos restantes de la empresa de manera sincronizada antes de guardar el nuevo activo.
```typescript
// Lógica de reseteo dinámico en WarehouseService:
if (data.isDefault) {
  await tx.warehouse.updateMany({
    where: { businessId, isDefault: true },
    data: { isDefault: false }
  });
}
```

---

## 5. RESTRICCIÓN DE BORRADO FÍSICO (ONDELETE: RESTRICT)

*   **Restricción de Negocio**: La relación de `Warehouse` con `stocks`, `stockMovements` y `purchases` está configurada con la directiva `onDelete: Restrict` en PostgreSQL.
*   **Tratamiento**: Si un depósito posee existencias físicas o registros de Kardex en su haber histórico, Postgres bloqueará cualquier borrado físico de la fila. El backend maneja el desvío arrojando un error controlado y guiando al operador a mutar el estado secundario a `status: 'INACTIVE'` para inhabilitar operaciones nuevas sin dañar la coherencia transaccional.

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Diferencia de Identificadores (Multi-Tenant)**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **Unicidad de Código por Cliente**: La restricción compuesta de SKU de código `@@unique([code, businessId])` es de alta fidelidad para prevenir colisiones operativas de códigos abreviados de depósitos entre inquilinos. Su validación de unicidad en Postgres es directa.
3.  **Control de Existencias Negativas**: Los movimientos logísticos de salida o transferencias interalmacenes (`TRANSFER_OUT`) deben chequear que el depósito origen posea existencias de forma atómica para evitar desajustes en el stock consolidado del tenant.
