# PRESUERP - AI DEVELOPMENT KIT: OFFICIAL BUSINESS RULES

Este documento proporciona la especificación y el marco lógico indispensable de las **Reglas de Negocio (Business Rules)** del ERP de **PresuERP**, detallando el principio de aislamiento multi-tenant, las reglas de inmutabilidad logística, las transacciones atómicas cruzadas y el mapa dinámico de permisos RBAC.

---

## 1. MÁXIMOS OPERATIVOS DEL SISTEMA (BUSINESS POLICIES)

El diseño arquitectónico de PresuERP impone las siguientes políticas inalterables a nivel de base de datos relacionales y servicios de backend:

### Regla I: El Principio de Aislamiento Inclusivo
*   **Definición**: Queda vetada la visualización, lectura, agregación o mutación de cualquier recurso (producto, proveedor, depósito, usuario, stock) que no corresponda al identificador de tenant (`businessId`) extraído directamente del token JWT verificado en `req.user`.

### Regla II: La Fuente de Auditoría
*   **Definición**: Las inserciones en la tabla `activity_logs` y `stock_movements` son estrictamente inmutables (solo de creación). Cualquier contra-asiento por equivocación del operador humano se resuelve mediante una transacción de contra-balance lógico (`REVERSAL`).

### Regla III: La Prevención de Inventario Negativo
*   **Definición**: Por defecto corporativo, se interrumpe toda llamada de egreso de mercadería (ej. despachos de ventas rápidas, transferencias interalmacenes) si la cantidad remanente en la tabla `Stock` cae por debajo de cero, a no ser que el flag configuable `allowOutOfStock` del tenant esté en `true` en la tabla `pos_settings`.

---

## 2. REGLAS ESPECÍFICAS POR MÓDULOS DE NEGOCIO

### 1. Módulo de Catálogo y Ficha de Artículos (`products`)
*   **Unicidad de SKU**: La restricción compuesta de SKU de código `@@unique([sku, businessId])` evita colisiones de códigos de barras o códigos internos entre diferentes empresas registradas en el SaaS.
*   **Bloqueo de Borrado Físico**: Si un artículo está referenciado en transacciones pasadas de compras (`PurchaseItem`) o asientos de Kardex (`StockMovement`), la base de datos PostgreSQL arronjará un error de restricción de clave foránea (`onDelete: Restrict`). El sistema captura la excepción y aplica un soft-delete lógico actualizando el estado del item.

### 2. Módulo de Compras y Abastecimiento (`purchases`)
*   **El Flujo de Aprobación Atómica**: Al transicionar una compra del estado `DRAFT` a `APPROVED`, el backend ejecuta una transacción nativa de Prisma (`prisma.$transaction`) que engloba de forma indivisible:
    1.  El cambio de estado en la cabecera `Purchase`.
    2.  El upsert de unidades en la tabla `Stock` para el depósito destino (`warehouseId`).
    3.  La inserción en Kardex (`StockMovement` tipo `ENTRY`) para auditoría.
    4.  El recálculo contable de valorización contable de existencias.
    5.  La creación del log en `activity_logs`.
*   **Inmutabilidad Financiera**: Una vez aprobada, la compra queda bloqueada para modificaciones de importes o ítems.

### 3. Módulo de Gestión de Depósitos (`warehouses`)
*   **Depósito Predeterminado**: Cada inquilino (`businessId`) debe tener un único depósito marcado con el flag `isDefault: true`. Si se marca uno nuevo, el backend ejecuta una transacción para actualizar a `false` todos los depósitos restantes de la empresa.

---

## 3. MAPA DE PERMISOS REALES DEL SISTEMA (RBAC SPECIFICATION)

A diferencia de modelos teóricos que aplican puntos de separación, el sistema de ruteo y verificación real en PresuERP procesa la cadena de permisos con el caracter `:`:
*   Módulo Usuarios: `users:read`, `users:write`, `users:delete`
*   Módulo Proveedores: `suppliers:read`, `suppliers:create`, `suppliers:update`, `suppliers:delete`
*   Módulo Almacenes: `warehouses:read`, `warehouses:create`, `warehouses:update`, `warehouses:delete`
*   Módulo Catálogo: `products:read`, `products:create`, `products:update`, `products:delete`
*   Módulo Compras: `purchases:read`, `purchases:create`, `purchases:update`, `purchases:approve`

---

## 4. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Diferencia de Identificadores (Multi-Tenant)**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **Mapeadores Analíticos**: Dado el estado parcial del punto de venta (POS), las reglas de consolidación contable de salidas rápidas de caja por mercaderías se calculan agregando movimientos sobre la tabla `stock_movements` con el flag `movementType: 'EXIT'`.
3.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
