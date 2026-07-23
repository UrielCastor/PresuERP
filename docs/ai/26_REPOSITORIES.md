# PRESUERP - AI DEVELOPMENT KIT: DATA ACCESS & REPOSITORY LAYER

Este documento proporciona la especificación técnica y de desarrollo oficial de la **Capa de Repositorios (Data Access Layer)** de **PresuERP**, detallando los patrones de inyección transaccional Prisma Client, el aislamiento multi-tenant en sentencias relacionales de PostgreSQL y el control de excepciones nativas de base de datos.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

La **Capa de Repositorios** de PresuERP representa el único canal físico de lectura y escritura habilitado con el motor relacional PostgreSQL mediante Prisma ORM.
*   **Desacoplamiento Estricto**: Ningún controlador HTTP Express o servicio ejecuta sentencias inline de Prisma Direct (`prisma.model.*`). Todas las interacciones se resuelven a través de llamadas de métodos a los Repositorios.
*   **Encapsulamiento Relacional**: Las consultas SQL crudas o dependencias de indexación de base de datos residen en esta capa de persistencia.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

```
                 [ Backend Service Class ]
                             │
                             ▼
                 [ Repository (Interface) ]
                             │
                             ▼
               [ PrismaRepository Class ]
 (Recibe la instancia de transacción prisma 'tx')
                             │
                             ▼
              [ PostgreSQL Data Execution ]
```

---

## 3. INYECCIÓN TRANSACCIONAL COMPONIBLE (TX INJECTION)

Para que los repositorios puedan correr de forma atómica bajo transacciones complejas definidas a nivel de los servicios (`$transaction`), todos los métodos de escritura y lectura de los repositorios aceptan un argumento opcional final denominado `tx` del tipo `PrismaClient` o transaccional.

```typescript
// Implementación real del patrón en User Repository:
async findById(id: string, businessId: string, tx?: any): Promise<User | null> {
  const client = tx || prisma;
  return client.user.findFirst({
    where: { id, businessId }
  });
}
```

---

## 4. FILTRADO OBLIGATORIO MULTI-TENANT E INTEGRIDAD RELACIONAL

### 1. El Aislamiento por `businessId`
Todos los queries del repositorio incorporan el filtrado lógico `{ businessId }` en la clásula `where` para evitar la lectura o modificación accidental de colecciones de otras organizaciones parametrizadas.

### 2. Conversión de Excepciones del Motor Prisma
Los repositorios capturan y normalizan los códigos de error del motor Prisma a excepciones semánticas de dominio:
*   **`P2002` (Unique Constraint Violation)**: Se traduce y arroja como `ConflictError` (ej: CUIT o SKU duplicado del inquilino).
*   **`P2025` (Record to Update Not Found)**: Se traduce y arroja como `NotFoundError` de negocio.

---

## 5. RECONSTRUCCIÓN DE REPOSITORIOS DEL SISTEMA

Los archivos de persistencia residen físicamente en `erp/backend/src/repositories/`:
1.  `user.repository.ts`: Consulta de perfiles, autenticación, inicialización de operarios y soft deletes booleanos (`isActive = false`).
2.  `product.repository.ts`: CRUD de items de catálogo, precios base, costo y mutaciones de SKU.
3.  `purchase.repository.ts`: Altas, actualizaciones de estado a `APPROVED` o `CANCELLED` y consultas agrupadas de facturación de proveedores.
4.  `stock.repository.ts`: Gestión analítica de existencias por almacén y upserts directos.
5.  `stockMovement.repository.ts`: Registro secuencial del Kardex e históricos financieros del tenant.

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Diferencia de Identificadores (Multi-Tenant)**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **No Cargar Relaciones Innecesarias (`include` Rules)**: Es mandatorio limitar el uso de `include` dinámicos que ralentizan las consultas concurrentes. Relaciones pesadas compartidas (ej. cargar todos los movimientos de stock al listar depósitos) deben paginarse desde repositorios satélites.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
