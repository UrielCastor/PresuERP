# PRESUERP - AI DEVELOPMENT KIT: BACKEND VALIDATOR MODULE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Sistema de Validaciones** de **PresuERP**, detallando los esquemas Zod en TypeScript, el middleware capturador de esquemas Express, y la normalización JSON de errores de validación.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **Validators** interintercepta todas las llamadas HTTP que alimentan los controladores de backend en PresuERP.
*   **Contratos Firmes**: Garantiza que toda estructura de datos, cuerpos JSON, parámetros de URL (`req.params`) y queries de paginación (`req.query`) se ajusten estrictamente al tipado esperado en base de datos.
*   **Separación de Responsabilidades**: Las capas internas de negocio (Servicios y Repositorios) asumen que los argumentos de entrada son estructuralmente lícitos, delegando la verificación de tipos de datos única y exclusivamente a los validadores Zod.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El ciclo de validación de datos opera de manera centralizada en el cargador middleware de Express:

```
[ Petición HTTP POST / PUT ]
             │
             ▼
[ Route Handler: validate(Schema) ]
             │
             ├──────────────────────────┐
             ▼                          ▼
      ( Datos Válidos )          ( Datos Corruptos )
             │                          │
             ▼                          ▼
   [ Controller / Service ]     [ Error Middleware ]
                               (HTTP 400 Bad Request)
```

---

## 3. TECNOLOGÍA CONTRATADA Y ESQUEMAS ZOD

PresuERP utiliza **Zod** nativo para modelar los esquemas de filtrado.

### Esquemas Genéricos Comunes
*   **UUID Validation**: Utiliza `z.string().uuid()` para verificar IDs relacionales en base de datos (`productId`, `warehouseId`, `userId`, `businessId`).
*   **Pagination Validation**: El query parsea y normaliza valores opcionales de listados masivos:
```typescript
export const paginationQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? Math.max(1, parseInt(val, 10)) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)
});
```

---

## 4. MODELOS DE VALIDACIÓN MODULARES EN BACKEND

Los esquemas de validación se estructuran de forma modular en `erp/backend/src/validators/` (o dentro de submódulos dedicados):

### 1. `auth.validator.ts`
*   *Login Schema*: Exige `email` en formato string con regla de formato correo electrónico (`z.string().email()`) y `password` con un mínimo de 6 caracteres.

### 2. `product.validator.ts`
*   *Create Schema*: Valida obligatoriamente `name`, `sku` (cadena limpia sin caracteres prohibidos), `purchasePrice` y `salePrice` representados como números positivos o cero (`z.number().min(0)`).

### 3. `purchase.validator.ts`
*   *Create Schema*: Estructura compleja que requiere `supplierId` (UUID), `warehouseId` (UUID), `status` (opcionalmente parametrizado) y la matriz estructurada `items`:
```typescript
export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    unitCost: z.number().min(0),
    discount: z.number().min(0).max(100).default(0)
  })).min(1, 'Purchase must have at least one item')
});
```

---

## 5. CAPTURA Y RESPUESTA SEMÁNTICA DE VALIDACIÓN INAPROPIADA

Cuando una validación falla a nivel de middleware, el Handler captura la excepción formateando un objeto JSON unificado con código de estado HTTP 400 (Bad Request):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos de entrada incorrectos",
    "details": [
      {
        "field": "items[0].quantity",
        "message": "Number must be greater than 0"
      }
    ]
  }
}
```

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **No Mezclar Reglas de Negocio en Esquemas Zod**: Los validadores de esquemas Zod no consultan bases de datos relacionales para chequear existencias u holguras de stock. Esa regla comparativa reside estrictamente en `StockService.checkAvailability`, evitando acoplar lógica cambiante al ruteador de Express.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
