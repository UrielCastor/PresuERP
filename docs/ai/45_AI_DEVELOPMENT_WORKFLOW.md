# PRESUERP - AI DEVELOPMENT KIT: AI DEVELOPMENT OPERATIONAL WORKFLOW

Este documento proporciona el **Manual Operativo de Desarrollo para Agentes de IA (AI Development Workflow)** de **PresuERP**, detallando los pasos disciplinarios mandatorios para analizar la arquitectura, planificar la escritura de código en TypeScript y verificar regresiones funcionales antes de proponer cambios al usuario.

---

## 1. MÁXIMOS OPERATIVOS DEL AGENTE DE IA (CRITICAL GENERAL RULES)

Como agente inteligente de codificación avanzada, debes operar en este repositorio adhiriéndote rigurosamente a las siguientes reglas inalterables:

### 1. El Principio de No Destrucción
*   Queda expresamente prohibido reescribir o eliminar archivos operativos del backend o frontend que estén funcionando de manera lícita para "simplificar" implementaciones.
*   Toda extensión funcional debe acoplarse respetando las convenciones tipadas ya presentes en el proyecto (TypeScript `.ts`/`.tsx`).

### 2. Acorazamiento Transaccional y de Inquilinos
*   Cualquier código SQL o consulta de Prisma propuesta debe validar por defecto la inyección del campo `businessId` para conservar la consistencia multiempresa.

---

## 2. ARQUITECTURA DE TRABAJO EN TRES CAPAS (PIPELINE AI)

El flujo de trabajo que toda IA debe transitar antes de reportar la finalización de una tarea sigue esta secuencia:

```
[ Solicitud de Cambio del Usuario ]
                 │
                 ▼
[ FASE I: Lectura y Análisis (Read-first) ]
(Consumir esquema prisma y docs/ai/* correspondientes)
                 │
                 ▼
[ FASE II: Elaboración de Implementación ]
(Escribir código desacoplado respetando capas y tipos)
                 │
                 ▼
[ FASE III: Verificación y Pruebas (Test-first) ]
(Correr compilador TypeScript y tests unitarios locales)
```

---

## 3. CHECKLIST OPERATIVO DE DESARROLLO

Antes de proponer una modificación o crear nuevos archivos, la IA debe marcar como resueltos los siguientes puntos:

*   [ ] **Acceso a la Persistencia**: ¿La consulta interactúa con base de datos a través de la capa `Repositories` sin invocar clientes directamente desde `Controllers`?
*   [ ] **Inyección de Transacciones**: En operaciones de inventario, stock y facturación, ¿se pasa el argumento opcional `tx` para correr dentro de bloques `$transaction`?
*   [ ] **Verificación de Multi-Tenant**: ¿La query de base de datos incorpora la clásula `where: { businessId }`?
*   [ ] **Validadores con Zod**: ¿Se definieron y acoplaron validadores de payloads en Express para interceptar inputs antes de dar acceso al controlador?
*   [ ] **Tipado TypeScript**: ¿Se definieron las interfaces y firmas requeridas previniendo el uso del tipo genérico escape `any`?

---

## 4. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en ninguna nueva clase TypeScript para evitar colisiones de compilación.
2.  **No Modificar Tablas Base Innecesariamente**: Alterar `schema.prisma` genera migraciones de base de datos Postgres que pueden congelar entornos locales. Se prohíbe realizar modificaciones físicas sobre campos de la base sin documentar previamente el plan e impacto operacional al usuario.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
5.  **Detección de Deuda Técnica**: Durante la extensión del POS, la IA debe ser consciente de que las tablas de ventas rápidas (`sales`/`sale_items`) carecen de persistencia física total. Cualquier aporte en este módulo debe alinear la persistencia hacia el repositorio local con consistencia atómica antes de notificar éxito.
