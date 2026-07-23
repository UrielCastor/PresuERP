# PRESUERP - AI DEVELOPMENT KIT: CONFIGURATION MODULE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Módulo de Configuración Empresarial (Settings)** de **PresuERP**, detallando los modelos relacionales PostgreSQL, las cabeceras de visualización y numeración, el aislamiento multi-tenant y los endpoints de API backend.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El módulo **Settings** centraliza la personalización y gobierno de preferencias comerciales, monetarias y fiscales de cada inquilino en PresuERP.
*   **Aislamiento**: Las preferencias se guardan de forma exclusiva para el tenant autenticado (`businessId`), impidiendo el cruzamiento de políticas comerciales de caja entre diferentes organizaciones del SaaS.
*   **Soporte Multiformato**: Provee la parametrización física para la generación de facturas, tickets de mostrador y PDFs.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

```
[ GET /settings ] OR [ PUT /settings/* ]
                        │
                        ▼
               [ SettingsController ]
       (Valida estructuras y cuerpo JSON)
                        │
                        ▼
                [ SettingsService ]
      (Valida el businessId inyectado en JWT)
                        │
                        ▼
               [ SettingsRepository ]
       (Sentencia Prisma: insert / update a db)
```

---

## 3. MODELADO DE DATOS (EN PRISMA)

El esquema de configuraciones se compone de tres tablas de base de datos vinculadas físicamente en PostgreSQL vía `schema.prisma`:

### Model `POSSettings` (Físico postgres: `pos_settings`)
*   **Estructura**:
```prisma
model POSSettings {
  id              String   @id @default(uuid())
  businessId      String   @unique
  business        Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  allowOutOfStock Boolean  @default(false)
  defaultTaxRate  Decimal  @default(21.00) @db.Decimal(5, 2)
  allowDiscount   Boolean  @default(true)
  maxDiscountRate Decimal  @default(10.00) @db.Decimal(5, 2)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("pos_settings")
}
```

### Model `FiscalSettings` (Físico postgres: `fiscal_settings`)
```prisma
model FiscalSettings {
  id             String   @id @default(uuid())
  businessId     String   @unique
  business       Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  taxCondition   String   // 'RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO'
  taxId          String   // CUIT/RFC
  legalName      String
  invoicePrefix  String   @default("0001")
  lastInvoiceNum Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("fiscal_settings")
}
```

### Model `PrintSettings` (Físico postgres: `print_settings`)
```prisma
model PrintSettings {
  id          String   @id @default(uuid())
  businessId  String   @unique
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  ticketWidth String   @default("80mm") // '80mm', '58mm', 'A4'
  headerText  String?
  footerText  String?
  showLogo    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("print_settings")
}
```

---

## 4. SISTEMA DE PERMISOS Y AUTORIZACIÓN (RBAC)

*   **Restricción de Acceso**: La lectura y edición del módulo está vedada a perfiles operativos simples (ej: Cajoneros o Vendedores). Exige de forma excluyente la validación en backend del permiso `'settings:write'` o el bypass concedido al rol `'Administrator'` del tenant:
```typescript
// Aplicación en Express:
router.put('/company', requirePermission('settings:write'), settingsController.updateCompanySettings);
router.put('/pos', requirePermission('settings:write'), settingsController.updatePOSSettings);
```

---

## 5. AUDITORÍA Y TRAZABILIDAD (ACTIVITY LOGS)

Toda modificación de parámetros inserta un registro inmutable en `activity_logs`:
*   *Actualizar Datos Fiscales*: `action: 'CONFIG_TAX_UPDATED'`.
*   *Modificar Preferencias POS*: `action: 'CONFIG_INVENTORY_UPDATED'`.
*   *Modificar Texto de Implicaciones*: `action: 'CONFIG_DOCUMENT_UPDATED'`.
*   *Inyección de Datos*: El payload almacena en campos `previousValues` y `newValues` las copias estructuradas en string de los parámetros alterados.

---

## 6. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en nuevas consultas Prisma para evitar interrupciones de base.
2.  **Locks de Configuración en Cascadas**: El modelo vincula las preferencias en cascada externa (`onDelete: Cascade`) contra `Business`. Si se elimina la cabecera el motor limpia todas las preferencias físicas de inmediato.
3.  **Numeradores Sincronizados**: La columna `lastInvoiceNum` en `fiscal_settings` es autoincremental por software en el backend. Cuando el volumen comercial del tenant escala velozmente, ráfagas concurrentes de facturas pueden colisionar si no se instrumentan transacciones Prisma atómicas con cierres de fila (`SELECT ... FOR UPDATE`) sobre la terna de base.
