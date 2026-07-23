# PRESUERP - AI DEVELOPMENT KIT: API REFERENCE

Este documento sirve como la referencia técnica oficial de la API de **PresuERP**, detallando los contratos HTTP, payloads JSON, métodos expuestos y los sistemas de seguridad aplicados en el backend.

---

## 1. INTRODUCCIÓN GENERAL

La API de PresuERP está diseñada como una interfaz RESTful desacoplada para dar soporte en tiempo real a clientes SPA de frontend y aplicaciones móviles.
*   **Protocolo**: HTTPS sobre JSON.
*   **Prefijo base**: `/api/v1`
*   **Aislamiento**: Multi-tenant lógico mediante mapeo por inquilino.
*   **Trazabilidad**: Integrado con auditoría nativa en logs de actividad (`ActivityLog`).

```
[ Cliente Frontend React / Dispositivo Móvil ]
                      │
            HTTPS Request + JWT Header
                      │
                      ▼
            [ API Gateway Router ]
                      │
           Auth & Validation Verification
                      │
                      ▼
            [ Controladores Express ]
```

---

## 2. ARQUITECTURA GENERAL E INFRAESTRUCTURA DE APIS

### Estructura de Respuestas Estándar
Toda respuesta de la API REST implementa una estructura fija para garantizar la consistencia en el tratamiento del cliente.

#### Respuestas Exitosas (HTTP 200 / 201)
```json
{
  "success": true,
  "data": {
    "id": "e3b4a209-...",
    "createdAt": "2026-07-14T19:00:00Z"
  }
}
```

#### Respuestas de Error del Sistema (HTTP 4xx / 500)
```json
{
  "status": "error",
  "message": "Descripción detallada del error lógico del negocio"
}
```

---

## 3. MECANISMO DE AUTENTICACIÓN Y MULTI-TENANCY

### Ciclo de Autenticación
*   **Access Token (JWT)**: Corto plazo (15 minutos) enviado en la cabecera `Authorization: Bearer <token_jwt>`. Contiene la información segura decodificada de permisos y pertenencia a la empresa.
*   **Refresh Token**: Largo plazo (7 días) almacenado en base de datos. Se utiliza en el interceptor Axios enviándolo automáticamente en cookies HttpOnly para recargar sesiones sin interrumpir la operación del cliente.
*   **Bypass de Permisos**: Si el operador cuenta con la cadena `'Administrator'` en su propiedad de rol, se omite el chequeo de strings y se concede acceso por defecto a nivel de middleware.

### Inyección Transparente de Tenant
*   El frontend omitirá siempre el envío del parámetro `businessId` para mitigar inyecciones de datos inter-inquilino.
*   El backend recupera de forma exclusiva el `businessId` de la firma decodificada del JWT inyectándolo directamente a las consultas base en base de datos:
```typescript
// Lógica interna del middleware requireAuth:
req.user = {
  id: decoded.userId,
  businessId: decoded.businessId,
  role: decoded.role,
  permissions: decoded.permissions
};
```

---

## 4. APIS DE AUTENTICACIÓN (`/api/v1/auth`)

### 1. Iniciar Sesión (POST `/api/v1/auth/login`)
*   **Acceso**: Público.
*   **Payload**:
```json
{
  "email": "cajero@empresa.com",
  "password": "claveseguracajero"
}
```
*   **Respuestas**:
    *   **HTTP 200**: Sesión creada con éxito. Retorna los tokens y el snapshot de visualización.
    *   **HTTP 401**: Credenciales inválidas.

### 2. Refrescar Sesión (POST `/api/v1/auth/refresh`)
*   **Acceso**: Público (lee cookie HttpOnly).
*   **Respuesta (HTTP 200)**: Retorna el nuevo access token temporal de corta duración.

---

## 5. APIS DE PRODUCTOS Y CATÁLOGO (`/api/v1/products`)

