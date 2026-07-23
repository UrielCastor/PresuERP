# PRESUERP - AI DEVELOPMENT KIT: SEARCH & FILTER ENGINE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Motor de Búsquedas y Filtros (Search & Filters)** de **PresuERP**, detallando los patrones de filtrado dynamic queries en Prisma, la indexación de base de datos relacionales en PostgreSQL y el consumo optimizado del lado de React.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El volumen operativo de un ERP exige consultas en bases de datos que no degraden el rendimiento transaccional.
*   **Velocidad Comercial**: Habilitar a los operarios la localización instantánea de ítems por código SKU y coincidencias ortográficas aproximadas.
*   **Aislamiento y Consistencia**: Mantener el contexto multi-tenant (`businessId`) adosado a cada expresión lógica, anulando cross-tenant relacionales.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El flujo de procesamiento de una búsqueda parametrizada sigue este canal:

```
[ Frontend: Input Search (Debounced 300ms) ]
                    │
                    ▼
       [ GET /api/v1/*?search=term ]
                    │
                    ▼
     [ Controller: Zod Query Schema ]
                    │
                    ▼
        [ Service / Repository ]
  (Genera objeto Clausura 'where' en Prisma)
                    │
                    ▼
   [ PostgreSQL: Index-Scan matching ]
```

---

## 3. CONSOLIDACIÓN DE QUERIES DINÁMICAS EN PRISMA

Los repositorios estructuran los queries de Prisma de forma adaptativa evaluando los argumentos presentes en `req.query`:

```typescript
// Estándar dinámico en Product Repository:
const whereClause: Prisma.ProductWhereInput = {
  businessId, // Filtrado absoluto obligante
  isActive: true
};

if (filters.search) {
  whereClause.OR = [
    { name: { contains: filters.search, mode: 'insensitive' } },
    { sku: { contains: filters.search, mode: 'insensitive' } }
  ];
}

if (filters.categoryId) {
  whereClause.categoryId = filters.categoryId;
}

const products = await prisma.product.findMany({
  where: whereClause,
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { name: 'asc' }
});
```

---

## 4. ESTRATEGIAS DE OPTIMIZACIÓN E ÍNDICES EN BASE DE DATOS

Para evitar que PostgreSQL realice barridos de tabla completa (Table-Scan) que bloquen la concurrencia:
*   **Índices Compuestos**: Se dispone en `schema.prisma` de la construcción de índices relacionales en las columnas más buscadas agregadas a la relación multiempresa, por ejemplo: `@@index([businessId, sku])` y `@@index([businessId, name])`.
*   **Debounce Obligatorio**: Los componentes de búsqueda rápida en el frontend React aplican un delay lógico de 300 milisegundos (`useDebounce`) antes de despachar la petición Axios, amortiguando ráfagas innecesarias al framework Express.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en los filtros de base para evitar interrupciones en la compilación de Prisma.
2.  **Operación ILIKE en Grandes Bases**: El operador `contains` con `mode: 'insensitive'` de Prisma se traduce en expresiones `ILIKE` secundarias en PostgreSQL. A nivel corporativo, si la tabla `products` excede las 100.000 filas, estas búsquedas deben optimizarse aplicando índices GIN o extensiones de búsqueda avanzada de texto (Full-Text Search), de lo contrario se degradará el rendimiento general.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
