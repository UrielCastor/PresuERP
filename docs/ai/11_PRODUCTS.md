# PRESUERP - AI DEVELOPMENT KIT: PRODUCTS & CATALOG MODULE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Módulo de Productos y Catálogo** de **PresuERP**, detallando los modelos de datos PostgreSQL, las rutinas de cálculo automático de precios, las triggers de actualización por compras, el comportamiento de borrado lógico y la integración con el inventario.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **Products** centraliza la persistencia y lectura de la ficha maestra de mercaderías. Garantiza el control preciso de los códigos de barra (`barcode`), códigos internos secuenciales (`sku`), costos de base, márgenes y la clasificación relacional por categorías e inquilino.

### Integraciones Nucleares:
*   **Compras**: Actualización automática de costos al aprobar ingresos fiscales de stock.
*   **Inventario / Kardex**: Abstracción del catálogo al registrar existencias físicas en depósitos y transacciones inmutables.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El ciclo de vida del producto sigue un flujo atómico de capas para preservar la consistencia matemática de los precios de venta:

```
[ POST /products ] OR [ PUT /products/:id ]
                       │
                       ▼
             [ ProductController ]
      (Validación de esquemas Zod en request)
                       │
                       ▼
              [ ProductService ]
     (Cálculo matemático de salePrice:
  purchasePrice * (1 + profitMargin / 100))
                       │
                       ▼
             [ ProductRepository ]
  (Sentencia Prisma: insert / update a db)
```

---

## 3. MODELADO DE DATOS (EN PRISMA)

El catálogo de productos se nutre físicamente de las siguientes tablas mapeadas en PostgreSQL:

### Model `Product` (Físico postgres: `products`)
*   **Estructura**:
```prisma
model Product {
  id            String             @id @default(uuid())
  name          String
  sku           String?
  barcode       String?
  description   String?
  categoryId    String
  category      Category           @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  subCategoryId String?
  subCategory   SubCategory?       @relation(fields: [subCategoryId], references: [id], onDelete: SetNull)
  brandId       String?
  brand         Brand?             @relation(fields: [brandId], references: [id], onDelete: SetNull)
  supplierId    String?
  supplier      Supplier?          @relation(fields: [supplierId], references: [id], onDelete: SetNull)
  status        String             @default("ACTIVE")
  hasVariations Boolean            @default(false)
  purchasePrice Decimal            @default(0.00) @db.Decimal(12, 4)
  salePrice     Decimal            @default(0.00) @db.Decimal(12, 4)
  profitMargin  Decimal            @default(30.00) @db.Decimal(5, 2)
  businessId    String
  business      Business           @relation(fields: [businessId], references: [id], onDelete: Cascade)
  images        ProductImage[]
  barcodes      ProductBarcode[]
  priceLists    PriceListItem[]
  stocks        Stock[]
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  @@unique([sku, businessId])
  @@index([businessId, status])
  @@index([barcode, businessId])
  @@map("products")
}
```

### Campos Relacionales y Cardinalidades:
1.  `Category` (Categorías): Relación **1:N** obligatoria (`onDelete: Restrict`). Un producto no puede ser insertado sin categoría válida.
2.  `Supplier` (Proveedores): Relación **1:N** opcional. Un producto puede existir sin proveedor asignado.
3.  `Brand` (Marcas): Relación **1:N** opcional (reemplazada operativamente para compras por `Supplier`).

---

## 4. GESTIÓN FINANCIERA DE PRECIOS Y COSTOS

### 1. Fórmula de Venta Automática
El backend calcula el precio de venta en la capa `ProductService` al crear o actualizar el artículo:
$$\text{salePrice} = \text{purchasePrice} \times \left(1 + \frac{\text{profitMargin}}{100}\right)$$
El cliente frontend no determina ni envía el `salePrice` pre-calculado para evitar manipulaciones maliciosas.

### 2. Afectación de Costo por Aprobación de Compras (Trigger en `PurchaseService`)
Cuando una orden de compra pasa del estado `'DRAFT'` al estado de confirmación fiscal `'APPROVED'`, la capa de servicios ejecuta una actualización automática sobre el catálogo en base al costo ingresado:
```typescript
// Fragmento real de PurchaseService.approve:
const newCost = new Decimal(item.unitCost);
const newSalePrice = newCost.mul(new Decimal(1).add(product.profitMargin.div(100)));

await tx.product.update({
  where: { id: item.productId },
  data: {
    purchasePrice: newCost,
    salePrice: newSalePrice
  }
});
```

---

## 5. POLÍTICA DE INMUTABILIDAD Y CORTE LÓGICO (SOFT DELETE)

*   **Restricción de Borrado Físico (`onDelete: Restrict`)**: El modelo define restricciones estrictas para preservar la consistencia del negocio. Si un producto cuenta con registros de existencias (`stocks`), Kardex (`stock_movements`), o ítems de compra (`purchase_items`), PostgreSQL bloqueará cualquier borrado físico en base de datos.
*   **Borrado Lógico (Soft Delete)**: `ProductService` implementa la remoción lógica cambiando el estado del catálogo a `'INACTIVE'` en lugar de procesar la eliminación física si existen transacciones históricas registradas, previniendo excepciones e inconsistencias de datos.

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Redondeos de Decimales en Postgres vs JS**: Las columnas `purchasePrice` y `salePrice` se mapean tipo `Decimal(12, 4)`. Si el frontend procesa actualizaciones calculando con variables primitivas flotantes, se pueden arrastrar pérdidas de centavos por desajustes aritméticos. Toda operación de cálculo en backend debe usar la clase `Decimal` de Prisma.
2.  **Códigos de Barra Múltiples**: Aunque el modelo físico cuenta con la relación `ProductBarcode` (permitiendo asociar múltiples códigos a un artículo), la capa de código real de `ProductService` y UI de frontend únicamente persiste un string simple en la columna `barcode` de la cabecera del modelo `Product`, subutilizando el potencial multicode lineal del esquema.
3.  **Índice de SKU Compuesto**: La unicidad compuesta de SKU `@@unique([sku, businessId])` es ideal para evitar solapamientos relacionales entre inquilinos. Debe vigilarse que la columna `sku` no contenga caracteres nulos redundantes que rompan el índice único de Postgres en importaciones masivas.
