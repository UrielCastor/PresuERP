# PRESUERP - AI DEVELOPMENT KIT: OFFICIAL CODEBASE INDEX

Este documento proporciona el **Índice Oficial de la Base de Código (Codebase Index)** del repositorio de **PresuERP**, detallando la estructura de carpetas de backend y frontend, las responsabilidades de cada capa, las convenciones de archivos de código TypeScript, y la guía para extensiones funcionales sin degradación arquitectónica.

---

## 1. ESTRUCTURA CONSOLIDADA DEL REPOSITORIO (MONOREPO)

El proyecto PresuERP está estructurado como un monorepo ordenado:

```
PresuERP/
├── erp/
│   ├── backend/      # Servidor API REST Node.js estructurado en Clean Architecture
│   │   ├── prisma/   # Definición física schema.prisma y migraciones SQL
│   │   └── src/      # Código fuente del Servidor
│   └── frontend/     # Cliente React SPA en TypeScript empaquetado con Vite
│       └── src/      # Código de Interfaz de Usuario
└── docs/             # AI Development Kit de documentación técnica
```

---

## 2. ESTRUCTURA Y RESPONSABILIDADES DEL BACKEND (`erp/backend/src/`)

El servidor Express implementa Clean Architecture dividiendo clases TypeScript por su rol de abstracción lógico:

### Carpetas Internas:
*   `config/`: Inicializadores y tipados de Variables de Entorno (`env.ts`), mitigando fallos por variables vacías.
*   `controllers/`: Clases de control Express (ej. `product.controller.ts`). Reciben requests, extraen parámetros, delegan la lógica a los Services y retornan la respuesta HTTP, sin consultas directas de Prisma.
*   `services/`: Clases lógicas de negocio corporativo (ej. `purchase.service.ts`). Validan reglas y coordinan de manera transaccional (`$transaction`) mutaciones sobre diferentes tablas.
*   `repositories/`: Clases relacionales de persistencia PostgreSQL (ej. `user.repository.ts`). Es la única capa autorizada a invocar al cliente Prisma. Permite adjuntar instancias transaccionales `tx`/`prisma`.
*   `middlewares/`: Interceptores transversales de ruteo (`auth.middleware.ts`, `error.middleware.ts`).
*   `validators/`: Esquemas de validaciones estructurados en Zod (`product.validator.ts`, `purchase.validator.ts`).
*   `routes/`: Ruteador centralizado (`index.ts`) que mapea accesos, validadores de body y privilegios RBAC antes de dar paso al controlador.

---

## 3. ESTRUCTURA Y RESPONSABILIDADES DEL FRONTEND (`erp/frontend/src/`)

El cliente React SPA orquesta componentes visuales responsive reutilizando capas funcionales:

### Carpetas Internas:
*   `components/`: Componentes atómicos de UI (`Button.tsx`, `Input.tsx`, `Modal.tsx`, `Table.tsx`). Queda excluida la invocación de llamadas Axios en esta carpeta.
*   `pages/`: Pantallas ruteadas del ERP (ej: `Purchases.tsx`, `Products.tsx`, `Settings.tsx`).
*   `layouts/`: Paneles estructurales y responsivos (`DashboardLayout.tsx` mapeando barras responsive).
*   `contexts/`: Gobernanza del estado global mediante React Context API (`AuthContext.tsx` y `AppearanceContext.tsx`).
*   `routes/`: Enrutamiento protegido (`AppRoutes.tsx` inyectando guards de RBAC).
*   `services/`: Instancia Axios unificada (`api.ts`) que inyecta tokens JWT y controla el loop de Refresh Token recursivo para errores 401. Contiene los ficheros de consumo de API (ej. `purchase.service.ts`).

---

## 4. CONVENCIONES DE NOMENCLATURA Y ESCRITURA REAL

Todo código fuente de PresuERP respeta la siguiente semántica:
1.  **TypeScript Exclusivo**: No se codifican lógicas en extensiones `.js` o `.jsx`. Todo archivo posee estrictamente la extensión `.ts` (para lógica, servicios y repositorios) o `.tsx` (para layouts, componentes y vistas React).
2.  **Naming PascalCase**: Obligatorio en todos los componentes React y páginas del frontend (ej: `DataTable.tsx`, `DashboardLayout.tsx`).
3.  **Naming camelCase**: Obligatorio para variables de entorno de base de datos relacionales, métodos de servicios y nombres de archivos de clases del backend (ej: `purchase.service.ts`, `approvePurchase()`).
4.  **Permisos con `:`**: Los códigos del RBAC inyectan strings relacionales separados por dos puntos (ej. `users:read`, `purchases:approve`).

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **Inmutabilidad de Base**: La base relacional protege el catálogo y existencias históricas mediante políticas `Restrict` en base de datos.
3.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
