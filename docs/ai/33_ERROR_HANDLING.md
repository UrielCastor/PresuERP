# PRESUERP - AI DEVELOPMENT KIT: ERROR HANDLING SYSTEM

Este documento proporciona la especificación técnica y de desarrollo oficial del **Sistema de Manejo de Errores (Error Handling)** de **PresuERP**, detallando los códigos de error del dominio, los interceptores de errores del motor de base de datos relacionales Prisma, y el formato unificado de respuestas JSON del servidor Express.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El sistema de tratamiento de excepciones en PresuERP persigue dos metas principales:
*   **Seguridad**: Evitar el volcado accidental de variables del servidor, consultas SQL o trazas de pila (stack traces) en las respuestas HTTP a los clientes.
*   **Consistencia de API**: Unificar todas las respuestas anómalas (validación, base de datos, negocio) bajo un único contrato estructural de JSON legible para el frontend React.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El ciclo de resolución de excepciones fluye de manera ascendente hacia el middleware Express global:

```
[ Error en Repository / Service ] ──> Lanza Excepción Específica (Zod / Custom Error)
                                            │
                                            ▼
                               [ Controller block: catch ]
                                            │
                                            ▼
                                [ next(error) a Express ]
                                            │
                                            ▼
                                [ errorHandler Middleware ]
                       (Mapea el error al JSON final y status HTTP)
```

---

## 3. FORMATO UNIFICADO DE RESPUESTA DE ERROR (RESPONSE CONTRACT)

Todas las peticiones fallidas devuelven la estructura JSON de error uniforme con estado de código correspondiente (HTTP 4xx o 500):

```json
{
  "success": false,
  "error": {
    "code": "STOCK_NOT_AVAILABLE",
    "message": "La cantidad solicitada supera el stock físico disponible en el depósito.",
    "details": []
  }
}
```

### Códigos de Error Definidos en Dominio:
1.  `VALIDATION_ERROR` (HTTP 400): Estructura incorrecta capturada por Zod.
2.  `UNAUTHORIZED` (HTTP 401): JWT vencido, ausente o mal firmado.
3.  `FORBIDDEN` (HTTP 403): Fallo de privilegios en el middleware RBAC.
4.  `NOT_FOUND` (HTTP 404): Entidad inexistente identificada en base de datos.
5.  `BUSINESS_CONFLICT` (HTTP 409): SKU duplicado, proveedor bloqueado o coincidencia fiscal.
6.  `INTERNAL_SERVER_ERROR` (HTTP 500): Excepciones no controladas del compilador Node.js.

---

## 4. INTERCEPTACIÓN DE EXCEPCIONES PRISMA ORM

El interceptor robusto en `error.middleware.ts` analiza las firmas lanzadas por Prisma Client para transformarlas en excepciones controladas:
*   **Prisma Client Error `P2002`**: Violación de clave única. El middleware inspecta el arreglo de campos (`meta.target`) y responde un JSON estructurado con código `BUSINESS_CONFLICT` y el campo causante.
*   **Prisma Client Error `P2025`**: Registro no encontrado al mutar. Responde un código `NOT_FOUND` de inmediato.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en las excepciones mapeadas para evitar desvíos semánticos.
2.  **Tratamiento de Excepciones del POS (Ventas)**: Dado el estado parcial del POS, las fallas por items inexistentes o faltantes de stock al confirmarse un ticket de salida rápido deben controlarse a nivel transaccional y traducirse a errores locales de existencia antes de afectar el conteo en base.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