### 3. Listar Catálogo (GET `/api/v1/products`)
*   **Acceso**: Privado (requiere token JWT con permiso `products:read`).
*   **Respuesta (HTTP 200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "p3b4c109-...",
      "name": "Arroz 1kg",
      "sku": "ARR-1KG",
      "barcode": "7791234567890",
      "purchasePrice": 80.00,
      "salePrice": 104.00,
      "profitMargin": 30.00,
      "status": "ACTIVE",
      "category": { "id": "cat-...", "name": "Almacén" },
      "supplier": { "id": "sup-...", "name": "Distribuidora Mayorista" }
    }
  ]
}
```

### 4. Crear Producto (POST `/api/v1/products`)
*   **Acceso**: Privado (permiso `products:create`).
*   **Payload**:
```json
{
  "name": "Arroz 1kg",
  "sku": "ARR-1KG",
  "barcode": "7791234567890",
  "categoryId": "c1...",
  "supplierId": "s7...",
  "purchasePrice": 80.00,
  "profitMargin": 30.00
}
```
*   **Respuesta (HTTP 201)**: Retorna el producto con su `salePrice` recalculado automáticamente.

### 5. Actualizar Producto (PUT `/api/v1/products/:id`)
*   **Acceso**: Privado (permiso `products:update`).
*   *Restricción:* Requiere inyectar obligatoriamente la justificación del cambio:
```json
{
  "name": "Arroz 1kg Premium",
  "changeReason": "Modificación de descripción del producto"
}
```

---

## 6. APIS DE COMPRAS DE MERCADERÍAS (`/api/v1/purchases`)

### 6. Instanciar Compra (POST `/api/v1/purchases`)
*   **Acceso**: Privado (permiso `purchases:create`).
*   **Payload (JSON)**:
```json
{
  "supplierId": "s7...",
  "warehouseId": "w3...",
  "purchaseNumber": "CMP-1025",
  "documentType": "FACTURA",
  "purchaseDate": "2026-07-14T00:00:00Z",
  "hasInvoiceTaxes": true,
  "vatRate": 21.00,
  "otherTaxes": "[{\"type\":\"PERCENTAGE\",\"name\":\"IIBB\",\"value\":1.5}]",
  "items": [
    {
      "productId": "p3...",
      "quantity": 50,
      "unitCost": 80.00,
      "discount": 0
    }
  ]
}
```
*   **Respuesta (HTTP 201)**: Crea el pedido persistido exclusivamente bajo estado `'DRAFT'`.

### 7. Aprobar Compra (POST `/api/v1/purchases/:id/approve`)
*   **Acceso**: Privado (permiso `purchases:approve`).
*   **Objetivo**: Cierra e impacta inmediatamente el inventario. Suma unidades al stock físico del depósito logístico, inicia asientos inmutables ENTRY en Kardex y actualiza los precios en el catálogo.

### 8. Cancelar Compra (POST `/api/v1/purchases/:id/cancel`)
*   **Acceso**: Privado (permiso `purchases:cancel`).
*   **Objetivo**: Fuerza retroversiones de existencias asociando registros de egreso complementarios si ya constaba como aprobada.

---

## 7. APIS COMPLEMENTARIAS Y RUTAS PENDIENTES o INACTIVAS

### 9. Ventas Rápidas (POST `/api/v1/sales`)
*   **Estado**: **Parcial**.
*   **Operabilidad**: Recibe cantidades y ejecuta egresos de inventario en el depósito e inserta en el Kardex. Sin embargo, no persiste facturaciones contables ni de control en las tablas relacionales de la base de datos `Sale` y `SaleItem`.

### 10. Módulo de Marcas (INACTIVO)
*   **Descripción**: La ruta física `/brands` de `brand.routes.ts` **se encuentra inactiva** al omitirse su declaración en el mapeador global de Express `src/routes/index.ts`. No es accesible y arrojará HTTP 404 a pesar de conservar clases y controladores vivos en carpetas y base de datos relacionales lógicas.
