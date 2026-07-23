# PRESUERP - AI DEVELOPMENT KIT: ROLES & PERMISSIONS MODULE (RBAC)

Este documento proporciona la especificación técnica y de desarrollo oficial del **Módulo de Roles y Permisos (RBAC)** de **PresuERP**, detallando los modelos relacionales PostgreSQL, la jerarquía de permisos dinámicos y la asignación multi-tenant lógica.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **Roles** de PresuERP es la herramienta de seguridad interna que autoriza y limita el campo de acción de cada usuario operador.
*   **Aislamiento**: Los roles personalizados se asignan de forma directa al tenant de la empresa (`businessId`), evitando la escalabilidad y asignación inter-empresa.
*   **Permisología Real**: El estándar de nombres de permisos a nivel de base de datos relacionales PostgreSQL y código real es `modulo:accion`.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

```
[ Petición con JWT ] ────> requireAuth (Decodifica perfil y permisos del usuario)
                                  │
                                  ▼
                        [ Middleware RBAC ]
      ¿Usuario posee rol 'Administrator' o string de permiso inyectado?
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
               ( Sí )                          ( No )
                  │                               │
                  ▼                               ▼
       [ Ejecuta Controlador ]          [ HTTP 403 Forbidden ]
```

---

## 3. MODELADO DE DATOS (EN PRISMA)

El esquema de permisos se define sobre tres tablas vinculadas en PostgreSQL vía `schema.prisma`:

### Model `Role` (Físico postgres: `roles`)
```prisma
model Role {
  id          String           @id @default(uuid())
  name        String
  description String?
  isSystem    Boolean          @default(false)
  businessId  String
  business    Business         @relation(fields: [businessId], references: [id], onDelete: Cascade)
  permissions RolePermission[]
  users       User[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@unique([name, businessId])
  @@map("roles")
}
```

### Model `Permission` (Físico postgres: `permissions`)
```prisma
model Permission {
  id          String           @id @default(uuid())
  name        String           @unique // Formato 'modulo:accion'
  description String?
  module      String
  roles       RolePermission[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@map("permissions")
}
```

### Model `RolePermission` (Físico postgres: `role_permissions`)
```prisma
model RolePermission {
  id           String     @id @default(uuid())
  roleId       String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@unique([roleId, permissionId])
  @@map("role_permissions")
}
```

---

## 4. PERMISOS POR DEFECTO Y ROLES DEL SISTEMA (`ISSYSTEM` RULE)

Al inicializar un tenant a través de `AuthService.registerBusinessTenant` se crean los roles con `isSystem: true`:
1.  **`Administrator`**: Se le asocia la lista total de registros de permisos de `whitelistPermissions` y goza de pasaje libre (bypass completo) en el middleware `requirePermission`.
2.  **`Supervisor`**: Rol de nivel medio con permisos de visualización ampliada de catálogo, creación de compras y aprobación fiscal de mercadería.
3.  **`Cajero`**: Cajero de terminal POS. Limitado a listar artículos, proveedores y generar existencias e ingresos por caja.

---

## 5. RESTRICCIONES DE CLAVES E INMUTABILIDAD

*   **Restricción de Eliminación Física**: Si un rol posee operarios asociados en la tabla `User` de la base de datos relacionales, PostgreSQL bloqueará cualquier borrado físico (`onDelete: Restrict`) para asegurar la coherencia temporal de auditoría.
*   **Bypass de System Roles**: Los roles clave (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **Separación Estricta N:N**: La tabla intermedia `RolePermission` acopla correctamente el esquema mitigando loops relacionales. Debe vigilarse que la base realice búsquedas integradas optimizadas reduciendo el número de subconsultas concurrentes.
3.  **Nomenclatura de Strings**: Los permisos utilizan el carácter `:` en lugar de `.` (ej. `products:read`, `purchases:approve`). Esta lógica está forzada en el código fuente de los controladores Express y en la inicialización `whitelistPermissions` del pool de seguridad del backend.
