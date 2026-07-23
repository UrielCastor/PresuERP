# PRESUERP - AI DEVELOPMENT KIT: BACKEND MIDDLEWARE SYSTEM

Este documento proporciona la especificación técnica y de desarrollo oficial del **Sistema de Middlewares del Backend** de **PresuERP**, detallando el flujo de interceptación HTTP Express, los validadores de esquemas Zod, las reglas de ruteo de seguridad JWT y RBAC, y el handler global de excepciones.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

Los **Middlewares** constituyen la primera línea de protección lógica y funcional de PresuERP. Operan interceptando las llamadas HTTP destinadas a los controladores de Express.
*   **Transversalidad de Control**: Filtra e inyecta parámetros comunes de sesión sin duplicar código en las clases de controladores.
*   **Gestión Multi-Tenant**: Extrae el identificador de tenant unificado en el payload decodificado del JWT para alimentar transversalmente el contexto.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El ciclo de filtrado intercepta la solicitud entrante en el siguiente orden secuencial:

```
                  [ Petición HTTP Entrante ]
                              │
                              ▼
            [ Router Express: CORS y Helmet ]
                              │
                              ▼
           [ requireAuth (Verificación JWT) ]
     (Decodifica payload y lo asocia a req.user)
                              │
                              ▼
    [ requirePermission (Control de Acceso RBAC) ]
    (Valida string modulo:accion o Administrator)
                              │
                              ▼
       [ validateRequest (Validaciones con Zod) ]
    (Interrumpe ruteo si el body posee campos erróneos)
                              │
                              ▼
                 [ Controlador de Destino ]
```

---

## 3. IDENTIDAD Y CONTROL DE SESIONES (`AUTH.MIDDLEWARE.TS`)

El archivo neurálgico de autenticación reside físicamente en `erp/backend/src/middlewares/auth.middleware.ts` y expone las siguientes subrutinas:

### 1. `requireAuth`
*   **Procedimiento**: Examina el header HTTP `Authorization: Bearer <JWT>`. Si no existe o su firma criptográfica falla (expirado o alterado), interrumpe el flujo retornando un estado HTTP 401.
*   **Inyección al Request**: Al validar exitosamente, guarda en la propiedad `req.user` un objeto tipado con los metadatos de sesión:
```typescript
req.user = {
  id: string,          // ID del usuario
  email: string,       // Email del usuario
  role: string,        // Nombre del Rol asignado (ej: 'Administrator')
  businessId: string   // ID del Tenant (Inquilino)
}
```

### 2. `requirePermission(permission: string)`
*   **Régimen RBAC**: Middleware dinámico cargado con el string `'modulo:accion'` (ej. `'purchases:approve'`).
*   **Bypass**: Si `req.user.role` es exactamente `Administrator`, concede acceso inmediato sin búsquedas adicionales en base de datos. De lo contrario, verifica si el string de permiso reside en el arreglo de permisos decodificado del token. Si la validación falla, retorna un estado HTTP 403.

---

## 4. SISTEMA DE VALIDACIÓN ZOD Y HANDLER DE ERRORES GLOBAL

### 1. Validación de Payloads (`validateRequest`)
*   Se implementa pasando esquemas Zod (`ZodSchema`) como argumentos.
*   Si los tipos de body, query o params fallan, captura el arreglo de errores de validación de Zod y retorna un estado HTTP 400 formateado para consumo directo por la UI de React.

### 2. Capturador de Excepciones Centralizado (`errorHandler`)
Reside en `error.middleware.ts` como la última capa de Express. Evita que trazas crudas del compilador o detalles de la base de datos Postgres se expongan al cliente:
*   **Errores de Dominio**: Respeta estados específicos definidos (ej: `ConflictError` como HTTP 409, `NotFoundError` como HTTP 404).
*   **Errores Internos**: Cualquier excepción genérica del sistema es interceptada, registrada en consola de servidor, y retornada al cliente bajo un estado HTTP 500 simplificado.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **Locks en Concurrencia de Verificaciones**: El middleware `requireAuth` lee directamente los datos del token JWT decodificado en memoria en lugar de ejecutar una query a base de datos por cada petición entrante, reduciendo el tráfico de red de forma sustancial en producción.
3.  **Cookies Exclusivas HttpOnly**: Para el proceso de renovación del Refresh Token, el flujo de ruteo de Express debe acceder a cookies seguras protegidas, bloqueando la exposición de credenciales contra scripts XSS en cliente.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
