# PRESUERP - AI DEVELOPMENT KIT: SUPPLIERS MODULE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Módulo de Proveedores (Suppliers)** de **PresuERP**, detallando los modelos relacionales PostgreSQL, los contratos de API expuestos en el backend, las restricciones de integridad transaccional, y el flujo de aislamiento multi-tenant.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **Suppliers** proporciona el marco de persistencia y administración del pool de proveedores y colaboradores logísticos de la empresa.
*   **Base Comercial**: Es la base estructurada para las compras de mercadería (`purchases`) y costeo de catálogo.
*   **Seguridad y RBAC**: Protege la parametrización de información fiscal restringiendo accesos mediante permisos específicos del inquilino.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El alta e interacción comercial con un proveedor sigue el siguiente flujo de responsabilidades:

```
[ POST /suppliers ] OR [ PUT /suppliers/:id ]
                          │
                          ▼
                [ SupplierController ]
         (Valida datos obligatorios de CUIT)
                          │
                          ▼
                 [ SupplierService ]
      (Valida unicidad de CUIT para el businessId)
                          │
                          ▼
                [ SupplierRepository ]
      (Sentencia Prisma: insert / update a db)
```

---

## 3. MODELADO DE DATOS (EN PRISMA)

La base de proveedores se define físicamente en la siguiente tabla PostgreSQL vía `schema.prisma`:

### Model `Supplier` (Físico postgres: `suppliers`)
*   **Estructura**:
```prisma
model Supplier {
  id           String     @id @default(uuid())
  businessId   String
  business     Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name         String
  businessName String?
  taxId        String?
  email        String?
  phone        String?
  address      String?
  city         String?
  province     String?
  country      String?    @default("Argentina")
  contactName  String?
  website      String?
  notes        String?
  status       String     @default("ACTIVE")
  rating       Decimal?   @db.Decimal(3, 2)
  products     Product[]
  purchases    Purchase[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@unique([taxId, businessId])
  @@map("suppliers")
}
```

---

## 4. ESTADOS Y POLÍTICA DE INTEGRIDAD TRANSACCIONAL

### 1. Estados Operativos del Proveedor
*   **`ACTIVE`**: Habilitado para facturación de mercadería en borradores y aprobaciones.
*   **`INACTIVE`**: Inhabilita la selección de este proveedor para el alta de nuevas compras (`purchases:create`).

### 2. Borrado Lógico e Impedimento Físico (`onDelete: Restrict`)
*   **Restricción de Negocio**: La relación `Supplier` con `products` y `purchases` está protegida bajo la directiva `onDelete: Restrict` en PostgreSQL.
*   **Tratamiento**: Si un proveedor cuenta con facturas registradas en el histórico transaccional, el motor relacional bloquea la remoción física. El backend responde cancelando la transacción física del repositorio y derivando la operación a un cambio de estado lógico (`status: 'INACTIVE'`), resguardando los históricos financieros del tenant.

---

## 5. CAPTURA Y METRADOS DE AUDITORÍA (ACTIVITY LOGS)

Los servicios de backend inyectan el rastro cronológico en `activity_logs`:
*   *Crear Proveedor*: `action: 'SUPPLIER_CREATED'`.
*   *Actualizar Ficha*: `action: 'SUPPLIER_UPDATED'`.
*   *Asociar Compra*: Al persistir compras, valida que el proveedor pertenezca estrictamente al mismo `businessId` inyectado en `req.user`.

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Garantía Multi-Tenant Compuesta**: La clave compuesta `@@unique([taxId, businessId])` evita el solapamiento del identificador CUIT (`taxId`) entre diferentes empresas. Se debe cuidar en los formularios de inserción que la cadena sea normalizada (quitando guiones o espacios) para prevenir desvíos en el index de unicidad de Postgres.
2.  **Omisión de Estadísticas Agregadas**: A pesar de que el frontend de proveedores proyecta totalizar sumas de compras históricas y cantidades, estas consultas deben consolidarse programáticamente utilizando la API con queries agregadas (`COUNT` y `SUM` sobre la tabla `purchases` filtrada por `supplierId`), previniendo caídas de rendimiento usando paginación.
