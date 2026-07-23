# PRESUERP - AI DEVELOPMENT KIT: API CONVENTIONS & CONTRACTS

Este documento proporciona la especificación técnica y de desarrollo oficial de las **Convenciones de API (API Conventions)** de **PresuERP**, detallando los patrones de direccionamiento REST, los códigos de estado HTTP estándar, y la estructura uniforme de solicitudes y respuestas del servidor Express.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

PresuERP interactúa de forma distribuida.
*   **Contratos Semánticos**: Homogeneizar cómo el frontend React y la API Express se comunican a través de payloads JSON, mitigando las fallas de integración y acelerando los desarrollos concurrentes.
*   **Seguridad y Multi-Tenant**: Configurar la interceptación de variables para que el backend aísle datos por negocio (`businessId`) sin exigir parámetros manuales al cliente de frontend.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El ciclo de una llamada REST Express obedece al siguiente protocolo de comunicación HTTP:

```
                  [ Cliente React Frontend ]
                               │
                       ( HTTP POST / GET )
                               │
                               ▼
                   [ Express Route Handler ]
         (Valida cabeceras, Zod schemas y JWT)
                               │
                               ▼
                 [ Controlador / Service layer ]
                               │
                       ( Retorno JSON )
                               │
                               ▼
      [ Respuesta Uniforme: success true / false ]
```

---

## 3. RUTEADOR Y DIRECCIONAMIENTO REST COMPACTO (ENDPOINT ROADS)

Las rutas Express aplican el prefijo de versión obligatorio `/api/v1` y estructuran recursos en plural:
*   `GET /api/v1/products`: Recupera el catálogo de artículos paginado y filtrado de la empresa.
*   `POST /api/v1/products`: Registra una nueva existencia de mercadería.
*   `PUT /api/v1/products/:id`: Actualiza datos descriptivos de un ítem de catálogo.
*   `POST /api/v1/purchases/:id/approve`: Dispara la transición atómica a aprobado.

---

## 4. CÓDIGOS DE RESPUESTA SEMÁNTICOS (HTTP STATUS CODES)

El backend Express de PresuERP responde de forma estricta los siguientes estados HTTP para facilitar la interpretación de estados en el frontend React:
*   **`200 OK`**: Petición de lectura exitosa.
*   **`201 Created`**: Inserción exitosa de entidad en base de datos.
*   **`400 Bad Request`**: Datos corruptos o fallas en el esquema Zod (`VALIDATION_ERROR`).
*   **`401 Unauthorized`**: Sesión inexistente, token JWT expirado o mal firmado.
*   **`403 Forbidden`**: El usuario autenticado carece de los subpermisos RBAC requeridos.
*   **`404 Not Found`**: El registro solicitado no existe en el tenant (`businessId`).
*   **`409 Conflict`**: Violación de clave única (ej: SKU duplicado del inquilino, `BUSINESS_CONFLICT`).
*   **`500 Internal Server`**: Excepción imprevista capturada por el middleware de error Express.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en los endpoints de la API para evitar roturas en la integración con el frontend.
2.  **No Enviar IDs de Tenant en Payload**: Para anular accesos cruzados ilegales, el frontend React omite enviar la clave `businessId` en el Request body o Query string en peticiones de escritura. El backend inyecta programáticamente este parámetro extrayéndolo directamente del JWT decodificado en `req.user.businessId`, bloqueando cualquier manipulación maliciosa de clientes comprometidos.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
