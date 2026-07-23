# PRESUERP - AI DEVELOPMENT KIT: BACKEND SERVICES LAYER

Este documento proporciona la especificación técnica y de desarrollo oficial de la **Capa de Servicios de Backend (Backend Services)** de **PresuERP**, detallando los patrones de inyección transaccional, el tratamiento de excepciones de dominio de negocio, el aislamiento multi-tenant obligatorio y la orquestación relacional con Prisma ORM.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

La **Capa de Servicios** es el núcleo intelectual de PresuERP. Su objetivo es encapsular todas las reglas operativas, de costeo, validaciones cruzadas e impactos fiscales del software.
*   **Separación Estricta**: Los controladores Express no contienen consultas Prisma, lógica matemática ni validaciones fiscales complejas.
*   **Encapsulado del Framework**: Los servicios no reciben objetos del protocolo HTTP (`Request` o `Response`) ni tokens JWT en crudo. Operan a través de parámetros tipados e inyecciones limpias de contexto de usuario.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El ciclo de ejecución transaccional en backend sigue la siguiente jerarquía de Clean Architecture:

```
[ Express Route ] ──> requireAuth & Validadores (Body Zod)
                            │
                            ▼
                    [ Controller Class ]
          (Extrae req.params, body y req.user context)
                            │
                            ▼
                     [ Service Class ] (TypeScript)
      (Aplica fórmulas, orquesta transacciones y auditoría)
                            │
                            ▼
              [ Repository / Prisma Client ]
             (Ejecuta persistencia en Postgres)
```

---

## 3. GOBERNANZA MULTI-TENANT E INYECCIÓN DE ENTIDADES

### El Aislamiento por `businessId`
Todos los servicios del backend exigen la inyección del parámetro `businessId` como argumento de control obligatorio. Ningún servicio asume de forma local o automática a qué tenant pertenece la ejecución, anulando cross-tenant relacionales accidentales.

```typescript
// Firma estricta de creación en el backend real:
async createProduct(data: CreateProductDTO, businessId: string): Promise<Product> {
  const existing = await this.productRepo.findBySku(data.sku, businessId);
  if (existing) throw new ConflictError('SKU already exists');
  // ...
}
```

---

## 4. ORQUESTACIÓN TRANSACCIONAL INMUTABLE (PRISMA TRANSACTION)

Las operaciones críticas (ej. aprobación fiscal de compras, salidas por ventas rápidas) se ejecutan de manera atómica envolviéndose en transacciones nativas de Prisma:

```typescript
// Lógica de aprobación transaccional en PurchaseService:
return prisma.$transaction(async (tx) => {
  // 1. Modificar cabecera de la compra a APPROVED
  const purchase = await tx.purchase.update({ ... });

  // 2. Recorrer ítems, actualizar existencia y registrar Kardex
  for (const item of purchase.items) {
    await this.stockMovementService.registerMovement({
      productId: item.productId,
      warehouseId: purchase.warehouseId,
      movementType: 'ENTRY',
      quantity: item.quantity,
      // ...
    }, tx); // Inyección de instancia transaccional 'tx'
  }
});
```
*   *Nota operativa:* El envío del cliente transaccional `tx` como argumento opcional en los repositorios permite sincronizar y concatenar múltiples incidencias operativas bajo un mismo cierre de bloque, forzando un rollback automático total al toparse con excepciones imprevistas en base de datos.

---

## 5. CAPTURA Y METRADOS DE AUDITORÍA (ACTIVITY LOGS)

*   **Lógica Centralizada**: Todos los servicios de mutación de negocio acoplan llamadas al módulo `ActivityLogRepository` para inyectar trazas inmutables en la tabla `activity_logs`.
*   **Persistencia Estructurada**: Se recuperan los snapshots pre-operación y post-operación mapeándolos a strings JSON independientes (`previousValues`, `newValues`) para asegurar la trazabilidad retrospectiva de importes, precios y accesos.

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Diferencia de Identificadores (Multi-Tenant)**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **Locks de Fila Concurrentes**: El uso del pool de transacciones `$transaction` sobre productos muy vendidos (caja) bloquea momentáneamente filas sobre la tabla `stocks` por concurrencia. Es mandatorio optimizar la consulta para no saturar las conexiones de base de datos relacionales PostgreSQL en producción.
3.  **Bypass de Administradores**: El middleware de Express `requirePermission` verifica el rol inyectado. El backend otorga bypass automático a `'Administrator'`, mitigando chequeos a nivel de base.
