# 🗺️ MAPA GENERAL DEL SISTEMA PRESUERP

## 1. ESTADO GLOBAL MACRO
PresuERP es un sistema híbrido **Multi-tenant SaaS + ERP** estructurado en un monorepo físico dividido lógicamente en `backend` y `frontend`.

## 2. ESTRUCTURA DE BACKEND (`/backend/src`)
El backend utiliza Node.js, Express y TypeScript.
Patrón Arquitectónico: **Clean Architecture** (Capas aisladas).

```text
backend/
├── prisma/               # Definición ORM (schema.prisma) y migraciones
├── src/
│   ├── app.ts            # Entrypoint de configuración Express
│   ├── server.ts         # Arranque de servidor HTTP
│   ├── config/           # Configuraciones (DB, env, logger)
│   ├── controllers/      # Lógica HTTP (Req, Res) por entidad
│   ├── middlewares/      # Interceptores (Auth, RBAC, Error Handler)
│   ├── repositories/     # Capa abstracción Base de Datos (Prisma)
│   ├── routes/           # Asignación de Endpoints HTTP
│   ├── services/         # Lógica de Negocio (Reglas ERP)
│   ├── system/           # ⚠️ MÓDULOS SAAS (Global, Staff, Billing, Audit)
│   └── utils/            # Helpers de apoyo
```

## 3. ESTRUCTURA DE FRONTEND (`/frontend/src`)
El frontend utiliza Vite, React 18, y TailwindCSS.
Patrón: **Smart/Dumb Components & Compound Layouts**.

```text
frontend/
├── src/
│   ├── components/       # Componentes aislados (forms, UI, cash, tables)
│   ├── config/           # Configs estáticas (Menús)
│   ├── contexts/         # React Context (Auth, Theme)
│   ├── layouts/          # Envolturas de vistas (DashboardLayout)
│   ├── pages/            # Vistas ERP core (Products, POS, Sales)
│   ├── routes/           # Routing Router DOM (AppRoutes.tsx)
│   ├── services/         # Peticiones Axios segmentadas por módulos
│   ├── styles/           # CSS Index (Tailwind)
│   ├── system/           # ⚠️ INTERFAZ STAFF SAAS EXCLUSIVA
│   │   ├── layout/       # Layout propio de sistema global
│   │   ├── pages/        # Dashboard Staff, Logs, Billing
│   │   └── services/     # Axios calls del SaaS
│   └── utils/            # Utilidades generales (cn.ts)
```

## 4. PATRONES CRÍTICOS IMPLEMENTADOS
1. **Repository Pattern**: Desacopla Prisma de los servicios. Todo SQL asiste desde repeticiones unificadas (e.g. `businessId` autoinyectado).
2. **Row-Level Logic Isolation**: Multi-tenancy estructurado sobre una sola base de datos (PostgreSQL), donde `businessId` hace las veces de "Tenant discriminator" en cada fila transaccional.
3. **Split Routing**: `/api/v1/...` atiende usuarios limitados, mientras `/api/v1/system/...` invoca rutas libres de límites físicos de inquilinato.
4. **JWT Authentication & RBAC**: Tokens de Sesión e intercepción Middleware donde el nivel Admin SaaS no compite con el Role Permiso operativo normal.
