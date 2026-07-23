# PRESUERP - AI DEVELOPMENT KIT: MULTI-TENANCY SYSTEM

Este documento detalla la especificación oficial y el funcionamiento del **Sistema Multi-Tenant** de **PresuERP**, describiendo la estrategia de segregación física de datos en base de datos PostgreSQL, la inyección del contexto del inquilino desde JWT, y las capas de validación del lado del servidor para garantizar el aislamiento.

---

## 1. INTRODUCCIÓN GENERAL Y PRINCIPIO MÁSTER

PresuERP opera bajo una arquitectura SaaS (Software as a Service) multi-tenant lógica. Múltiples inquilinos (empresas independientes) consumen la misma API y comparten la base de datos física PostgreSQL, pero manteniéndose lógicamente aislados de forma estricta.

### Regla Máster de Aislamiento
Bajo ninguna circunstancia un inquilino (Empresa A) puede visualizar, modificar, crear o eliminar datos pertenecientes a otro inquilino (Empresa B). El cruce de información interceptado representa un fallo de seguridad crítico e inmediato en la infraestructura del ERP.

```
                    [ API Request: POST /products ]
                                  │
                       No businessId in Payload
                                  │
                                  ▼
                    [ Decodificación JWT en Backend ]
                     req.user.businessId = 'biz_A'
                                  │
                                  ▼
                    [ Inyección en Prisma Query ]
             prisma.product.create({ businessId: 'biz_A' })
```

---

## 2. MODELADO FÍSICO DEL INQUILINO (TENANT) EN BASE DE DATOS

El inquilino principal está representado por el modelo `Business` en `schema.prisma`.

### Modelo `Business` (Físico postgres: `businesses`)
*   **Campos**:
    *   `id`: String (PK, UUID).
    *   `name`: String comercial de la empresa.
    *   `taxId`: String único (representa identificación impositiva, RFC/CUIT/RUT).
    *   `email`, `phone`, `address`: String opcionales.
    *   `isActive`: Boolean (Default: `true`).
*   **Particularidad Detectada**: El estado activo de la empresa se mapea mediante el flag booleano `isActive`. Si `isActive = false`, el acceso del inquilino y de todos sus operarios colaboradores es revocado de forma inmediata en el flujo de autenticación.

### Entidades Aisladas (Multi-Tenant Relacional)
Toda tabla de catálogo o transaccional posee la columna `businessId` vinculada por clave foránea en cascada contra `Business.id`:
*   **Catálogo**: `products`, `categories`, `suppliers`, `brands`, `price_lists`, `price_list_items`.
*   **Logística**: `warehouses`, `stocks`, `stock_movements`, `warehouse_transfers`, `warehouse_transfer_items`, `inventories`, `inventory_items`.
*   **Transaccional**: `purchases`, `purchase_items`, `sales`, `sale_items`, `sale_payments`, `cash_sessions`, `cash_movements`.
*   **Seguridad**: `users`, `roles`, `refresh_tokens`, `activity_logs` (logs de auditoría).

---

## 3. AISLAMIENTO LÓGICO DESDE JWT Y SEGURIDAD HTTP

### Inyección de businessId Transparente (Regla Crítica)
El cliente frontend **nunca** debe incluir la propiedad `businessId` dentro de los payloads JSON enviados a la API (ejemplo: al crear productos en `POST /api/v1/products`).
*   **Implementación del Controlador**: El controlador recibe de forma limpia el payload del cliente, extrae el token decodificado de `req.user` e inyecta la variable en el cuerpo antes de transferir a la capa de servicios:
```typescript
// Controlador real de Producto:
export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.user.businessId; // Inyección desde token JWT verificado
    const product = await productService.create({
      ...req.body,
      businessId
    });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};
```

---

## 4. FILTRADO OBLIGATORIO EN LA CAPA DE DATOS (REPOSITORIES)

Toda consulta e interacción con la base de datos PostgreSQL debe incluir el parámetro de inquilino `businessId` para bloquear accesos directos indeseados.

### 1. Búsquedas Filtradas
```typescript
// Código real en ProductRepository:
async findById(id: string, businessId: string) {
  return prisma.product.findFirst({
    where: {
      id,
      businessId // Restricción mandate
    }
  });
}
```
*   *Nota analizada:* Se evita el uso de `prisma.product.findUnique` al buscar por id simple, reemplazándose sistemáticamente por `prisma.product.findFirst` especificando el parámetro compuesto `{ id, businessId }` para salvaguardar el aislamiento de inquilinos.

### 2. Modificaciones Aisladas (Updates e Impresiones)
Para actualizar u operar registros, la base exige coincidencia del identificador más el tenant:
```typescript
async update(id: string, businessId: string, data: any) {
  return prisma.product.updateMany({
    where: {
      id,
      businessId // Restringe cruces accidentales
    },
    data
  });
}
```

---

## 5. ROLES Y CONFIGURACIÓN SEGREGADA POR TENANT

*   **Autonomía Operativa**: Cada empresa posee la potestad de crear sus propios depósitos (`warehouses`), pool de marcas y proveedores logísticos.
*   **Roles Independientes**: Las entidades vinculadas en la tabla `Role` pertenecen a inquilinos específicos a través de `businessId`. Un rol supervisor de la Empresa A no puede editarse, leerse ni asignarse sobre el personal empleado de la Empresa B.

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Eliminación Física en Cascada (`onDelete: Cascade`)**: En `schema.prisma`, las relaciones de configuración del tenant (`POSSettings`, `FiscalSettings`, `PrintSettings`) y las entidades de datos (`products`, `warehouses`, `purchases`, `users`, `roles`) están vinculadas con la directiva `onDelete: Cascade` asociada a `Business`. Esto implica que si un operador con privilegios elimina un registro en la tabla `Business`, el ORM de Prisma desencadenará automáticamente la remoción física total e irreversible de todas las transacciones históricas, stocks y cuentas del inquilino, requiriendo copias y resguardos constantes.
2.  **Validación de Existencia a Nivel de Repositorio**: El sistema confía en la decodificación de `req.user.businessId` provisto por el middleware `requireAuth`. Es crítico robustecer el backend verificando si el UUID de la empresa inyectado persiste en base de datos con el flag `isActive = true` en cada request transaccional crítica para evitar accesos con firmas desactualizadas.
