# PRESUERP - AI DEVELOPMENT KIT: DEPLOYMENT & PRODUCTION INFRASTRUCTURE

Este documento proporciona la especificación técnica y de desarrollo oficial para el **Despliegue, Infraestructura y Producción** de **PresuERP**, detallando los entornos de ejecución, las variables de entorno de backend y frontend, el pipeline de actualización de la base de datos PostgreSQL mediante Prisma ORM, y las políticas de seguridad.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

Este manual detalla los lineamientos para transferir PresuERP desde entornos locales de desarrollo hacia infraestructura productiva de alta disponibilidad.
*   **Arquitectura Desacoplada**: El backend Node.js transaccional y el cliente frontend React/Vite operan de forma autónoma.
*   **Aislamiento y Monitoreo**: Controlar la estabilidad física del servidor y garantizar actualizaciones de base de datos sin tiempos de inactividad indeseados.

---

## 2. ARQUITECTURA FISICA DE PRODUCCIÓN

```
                  [ Cliente Frontend React SPA ]
                (Alojado en CDN o Storage estático)
                                │
                                ▼
                      [ HTTPS / JSON API ]
                                │
                                ▼
                       [ Nginx Reverse Proxy ]
                   (Mapeo de CORS y Terminación SSL)
                                │
                                ▼
                     [ Backend API Node.js ]
                     (Express Server en puerto)
                                │
                                ▼
                    [ Prisma Client Query ]
                                │
                                ▼
                    [ PostgreSQL Database ]
```

---

## 3. VARIABLES DE ENTORNO REQUERIDAS

Tanto el servidor de backend como el cliente de frontend se configuran dinámicamente mediante variables de entorno persistidas en archivos `.env` (excluídos del repositorio por seguridad en `.gitignore`).

### Variables de Backend (`erp/backend/.env`)
*   `NODE_ENV`: Contexto de ejecución (`'production'`, `'development'`).
*   `PORT`: Puerto de escucha local (ej. `8080`).
*   `DATABASE_URL`: Cadena de conexión cifrada (PostgreSQL con SSL).
*   `JWT_SECRET` / `JWT_REFRESH_SECRET`: Semillas criptográficas de firma.
*   `JWT_EXPIRES_IN`: Periodo del access token (ej. `'15m'`).
*   `JWT_REFRESH_EXPIRES_IN`: Periodo del refresh token (ej. `'7d'`).

### Variables de Frontend (`erp/frontend/.env`)
*   `VITE_API_URL`: Dirección HTTP base del backend (ej. `https://api.presuerp.com/api/v1`).
*   `VITE_APP_NAME`: Título visible en cabeceras client (ej. `PresuERP`).

---

## 4. PIPELINE DE ACTUALIZACIONES EN BASE DE DATOS (MIGRATIONS)

Para garantizar la no pérdida de transacciones y datos históricos de tickets comerciales de los inquilinos, se prohíbe correr comandos interactivos de desarrollo en producción.

### Proceso de Despliegue en Base de Datos:
1.  **Generación de Migraciones (Desarrollo)**:
    ```bash
    npx prisma migrate dev --name denominacion_cambio
    ```
2.  **Despliegue de Código (Producción/Staging)**:
    Al arrancar la rutina CI/CD o contenedor, se ejecuta el comando no interactivo de despliegue:
    ```bash
    npx prisma migrate deploy
    ```
    *   *Nota operativa:* Este comando aplica secuencialmente los scripts SQL pendientes en la carpeta `prisma/migrations` sin remover colecciones ni solicitar confirmaciones.

---

## 5. CAPTURA DE ESTABILIDAD OPERATIVA (HEALTH CHECK)

*   **Endpoint Health**: Exposición del ruteador global (GET `/api/v1/health`) para ser consumido por balanceadores o bots de monitoreo de red.
```typescript
// Lógica real de enrutamiento en src/routes/index.ts:
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});
```

---

## 6. OBSERVACIONES TÉCNICAS Y CHECKLIST DE SEGURIDAD

### Checklist de Producción:
- [ ] **Desactivación de Logs de Consultas**: Reducir el nivel de logs de Prisma para omitir volcado de payloads con datos de clientes en logs.
- [ ] **Configuración Segura de CORS**: Cambiar la apertura de CORS en backend para aceptar exclusivamente el origen del subdominio del frontend productivo, mitigando inyecciones externas de APIs.
- [ ] **Terminación SSL (HTTPS)**: La API y Cookies en `/auth/refresh` requieren la configuración de cookies seguras con HTTPS y flags `secure: true` para anular la interceptación por parte de terceros.
- [ ] **Manejo de Object Storage**: Configurar CDNs o buckets seguros para almacenar los PDFs de facturación fiscal y remitos de mercadería emitidos.
- [ ] **Auditoría de Acciones**: Asegurar que las trazas críticas como inicios de sesión inyecten la IP real de cliente usando proxies transparentes (`trust proxy` habilitado en Express).
- [ ] **Backups Automatizados**: Configurar backups automáticos diarios de la base de datos PostgreSQL con retención mínima de 30 días.
- [ ] **CI/CD Simplificado**: Los scripts automatizados de staging y deploy ejecutan `npm test` antes de disparar la puesta en producción.
- [ ] **Rollback Rápido**: Mantener copias de versionado de contenedores del backend para volver a la versión estable de inmediato ante fallas operativas de Staging.
