# PRESUERP - AI DEVELOPMENT KIT: AUDIT & LOGGING SYSTEM

Este documento proporciona la especificación técnica y de desarrollo oficial del **Sistema de Auditoría y Logs (Audit & Logging System)** de **PresuERP**, detallando el modelo de datos relacionales para activity logs, la diferenciación con logs financieros, y la arquitectura de inmutabilidad en base de datos.
---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

PresuERP asume la inmutabilidad absoluta de sus logs como un principio ético y de calidad de software comercial.
*   **Seguimiento Completo**: Cada mutación sensible sobre el sistema escribe una traza que expone quién ejecutó la acción, cuándo y qué valores específicos cambiaron.
*   **Tratamiento de Secretos**: Los campos sensibles como contraseñas (`password`) o llaves criptográficas se omiten de la serialización JSON del log para evitar filtrados involuntarios.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El registro de logs está integrado en la capa transaccional del backend Express:

```
[ Operación iniciada en Controller / Service ]
                       │
                       ▼
       [ Mutation db (Prisma Update/Create) ]
                       │
                       ▼
          [ Captura de Estados en DB ]
   (Compara registro antes y después del cambio)
                       │
                       ▼
     [ ActivityLogRepository.log (Inmutable) ]
   (Inserta en la tabla physics 'activity_logs')
```

---

## 3. MODELADO DE DATOS (EN PRISMA)

El log relacional se almacena físicamente bajo la tabla PostgreSQL unificada en `schema.prisma`:

### Model `ActivityLog` (Físico postgres: `activity_logs`)
```prisma
model ActivityLog {
  id             String   @id @default(uuid())
  action         String   // 'USER_CREATED', 'PURCHASE_APPROVED', 'STOCK_ADJUSTED'
  module         String   // 'auth', 'users', 'products', 'purchases', 'stock'
  userId         String?
  user           User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  businessId     String
  business       Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  ipAddress      String?
  userAgent      String?
  previousValues String?  // Serialización JSON de los valores antes de la mutación
  newValues      String?  // Serialización JSON de los valores resultantes
  createdAt      DateTime @default(now())

  @@index([businessId, createdAt])
  @@map("activity_logs")
}
```

---

## 4. DIFERENCIACIÓN E INMUTABILIDAD STRICT

*   **Logs del Negocio (`activity_logs`)**: Capturan la pista de auditoría operativa ("*El Administrador cambió el precio de venta de Monitor Samsung de 100 a 120*"). La tabla carece de endpoints Express de edición (`PUT`/`DELETE`), y ante despidos reales la clave foránea `userId` pasa a `SetNull`, resguardando el registro bajo un campo de usuario anónimo en lugar de borrar la fila física.
*   **Balances Financieros (Kardex / `stock_movements`)**: El Kardex no es un mero log de auditoría. Es la traza fiscal de la mercadería. Opera acoplado de forma matemática al stock físico. A diferencia del activity log que es informativo, el Kardex se ejecuta dentro del bloque `$transaction` asumiendo las mismas restricciones de reversión en caso de error.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en los logs para evitar mezclar auditorías entre empresas.
2.  **Volumen y Purga Dinámica**: Las tablas `activity_logs` y `stock_movements` crecen de forma masiva en producción. Se aconseja restringir búsquedas con selectores de fecha en los reportes analíticos e instrumentar rutinas de purga o archiving a base de datos de almacenamiento frío (Cold Storage) de forma externa, previniendo cuellos de botella por exceso de índices en PostgreSQL.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
