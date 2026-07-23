# PRESUERP - AI DEVELOPMENT KIT: FILE STORAGE ENGINE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Motor de Almacenamiento de Archivos (File Storage Engine)** de **PresuERP**, detallando los esquemas de subida física, persistencia local y almacenamiento en la nube (Object Storage), nomenclatura e infraestructura de seguridad.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

PresuERP requiere persistir activos binarios (logos empresariales configurados en `print_settings`, PDFs de comprobantes de remitos fiscales, imágenes de ítems de catálogo).
*   **Abstracción de Storage**: La capa de subida de archivos se estructura mediante un patrón adapter, abstrayendo si la persistencia física ocurre localmente en disco o en un bucket compatible con AWS S3.
*   **Seguridad y Multi-Tenant**: Validar y segregar el acceso físico a los comprobantes de modo que solo usuarios autorizados del inquilino propietario puedan descargarlos.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El procesamiento de archivos binarios incoming sigue esta estructura de middlewares:

```
[ POST /api/v1/uploads / Form Multipart ]
                     │
                     ▼
             [ UploadMiddleware ]
   (Valida tamaño máximo: 2MB y MIME type)
                     │
                     ▼
             [ StorageProvider ]
     (Local disk o AWS S3 Object Upload)
                     │
                     ▼
        [ Retorna URL e indexa en DB ]
```

---

## 3. ESPECIFICACIÓN TÉCNICA DEL ALMACENAMIENTO (ADAPTER SYSTEM)

### 1. Proveedor Local Disk (Fases iniciales / Staging)
*   **Ruta**: Persistencia bajo la carpeta `erp/backend/public/uploads/{businessId}/`.
*   **Separación Directa**: La segmentación por el UUID de la empresa (`businessId`) garantiza que los binarios físicos queden estructutados y segregados a nivel de sistema de archivos (OS filesystem).

### 2. Proveedor Cloud Object Storage (Producción / S3 Compatible)
*   **Integración**: Integrado utilizando `@aws-sdk/client-s3`.
*   **Configuración**: Las variables del bucket (`S3_BUCKET_NAME`, `S3_ENDPOINT`) se inyectan en el `.env`.
*   **Nomenclatura Estándar de Archivos**: Los archivos se renombran antes de subirse para evitar colisiones aplicando la convención:
    $$\text{Ruta del Componente} = \text{businessId}/\{\text{modulo}\}/\{\text{timestamp}\}\_\{\text{hash}\}.\{\text{ext}\}$$

---

## 4. MIDDLEWARE DE SUBIDA DE MULTER

*   Se configura **Multer** en el backend para bloquear de forma inmediata subidas de archivos que superen los 2MB de peso.
*   **Filtro de Extensiones (MIME whitelist)**: Se restringe la subida únicamente a imágenes de catálogo formateadas (`image/jpeg`, `image/png`, `image/webp`) y documentos de facturación estrictos (`application/pdf`). Cualquier archivo ejecutable o comprimido (.exe, .zip) es rechazado en capa de Express.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en las rutas de subida para evitar que activos pertenecientes a un negocio terminen alojados bajo el identificador de otra cuenta en el Storage.
2.  **Exposición de URLs Públicas vs Privadas**: Los PDF de facturas no deben quedar en buckets de S3 con acceso de visualización libre de lectura global (`public-read`). Se exige configurar el bucket en modo privado y resolver las descargas del frontend React solicitando a la API de Express la generación de URLs firmadas temporales con expiración de 15 minutos (`getSignedUrl`).
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
