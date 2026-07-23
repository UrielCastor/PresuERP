# PRESUERP - AI DEVELOPMENT KIT: USERS MODULE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Módulo de Usuarios e Identidad (Users)** de **PresuERP**, detallando los modelos relacionales PostgreSQL, el resguardo criptográfico de credenciales mediante hashes en backend, la decodificación del token de sesión JWT, y el ruteo de seguridad multi-tenant.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **Users** centraliza el control de identidad y los privilegios de los operarios de la empresa en PresuERP.
*   **Gestión de Credenciales**: Regula el guardado seguro de hashes, impidiendo la visualización o extracción del password en planos legibles.
*   **Asociación de Roles**: Vincula cada cuenta de usuario contra un rol funcional dinámico (`Role`) del inquilino, delegando el control fino de permisos al middleware de autenticación.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El ciclo de seguridad y validación de usuarios sigue este flujo atómico:

```
[ POST /users ] OR [ PUT /users/:id ]
                       │
                       ▼
               [ UserController ]
      (Validación de esquemas Zod en body)
                       │
                       ▼
                 [ UserService ]
    (Hasheo de contraseñas mediante bcrypt)
                       │
                       ▼
                [ UserRepository ]
   (Sentencia Prisma: insert / update a db)
```

---

## 3. MODELADO DE DATOS (EN PRISMA)

El perfil de cuentas de usuario se registra físicamente en la siguiente tabla PostgreSQL vía `schema.prisma`:

### Model `User` (Físico postgres: `users`)
*   **Estructura**:
```prisma
model User {
  id           String         @id @default(uuid())
  name         String
  email        String         @unique
  password     String
  isActive     Boolean        @default(true)
  businessId   String
  business     Business       @relation(fields: [businessId], references: [id], onDelete: Cascade)
  roleId       String
  role         Role           @relation(fields: [roleId], references: [id], onDelete: Restrict)
  refreshTokens RefreshToken[]
  purchases    Purchase[]
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@unique([email, businessId])
  @@map("users")
}
```

---

## 4. CONTROL DE ACCESOS Y HASHEADO CORPORATIVO (BCRYPT SALTING)

1.  **Criptografía Segura**: `UserService` procesa la clave del operario usando la librería `bcryptjs` con un factor de trabajo (salt) de 10 iteraciones antes de persistir la fila.
2.  **Exclusión de Datos Sensibles**: Las llamadas a los endpoints del controlador (ej: `GET /api/v1/users` o `/me`) omiten deliberadamente el campo `password` en el objeto limpio retornado en la respuesta JSON.
3.  **Soft-Delete Lógico (`isActive = false`)**: Debido a que los operarios conservan referencias cruzadas históricas inmutables en las tablas relacionales de la base de datos `purchases`, `stock_movements` o `cash_movements`, se prohíbe el borrado físico (`onDelete: Restrict`). Toda baja de cuenta del operario se gestiona lógicamente seteando el booleano `isActive: false`.

---

## 5. CAPTURA DE PANTALLAS DE AUDITORÍA (ACTIVITY LOGS)

El sistema de auditoría registra las siguientes firmas:
*   *Login Exitoso*: `action: 'USER_LOGIN'`.
*   *Actualización de Perfil*: `action: 'USER_UPDATED'`.
*   *Creación de Operario*: `action: 'USER_CREATED'`.
*   *Filtro Multi-Tenant*: Las consultas del repositorio inyectan de forma mandatoria el parámetro `{ businessId }` obtenido en el middleware Express del JWT verificado para anular cross-tenant.

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Campos de Identidad**: El diseño del backend de PresuERP no requiere variables duplicadas como `tenantId` o emails dispersos. La columna configurada físicamente en el motor de base de datos relacionales PostgreSQL se llama strictly `businessId`.
2.  **Estado Activo de Cuentas**: A diferencia de la propuesta funcional del enum `status: ACTIVE | INACTIVE | BLOCKED`, el esquema físico almacena el flag simple `isActive` como booleano (`true`/`false`). El middleware `requireAuth` valida este valor al evaluar el login.
3.  **Auditoría de Inicios de Sesión**: La creación e inserción de logs en la base relacional permite registrar quién realizó el acceso. No obstante, se debe cuidar que las columnas de IP y User Agent recuperen el valor real desde los headers de Express para mayor control en auditorías.
4.  **Bypass de Permisos**: Si el operador cuenta con la cadena `'Administrator'` en su propiedad de rol, se omite el chequeo de strings y se concede acceso por defecto a nivel de middleware.
