# PRESUERP - AI DEVELOPMENT KIT: PRODUCTION RELEASE ENGINE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Proceso de Despliegue en Producción (Release Process)** de **PresuERP**, detallando los lineamientos de migraciones estructuradas en base de datos, respaldos de contingencia, y verificación post-deploy en entornos productivos.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El despliegue de una nueva versión de PresuERP debe realizarse reduciendo a cero el downtime operativo del mostrador POS de los clientes.
*   **Seguridad de Despliegue**: Minimizar interrupciones del servicio mediante flujos disciplinados de verificación.
*   **Integridad de Datos**: Garantizar que las modificaciones del esquema Prisma relacional (`schema.prisma`) cuenten con respaldos previos a su inyección sobre la base de producción.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El ciclo de despliegue automatizado compila y sube el backend y frontend en fases aisladas:

```
[ Git Master Branch / CI Tag ]
             │
             ▼
[ FASE I: Respaldos de Postgres ] (pg_dump automático)
             │
             ▼
[ FASE II: Migración Prisma ] (prisma migrate deploy)
             │
             ▼
[ FASE III: Compilación e Inyección ]
(Build backend Express & compilar frontend React SPA)
             │
             ▼
[ FASE IV: Verificación Endpoints ] (Healthcheck loop)
```

---

## 3. PROTOCOLO DE MIGRACIÓN ACORAZADO DE BASE DE DATOS

Antes de alterar el motor productivo de PostgreSQL en la nube, se ejecutan de forma obligante los siguientes pasos:

### 1. Copia de Seguridad Preventiva (Postgres Backup)
*   **Comando**: Se despacha la extracción de la estructura mediante utilidades de PostgreSQL como `pg_dump`:
```bash
pg_dump -U username -h hostname -d database_name -F c -b -v -f backup-before-v1.2.0.dump
```

### 2. Despliegue de Migraciones Prisma
*   **Herramienta**: Se prohíbe el uso de `prisma db push` en entornos productivos ya que esto puede conllevar a pérdida accidental de columnas o truncado de tablas críticas. Se exige estrictamente el uso del compilador de migraciones:
```bash
npx prisma migrate deploy
```
*   *Nota operativa:* Esta directiva lee de forma secuencial los archivos SQL migrados en la carpeta `prisma/migrations/`, aplicando los diferenciales de forma transaccional y bloqueando tablas sólo durante fracciones de segundo.

---

## 4. COMPILACIÓN DE APLICATIVOS (BUILD & DIST)

### 1. Compilación del Backend Express
Se transpila el código de TypeScript a Javascript puro indexado cargando dependencias optimizadas de producción:
```bash
npm run build
npm prune --production
```

### 2. Compilación del Frontend React SPA
Se empaqueta el cliente SPA usando Vite, inyectando variables mediante prefijos unificados:
```bash
npm run build
```
Vite genera la carpeta física estática `dist/` que puede entregarse vía CDN o servidores estáticos acelerados (Nginx / S3 Static Web).

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en los servidores productivos para evitar fallas graves por fallos de variables de entorno de base de datos relacionales PostgreSQL en producción.
2.  **Validaciones Post-Despliegue (Smoke Testing)**: Finalizado el deploy, se realiza un chequeo básico automatizado monitoreando endpoints de salud (`GET /api/v1/health`) y verificando en logs Express que no existan excepciones imprevistas, mitigando fallas ocultas antes del ingreso de los usuarios.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
