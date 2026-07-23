# PRESUERP - AI DEVELOPMENT KIT: TESTING STRATEGY

Este documento define la estrategia e infraestructura oficial de pruebas (Testing Strategy) de **PresuERP**, detallando el marco de ejecución para pruebas unitarias, de integración y de capa API, así como los lineamientos para aserciones robustas sin interacción concurrente.

---

## 1. MÁXIMOS OPERATIVOS DEL SISTEMA DE PRUEBAS

Las suites de testeo en PresuERP buscan verificar de forma matemática y determinista la no regresión del sistema.
*   **Aislamiento de Entornos**: Queda prohibido correr suites contra la base de datos de producción o desarrollo local ordinario. Se define y exige la inyección de `NODE_ENV=test` levantando una base PostgreSQL temporal limpia.
*   **Integridad de Datos**: Cada suite se encarga de bootstrappear sus propios datos semilla y truncar las tablas físicas a través de un interceptor hook `afterEach` o `beforeEach` de Vitest/Jest.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO DE TESTING

El pipeline de pruebas se desacopla en tres capas atómicas:

```
           [ Jest / Vitest Runner ]
                       │
      ┌────────────────┼────────────────┐
      ▼                ▼                ▼
 [ Unit Tests ]   [ Integration ]  [ API Endpoints ]
  (Mock completo    (Usa Base Postgres (Supertest contra
   de Prisma)       de pruebas limpia)  controladores API)
```

---

## 3. COMPENSACIÓN Y MODELO DE PRUEBA UNITARIA (SERVICE TESTING)

Al probar código a nivel de Services (ej. `PurchaseService`), se mockean las operaciones de repositorio o se inyectan transacciones que hacen rollback al completarse la aserción.

### Ejemplo de Test Unitario en Vitest/Jest:
```typescript
import { expect, test, vi, beforeEach } from 'vitest';
import { approvePurchase } from '../../services/purchase.service';
import * as stockMovementService from '../../services/stockMovement.service';

vi.mock('../../services/stockMovement.service');

beforeEach(() => {
  vi.clearAllMocks();
});

test('Debe interrumpir aprobación si el stock disponible es insuficiente', async () => {
  const context = { businessId: 'b1-uuid', userId: 'u1-uuid' };
  
  // Aserción del límite de negocio
  await expect(
    approvePurchase('purchase-erronea-id', context)
  ).rejects.toThrowError('Insufficient stock');
});
```

---

## 4. PRUEBAS DE CAPA API (SUPERTEST INTEGRATION)

Las pruebas `/api/v1/*` simulan peticiones HTTP reales utilizando la firma Bearer JWT correspondiente a fin de validar que los middlewares verifiquen la unicidad de inquilinos (`businessId`).

### Flujo de Prueba de Ruteo:
1.  Bootstrappear un `Business` de prueba y su `User` Administrador.
2.  Generar una firma JWT temporal mockeadas para el `businessId` creado.
3.  Simular llamada HTTP con `supertest` inyectando el header `Authorization`.
4.  Validar que el cuerpo retorne el estándar `{ success: true, data: ... }` y código 200.
5.  Simular la misma llamada con un token de otra empresa y verificar que retorne HTTP 403 o HTTP 404 para garantizar la seguridad multi-tenant.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en las suites de testeo para evitar excepciones de compilación de Prisma.
2.  **Locks Concurrentes en SQLite**: Se descarta el uso del motor SQLite en memoria para mockear localmente los tests, debido a que no compila ciertos tipos avanzados de PostgreSQL presentes en `schema.prisma` (como `@db.Decimal(12, 4)` o agregaciones de JSON). Es mandatorio utilizar una base física containerizada de PostgreSQL local para tests.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
