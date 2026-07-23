# PRESUERP - AI DEVELOPMENT KIT: REPORTS & ANALYTICS MODULE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Módulo de Reportes y Analítica** de **PresuERP**, detallando los modelos de consulta relacionales PostgreSQL, las estrategias agregadas sobre Prisma ORM, la brecha operativa en las métricas de ventas, y el aislamiento multi-tenant de lectura.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **Reports** expone la capa de agregación, consolidación e inteligencia comercial de PresuERP. Su objetivo no comprende la alteración de datos; actúa de forma exclusiva como una capa de consulta de solo lectura optimizada para responder en tiempo real al panel del operador.

### Reglas de Diseño de Reportes:
*   **Pureza de Lectura**: El módulo carece de cualquier capacidad para modificar, insertar o anular registros transaccionales activos (sin mutación).
*   **Aislamiento de Análisis**: Delimita toda consulta al tenant del JWT autenticado (`businessId`) para impedir que variables comerciales confidenciales del backend se crucen entre inquilinos.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El flujo analítico está desacoplado para no sobrecargar de bloqueos (locks) concurrentes a la base de datos operativa PostgreSQL:

```
[ Dashboard UI / Gráficos React ]
               │
               ▼
   [ GET /api/v1/reports/* ]
               │
               ▼
      [ ReportController ]
 (Identifica y extrae businessId)
               │
               ▼
       [ ReportService ]
 (Queries de agregación Prisma de solo lectura: 
      groupBy, count, sum)
               │
               ▼
[ PostgreSQL: Indices no bloqueantes ]
```

---

## 3. IMPACTO DEL ESTADO PARCIAL DE VENTAS EN REPORTES

> [!IMPORTANT]
> **Consolidación en Kardex como Alternativa**: Dado el estado **PARTIAL** del módulo de POS (donde no se persisten cabeceras de facturación en las tablas relacionales de la base de datos `sales` o `sale_items`), las llamadas a indicadores de ventas tradicionales y ganancias estimadas no se pueden estructurar cruzando esas tablas. Los reportes de egresos y facturación en tiempo real del sistema deben derivarse **exclusivamente** de agregaciones lógicas sobre la tabla `stock_movements` filtrada por `movementType: 'EXIT'`.

---

## 4. QUERIES DE AGREGACIÓN SOBRE PRISMA ORM

Las consultas analíticas en `ReportService` se instrumentan aplicando optimizaciones de agregación Prisma para obviar la descarga innecesaria de colecciones masivas de datos:

### 1. Valorización del Depósito Central (Stock Value)
$$\text{Valor Stock} = \sum (\text{Stock.quantity} \times \text{Product.purchasePrice})$$
```typescript
const stockValue = await prisma.stock.findMany({
  where: { businessId, warehouseId },
  include: { product: true }
});
// Reducción en memoria usando BigDecimals para mitigar floating-points en Node.js
```

### 2. Clasificación de Alertas de Faltantes (Low Stock Alerts)
```typescript
const lowStock = await prisma.stock.findMany({
  where: {
    businessId,
    quantity: { lte: prisma.stock.fields.minimumStock }
  },
  include: { product: true }
});
```

---

## 5. RECONSTRUCCIÓN DE ENDPOINTS Y PERMISOS RBAC

### Endpoints Analíticos Expuestos:
*   `GET /api/v1/reports/dashboard`: Indicadores del día, alertas de faltantes y totalizaciones.
*   `GET /api/v1/reports/stock`: Valorización por depósito y distribución física de mercaderías.
*   `GET /api/v1/reports/purchases`: Historial agregado del total comprado y ranking de proveedores del tenant.

### Permisos del Módulo:
*   `reports:read`: Lectura y control del dashboard operativo de estadísticas.
*   `reports:export`: Descarga de reportes estructurados en formato plano CSV o Excel.

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **Locks sobre Datos Transaccionales**: Las queries de reportes masivos (con rangos extensos de fechas) sobre `stock_movements` pueden degradar temporalmente la base de datos operativa. Es crítico indexar las búsquedas por `createdAt` y `businessId`, e inyectar paginación limpia de antemano.
3.  **Auditoría de Consultas Analíticas**: Cada llamada de visualización general escribe en la tabla inmutable `activity_logs` usando la firma `action: 'REPORT_VIEWED'`, salvaguardando los accesos a datos financieros sensibles de la empresa.
