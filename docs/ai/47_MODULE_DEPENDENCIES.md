# PRESUERP - AI DEVELOPMENT KIT: MODULE DEPENDENCY SPECS

Este documento proporciona la especificación de la **Matriz de Interdependencias de Módulos (Module Dependencies)** de **PresuERP**, detallando los acoplamientos lógicos entre los subsistemas de abastecimiento, inventarios, facturación, e identidad para prevenir regresiones encadenadas de compilación.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

PresuERP está diseñado bajo principios de modularidad, sin embargo, el flujo logístico y financiero de un ERP vincula necesariamente múltiples entidades.
*   **Gestión del Impacto Colateral**: Advertir a futuros desarrolladores e inteligencias artificiales sobre qué ramificaciones en un módulo (ej: modificar el modelo de Proveedores) impacta de forma directa la persistencia de otros (ej: Compiladores de Compras y Kardex).

---

## 2. ARQUITECTURA FISICA Y GRÁFICO DE ACOPLAMIENTOS

La topografía relacional de módulos y dependencias cruzadas en backend se ordena según el siguiente grafo lógico:

```
          [ Auth: JWT, Users & RBAC ] (Gobernanza transversal)
                       │
                       ▼
             [ Product Catalog ] <─────────────┐
                       ▲                       │
        ┌──────────────┼──────────────┐        │
        ▼              ▼              ▼        │
   [ Purchases ] ──> [ Stock ] ──> [ Kardex ]  │
        ▲              ▲                       │
        │              │                       │
   [ Suppliers ]  [ Warehouses ]               │
                                               │
                                               ▼
                                         [ POS / Sales ]
```

---

## 3. ACOPLAMIENTOS CRÍTICOS Y REGLAS DE EXTENSIÓN

A continuación se detallan las relaciones funcionales ineludibles por capa:

### 1. Módulo de Compras (`purchases`)
*   **Depende de**: `Supplier` (provee identidad fiscal), `Warehouse` (define destino físico), `Product` (items del remito), `Stock` (debe actualizar existencias) y `StockMovement` (asienta movimiento de Kardex).
*   **Riesgo de Cambio**: Modificar la estructura de campos requeridos al crear un proveedor (`taxId`, `name`) romperá de inmediato la aserción y creación de formularios de órdenes de compra en el backend, debido a que la transacción Zod en Express exige correspondencia estricta.

### 2. Módulo de Inventario Físico (`stock` & `kardex`)
*   **Depende de**: `Product` y `Warehouse`.
*   **Riesgo de Cambio**: La eliminación física de un almacén (`Warehouse`) interrumpirá de forma catastrófica las lecturas en la tabla `Stock` y las búsquedas históricas en `StockMovement` (Kardex). Para mitigar riesgos de base relacionales, PostgreSQL implementa restricciones de integridad foránea `Restrict` en base de datos.

---

## 4. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en los mapeadores de dependencias para evitar roturas de compilación en Prisma.
2.  **Riesgo en Inicialización de Roles (Seed Dependency)**: El módulo de Autenticación depende de que existan en la tabla `roles` el rol bootstrapping `'Administrator'` para poder registrar el primer usuario del tenant. Alterar dicho proceso de inicialización inicial corrompe de inmediato los procesos de alta de nuevos inquilinos en el SaaS.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
