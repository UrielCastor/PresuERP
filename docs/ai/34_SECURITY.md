# PRESUERP - AI DEVELOPMENT KIT: SECURITY SPECIFICATION

Este documento proporciona la especificación técnica y de desarrollo oficial de la **Arquitectura de Seguridad (Security Specification)** de **PresuERP**, detallando el régimen criptográfico de JWT, el ciclo seguro de Refresh Tokens, el saneamiento de inputs en endpoints, y la inyección hermética de multi-tenant de base relacional.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

PresuERP implementa un esquema de seguridad perimetral y lógica de nivel bancario para resguardar la consistencia de los datos del tenant.
*   **Defensa en Profundidad**: Aplicación de middlewares preventivos para mitigar vectores comunes de ataque (OWASP Top 10) en cada llamada HTTP.
*   **Tratamiento de Secretos**: Exclusión absoluta de llaves simétricas o variables de entorno en el repositorio de control de versiones.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El ciclo de seguridad del backend protege el acceso de datos relacionales en múltiples capas:

```
[ Petición Externa HTTP ]
           │
           ▼
[ Express Router: Helmet / CORS ] (Mitiga cabeceras e inyecciones)
           │
           ▼
[ Rate Limiting Middleware ] (Previene ataques de fuerza bruta en Auth)
           │
           ▼
[ Verification Auth Middleware ] (Valida JWT en cabecera Bearer)
           │
           ▼
[ RBAC Check Middleware ] (Filtra privilegios modulo:accion)
           │
           ▼
[ Inyección Context businessId ] (Cancela accesos inter-empresas en DB)
```

---

## 3. IDENTIDAD Y CRIPTOGRAFÍA DE SESIÓN (JWT & REFRESH TOKENS)

El sistema de login y refresco se gobierna de forma exclusiva a través de llamadas seguras:

### 1. Criptografía de Claves
*   Contraseñas procesadas mediante **BcryptJS** con un factor de salting (cost) de 10.
*   El backend no realiza deshasheo; valida credenciales mediante comparaciones nativas `bcrypt.compare()`.

### 2. Autenticación de Doble Token (Short-lived Access & Long-lived Refresh)
*   **Access Token**: Firmado simétricamente con algoritmo HS256 utilizando `JWT_SECRET`. Expira a los 15 minutos de su creación. Transporta los privilegios de usuario y el identificador `businessId` inyectados en memoria.
*   **Refresh Token**: Almacenado físicamente en la tabla de base de datos relacionales `RefreshToken` y expuesto al navegador cliente a través de una cookie exclusiva con los flags de protección `HttpOnly`, `Secure` (exige HTTPS inalterable) y `SameSite=Strict`. Expira a los 7 días y su vencimiento o eliminación en base de datos revoca de inmediato la sesión.

---

## 4. PREVENCIÓN DE INYECCIONES Y MITIGACIÓN PERIMETRAL

### 1. Inyección SQL (SQL Injection)
*   Se anula por arquitectura debido al mapeador Prisma ORM. Prisma traduce de forma nativa los queries estructurando consultas parametrizadas a PostgreSQL.
*   *Regla estricta:* Queda prohibido el uso de la directiva `$queryRaw` de Prisma pasando variables crudas concatenadas. De requerirse consultas complejas, se exige el uso de templates strings seguros (`prisma.$queryRaw` tipado).

### 2. Rate Limiting y Saneamiento
*   Se aplican limitadores dinámicos de Express (`express-rate-limit`) sobre endpoints críticos (`/api/v1/auth/login`, `/api/v1/auth/register`) bloqueando IPs que excedan 5 solicitudes por minuto.
*   Las cabeceras se sanean inyectando el middleware **Helmet** para configurar directivas como X-Content-Type-Options y bloquear Clickjacking.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en las rutinas de seguridad para evitar accesos cruzados accidentales por desvío de variables en queries Prisma.
2.  **Manejo de CORS en Ambientes Distribuidos**: En producción, el array de orígenes autorizados de CORS debe configurarse herméticamente al string absoluto del frontend productivo. No se permite el uso del comodín `*` bajo entornos donde `credentials: true` esté configurado.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
