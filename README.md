# ERP Comercial - Base Multitenant (SaaS)

Estructura fundacional y diseño arquitectónico para un sistema ERP de grado comercial, multiempresa y altamente escalable.

---

## 🛠️ Tecnologías y Herramientas

### Frontend
- **React 18** + **Vite** + **TypeScript**
- **TailwindCSS** (Estilos fluidos, Soporte nativo para Tema Oscuro / Claro)
- **React Router Dom v6** (Layouts anidados, rutas públicas / protegidas)
- **TanStack Query (React Query) v5** (Manejo de estado de servidor / API)
- **Axios** (Interceptores automáticos para inyección JWT y mecanismo de Auto-Refresh con Cookies HTTP-only)
- **React Hook Form** + **Zod** (Validación de esquema y formularios tipados)
- **Lucide React** (Paquete de iconos premium)

### Backend
- **Node.js** + **Express** + **TypeScript**
- **Prisma ORM** + **PostgreSQL**
- **Helmet** & **Cors** (Seguridad de headers y restricción de orígenes)
- **Winston** (Logger profesional segmentado por consola y archivos locales)
- **Bcryptjs** (Cifrado de contraseñas)
- **JSON Web Tokens (JWT)** (Tokens de acceso de vida corta y refresco seguro)
- **Express Rate Limit** (Prevención de denegación de servicio y ataques de fuerza bruta)

---

## 📂 Estructura del Proyecto

El monorepo está dividido en dos grandes secciones ubicadas bajo la carpeta raíz `erp/`:

```
erp/
├── backend/          # Capa de API en NodeJS con Clean Architecture
│   ├── prisma/       # Modelo de base de datos relacional PostgreSQL
│   └── src/
│       ├── config/   # Definiciones de Winston, Prisma y Zod Env
│       ├── routes/   # Enrutadores Express (Auth, Módulos)
│       └── ...
└── frontend/         # SPA cliente en React y Vite
    ├── src/
    │   ├── components/ # Reutilizables (forms, ui, tables)
    │   ├── contexts/   # Proveedores globales (Auth, Theme)
    │   ├── pages/      # Vistas (Dashboard, Login, Ajustes, Perfil)
    │   └── ...
```

---

## 🚀 Instalación y Desarrollo Local

### 1. Prerrequisitos
- Node.js (v18 o superior)
- npm / yarn
- Instancia activa de PostgreSQL

### 2. Configurar Variables de Entorno

#### Backend
Crea el archivo `.env` en la raíz de la carpeta `backend/` basándote en la plantilla:
```bash
cp backend/.env.example backend/.env
```
Asegúrate de ajustar `DATABASE_URL` con tus credenciales de PostgreSQL.

---

### 3. Instalación de dependencias
Puedes instalar todas las dependencias del frontend y el backend de forma simultánea desde el directorio raíz ejecutando:
```bash
npm install
npm run install:all
```

---

### 4. Base de datos (Prisma Migrations)
Para generar el cliente de Prisma y ejecutar las tablas iniciales en tu base de datos PostgreSQL, navega hacia la carpeta `backend/` y ejecuta:
```bash
npm run prisma:generate
# Crea y aplica la base de datos relacional
npx prisma db push
```

---

### 5. Iniciar Servidores de Desarrollo
Para arrancar el frontend (`localhost:5173`) y el backend (`localhost:5000`) de manera concurrente con un único comando, ejecuta en el directorio raíz:
```bash
npm run dev
```

---

## 🔐 Convención Multi-tenant (Aislamiento de Datos)
El sistema ha sido estructurado desde el día 1 para actuar como una plataforma SaaS:
1. **Regla de Oro**: Ningún endpoint puede realizar un `find`, `update` o `delete` sobre entidades de base de datos sin incluir el filtro `businessId`.
2. **Obtención de Datos**: El `businessId` se lee directamente del token JWT decodificado en la cabecera `Authorization` gracias al middleware `requireAuth`.
3. **Registro Corporativo**: Al registrar una nueva empresa mediante `/api/v1/auth/register`, el sistema inicializa transaccionalmente la empresa en la BD, genera los roles fundamentales (`Administrator`, `Supervisor`, `Cajero`, `Empleado`), asocia la matriz de permisos y crea el usuario gerente de manera completamente segura.
# PresuERP
