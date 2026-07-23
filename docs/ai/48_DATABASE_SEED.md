# PRESUERP - AI DEVELOPMENT KIT: DATABASE SEED SPECIFICATION

Este documento proporciona la especificación técnica y de desarrollo oficial del **Proceso de Inicialización de Base de Datos (Database Seed)** de **PresuERP**, detallando los scripts transaccionales de migración de datos, los roles de sistema por defecto (bootstrapping), y la inicialización de permisos.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

PresuERP requiere inyectar un conjunto de datos iniciales estructurados indispensables para que el backend Express y el ruteador del frontend React operen de forma correcta desde el primer despliegue local o productivo.
*   **Inicialización Segura**: Garantizar la existencia de privilegios y roles maestros para evitar que los logins iniciales resulten bloqueados por el middleware RBAC.
*   **Idempotencia Absoluta**: Los scripts de siembra en base de datos (`seed.ts`) deben poder ejecutarse de forma recurrente sin duplicar filas, sobreescribir configuraciones en producción o alterar balances del negocio.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El ciclo de siembra es automatizado a través de los scripts integrados de Prisma ORM:

```
                  [ Prisma Migrate Completion ]
                               │
                               ▼
                   [ npx prisma db seed ]
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     [ Seed Global ]    [ Seed de Permisos ]  [ Create Admin User ]
   (Carga de Países,      (Esquema modular     (Inyecta credenciales
    Monedas y Tablas)      modulo:accion)     primer admin en tenant)
```

---

## 3. ESPECIFICACIÓN DE DATOS INICIALES (BOOTSTRAPPING SEED)

La de persistencia inicial implementa de forma ineludible las siguientes subrutinas:

### 1. Inyección de Roles Maestros del Inquilino (`roles`)
Al registrar o inicializar una base de datos relacionales para un tenant, se inyectan en base de datos los roles maestros protegidos configurando el bit `isSystem: true`:
*   `Administrator`: El rol supremo. Accede de forma automática a todos los módulos y validaciones cruzadas.
*   `Supervisor`: Rol de control intermedio para compras y almacenes.
*   `Operator`: Operario logístico y de consultas.
*   `Cashier`: Rol restringido al punto de venta rápido.

### 2. Catálogo Oficial de Permisos Relacionales (`permissions`)
Todos los permisos reales con formato `modulo:accion` (ej: `users:read`, `purchases:approve`, `products:create`, `warehouses:write`) son insertados sistemáticamente. Si se agrega un nuevo módulo Express en el código, el desarrollador añade el string en el lote del seed para asegurar que la UI React y la guardia de ruteo lo decodifiquen.

---

## 4. CONSTRUCCIÓN IDEMPOTENTE DEL SEED (UPSERT PATTERN)

Para evitar duplicaciones y caídas por llaves duplicadas (`P2002` en Prisma), los scripts utilizan de forma exclusiva el método `upsert` de Prisma:

```typescript
// Implementación real del patrón idempotente en backend seed:
for (const permission of defaultPermissions) {
  await prisma.permission.upsert({
    where: { code: permission.code },
    update: {}, // No sobreescribe cambios hechos por configuración
    create: permission
  });
}
```

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en los scripts de seed para evitar excepciones de compilación de Prisma.
2.  **No Limpiar Tablas Operativas**: Queda prohibido el uso del método `deleteMany()` en los scripts de inicialización seed si la base de datos ya está en modo testing o producción. Se exige que el seed verifique e inyecte sólo elementos faltantes conservando los existentes intactos.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
