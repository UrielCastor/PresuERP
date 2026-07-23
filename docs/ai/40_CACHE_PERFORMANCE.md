# PRESUERP - AI DEVELOPMENT KIT: PERFORMANCE & CACHE STRATEGY

Este documento proporciona la especificación técnica y de desarrollo oficial del **Plan de Performance y Caché** de **PresuERP**, detallando los patrones de optimización en PostgreSQL, la prevención de consultas N+1 en Prisma ORM, las políticas de caché transaccional en Redis, y el Lazy Loading de componentes React.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

La velocidad de respuesta es fundamental en la experiencia de mostrador y facturación de un ERP.
*   **Eficiencia de Base de Datos**: Evitar bloqueos de fila por consultas repetitivas de solo lectura en base.
*   **Optimizaciones de Red**: Consolidar y empaquetar JSON pequeños para que la carga en terminales móviles o POS sea instantánea.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

La estrategia de aceleración de consultas interpone capas temporales de acceso a datos:

```
                  [ Petición HTTP GET /api/* ]
                               │
                               ▼
                    [ Controladores API ]
                               │
                     ( Check de Llave Redis )
                               ├──────────────────────────┐
                               ▼                          ▼
                          ( Hit )                      ( Miss )
                               │                          │
                               ▼                          ▼
                       [ Retorna JSON ]         [ Consulta PostgreSQL ]
                                                          │
                                                          ▼
                                                  [ Guarda en Redis ]
```

---

## 3. PREVENCIÓN DE CONSULTAS INEFICIENTES EN PRISMA (N+1 PROBLEM)

El uso descuidado del ORM Prisma puede disparar múltiples consultas consecutivas en bucle para resolver relaciones (ej: traer por separado la categoría de cada uno de los 500 productos listados).

### Prescripción de Query Óptimo:
*   Usar de forma explícita el bloque `include` o `select` de Prisma al recuperar listados para forzar a PostgreSQL a ejecutar subconsultas optimizadas o cruzamiento tipo INNER/LEFT JOIN en una sola transacción:
```typescript
// Consulta eficiente unificada en Product Repository:
const products = await prisma.product.findMany({
  where: { businessId },
  include: {
    category: {
      select: { name: true } // Evita traer columnas innecesarias
    }
  }
});
```

---

## 4. OPTIMIZACIÓN LOCAL DEL FRONTEND REACT

Para sostener el rendimiento del cliente React empaquetado en Vite:
*   **Lazy Loading**: Rutas y páginas pesadas (ej: `/reports`) se importan de forma tardía mediante `React.lazy()` y `Suspense`, reduciendo el bundle de javascript inicial de carga de la SPA.
*   **Virtualización de Tablas**: Para colecciones que excedan las 200 filas de existencias visuales en el navegador sin paginación física, se aconseja integrar virtualización de DOM (como `react-window`) para el renderizado exclusivo de filas visibles en el viewport.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en la arquitectura de caché para evitar leaks de visualización entre tenants.
2.  **Invalidación de Caché en Redis**: El almacenamiento en caché de elementos del catálogo (`products:list:${businessId}`) agiliza las consultas del POS. No obstante, es crítico invalidar de forma total esta entrada (`redis.del()`) ante cualquier inserción o cambios de precio (`ProductService.updatePrices`), garantizando que la facturación de caja nunca procese precios desactualizados.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
