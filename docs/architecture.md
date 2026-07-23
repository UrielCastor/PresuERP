# Arquitectura del Sistema ERP (SaaS Multiempresa)

Este documento describe la arquitectura y pila tecnológica del ERP Web corporativo.

---

## 1. Diseño Arquitectónico (Clean Architecture)

El backend está estructurado siguiendo principios de **Clean Architecture** y arquitectura por capas para garantizar escalabilidad, pruebas unitarias sencillas y desacoplamiento de la infraestructura:

```
src/
├── config/         # Configuraciones globales (DB, Logger, Variables de Entorno)
├── controllers/    # Controladores Express (Mapeo de HTTP a Casos de Uso/Servicios)
├── middlewares/    # Validaciones, Autenticación JWT, Rate Limiting y Control de Errores
├── routes/         # Definición de Endpoints y Asociación de Middlewares
├── repositories/   # Capa de Acceso a Datos (Repository Pattern con Prisma ORM)
├── services/       # Lógica del Negocio (Service Layer centralizando reglas operativas)
├── validators/     # Esquemas de validación de datos usando Zod
├── types/          # Extensiones de Tipos Globales (ej. Express.Request)
└── utils/          # Clases y Funciones de utilidad (ej. AppError)
```

---

## 2. Estrategia Multiempresa (Multi-tenancy)

El aislamiento de datos es un requerimiento crítico en sistemas de Software como Servicio (SaaS). El sistema implementa una base de datos única con aislamiento lógico:

- **Estructura Dinámica**: Todas las entidades de negocio (usuarios, productos, ventas, etc.) contienen una clave foránea `businessId` que apunta a la tabla `businesses`.
- **Filtro Obligatorio**: Los repositorios y consultas de base de datos requieren explícitamente el parámetro `businessId` obtenido del token JWT del usuario autenticado.
- **Seguridad en Rutas**: El middleware de seguridad valida y decodifica el `businessId` en cada llamada. Nunca se confía en parámetros provistos directamente por la URL del cliente para identificar la empresa emisora.

---

## 3. Seguridad de Datos

Se aplican convenciones modernas de seguridad integradas a nivel de infraestructura:

1. **HelmetJS**: Configura cabeceras HTTP seguras para mitigar ataques como Clickjacking, Script Injection, etc.
2. **CORS Limitado**: Solo se permiten solicitudes desde el origen corporativo configurado en variables de entorno.
3. **Control de Intentos (Rate Limit)**: Protección activa contra ataques de fuerza bruta en endpoints críticos (Autenticación y Registro).
4. **Cifrado Fuerte**: Claves secreta variables y hashing de contraseñas mediante **bcryptjs** de 10 rondas de salting.

---

## 4. Frontend Estructurado (React - Tailwind)

El frontend está optimizado para flujos escalables y controlados:
- **Gestión de Estado**: Coordinado localmente mediante Context Providers (`AuthContext`, `ThemeContext`) y llamadas cacheadas mediante **TanStack Query** (React Query).
- **Consumo de API**: Interceptores de Axios administran la inyección automatizada de tokens JWT y manejan el flujo silencioso de refresco (`refresh_token`) mediante cookies HTTP-Only de manera transparente al usuario.
- **Formularios robustos**: Validaciones al vuelo del lado del cliente vía **React Hook Form** + **Zod**.
- **Alineación Visual**: Maquetación adaptativa, moderna y fluida configurada íntegramente mediante clases de utilidad **Tailwind CSS**.
