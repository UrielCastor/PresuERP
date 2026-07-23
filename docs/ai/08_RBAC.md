# PRESUERP - AI DEVELOPMENT KIT: ROLE BASED ACCESS CONTROL (RBAC)

Este documento detalla la especificación oficial y el funcionamiento del **Sistema de Control de Acceso Basado en Roles y Permisos (RBAC)** de **PresuERP**, describiendo los middlewares de seguridad, el bypass de superusuario, su nomenclatura, políticas de restricción multi-tenant y su integración relacional.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **RBAC** gobierna la autorización de las acciones del operador a nivel del servidor de backend.
*   **Regla de Oro**: La seguridad reside y es validada estrictamente en el backend. El cliente frontend React únicamente oculta vistas o botones del panel visual según su contexto de permisos para optimizar la usabilidad, pero no representa una garantía de seguridad.
*   **Aislamiento**: Todo rol personalizado se parametriza y almacena bajo el ámbito de su inquilino (`businessId`), bloqueando la escalabilidad ilegal de privilegios inter-inquilino.

---

## 2. ARQUITECTURA DE AUTORIZACIÓN (FLUJO DE UNA SOLICITUD)

```
[ Petición HTTP ] 
       │
       ▼
[ Middleware requireAuth ] ────> Decodifica JWT y setea req.user
       │
       ▼
[ Middleware requirePermission ] ────> ¿Es Administrator? ──(Sí)──> [ Ejecuta Controlador ]
       │                                       │
      (No)                                     │
       │                                       ▼
       └────> ¿permissions contiene string? ──(Sí)──> [ Ejecuta Controlador ]
                       │
                      (No)
                       │
                       ▼
             [ HTTP 403 Forbidden ]
```

---

## 3. IDENTIFICADORES Y BASE DE DATOS

El sistema RBAC se apoya físicamente sobre las siguientes entidades relacionales de `schema.prisma`:

### Model `Role`
Representa al conjunto agrupador de permisos localizable por inquilino.
*   **Estructura**:
    *   `id`: String (PK, UUID).
    *   `name`: String (nombre del rol).
    *   `description`: String opcional.
    *   `businessId`: String (FK del tenant).
    *   `isSystem`: Boolean (indica si es un rol base inyectado por defecto).
    *   `permissions`: Relación N:N mapeada en la tabla relacional intermedia `RolePermission`.
*   **Restricción**: Nombre único compuesto por empresa (`@@unique([name, businessId])`).

### Model `Permission`
Representa al permiso granular compartido globalmente a nivel de sistema.
*   **Estructura**:
    *   `id`: String (PK, UUID).
    *   `name`: String único del permiso (ej. `products:read`).
    *   `module`: Módulo agrupador (ej. `products`).
    *   `description`: Explicación sintáctica.

---

## 4. NOMENCLATURA REAL DE PERMISOS DETECTADA

El estándar físico de nombres definido en `schema.prisma` y precargado en `AuthService` utiliza el formato con `:` (dos puntos): `modulo:accion`.

### Listado Oficial de Permisos del Sistema:
*   **Usuarios**: `users:read`, `users:write`, `users:delete`
*   **Productos**: `products:read`, `products:create`, `products:update`, `products:delete`, `products:write`
*   **Categorías**: `categories:read`, `categories:create`, `categories:update`, `categories:delete`
*   **Proveedores**: `suppliers:read`, `suppliers:create`, `suppliers:update`, `suppliers:delete`
*   **Almacenes**: `warehouses:read`, `warehouses:create`, `warehouses:update`, `warehouses:delete`
*   **Existencias**: `stocks:read`, `stocks:update`
*   **Kardex**: `kardex:read`, `kardex:export`
*   **Ventas**: `sales:read`, `sales:write`
*   **Parámetros**: `settings:read`, `settings:write`
*   **Compras**: `purchases:read`, `purchases:create`, `purchases:update`, `purchases:approve`, `purchases:cancel`

---

## 5. MIDDLEWARES DE AUTORIZACIÓN EN EXPRESS

El backend de PresuERP implementa dos middlewares de intercepción de accesos en `auth.middleware.ts`:

### 1. `requirePermission(permissionName: string)`
*   **Bypass de Administradores**: Si el rol del operador (`req.user.role`) es exactamente `'Administrator'`, el middleware concede acceso incondicionalmente (`next()`) omitiendo verificar sus permisos.
*   **Validación de Permisos**: Verifica si `req.user.permissions` contiene el string solicitado. Si se confirma la ausencia del mismo, bloquea el flujo llamando a `next(new ForbiddenError())`, resultando en una respuesta formateada JSON con estado HTTP 403 (Forbidden).

### 2. `requireRole(rolesAllowed: string[])`
*   Protege rutas específicas obligando a que el campo de rol exacto del operador coincida con el array de nombres autorizados.

---

## 6. SEGURIDAD Y INTEGRACIÓN EN MULTI-TENANCY

*   **Pertenencia de Roles**: La edición y consulta de roles personalizados se limita exclusivamente al tenant del usuario autenticado:
```typescript
// Lógica de búsqueda en RoleRepository:
async findRole(id: string, businessId: string) {
  return prisma.role.findFirst({
    where: { id, businessId }
  });
}
```
*   **Validaciones en Asignación**: Al asociar un rol a un usuario, la capa de servicios valida de manera cruzada que tanto la credencial del operario como el identificador del rol pertenezcan estrictamente al mismo `businessId`, anulando cualquier intento de manipulación manual de identificadores desde el cliente HTTP.
*   **Denegación Dinámica**: Si no se inyecta JWT en las cabeceras REST primarias, el middleware lanza un error de falta de autorización (HTTP 401) anulando por completo la ejecución y previniendo caídas imprevistas del flujo.
