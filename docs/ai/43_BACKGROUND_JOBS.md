# PRESUERP - AI DEVELOPMENT KIT: BACKGROUND JOBS SPECIFICATION

Este documento proporciona la especificación técnica y de desarrollo oficial de las **Tareas Programadas y Procesos en Segundo Plano (Background Jobs)** de **PresuERP**, detallando los motores sugeridos para automatización de tareas y rutinas recurrentes de limpieza preventiva del motor de base de datos relacionales PostgreSQL.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

PresuERP requiere automatizar tareas accesorias de administración y mantenimiento preventivo que no deben saturar los hilos de atención HTTP Express.
*   **Limpieza de Base de Datos**: Eliminar o archivar trazas obsoletas de tokens de refresco revocados.
*   **Auditoría de Insumos**: Escanear de forma diaria los balances de mercaderías para disparar reportes consolidados a supervisores.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

Las tareas programadas corren de forma asíncrona desacopladas del ruteador de Express:

```
                  [ Servidor backend levantado ]
                               │
                               ▼
                [ Cron Scheduler / BullMQ ] (Node-Cron)
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     [ Job: Purge ]     [ Job: Alert ]     [ Job: Report ]
   (Limpia DB tokens   (Escanea existencias (Agrupa ventas
    vencidos en base)    y emite emails)     y exporta CSV)
```

---

## 3. ESPECIFICACIÓN DE JOBS DEL SISTEMA

Se estructuran las siguientes rutinas de mantenimiento asíncronas:

### 1. Purga de Tokens Revocados (`jwt:clean`)
*   **Frecuencia**: Ejecución diaria a las 03:00 AM.
*   **Propósito**: Realiza borrados físicos de filas en la tabla `RefreshToken` que superen los 7 días de cese de sesión u obsolescencia, impidiendo que la base de datos acumule millones de filas inactivas de sesiones expiradas:
```typescript
// Lógica de purga masiva en base de datos:
const cleanExpiredTokens = async () => {
  await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  });
};
```

### 2. Generador de Alertas de Abastecimiento (`stock:alert`)
*   **Frecuencia**: Ejecución diaria a las 08:00 AM.
*   **Propósito**: Agrega e identifica todos los registros en `stocks` donde la cantidad consolidada sea menor o igual al `minimumStock`, despachando correos masivos vía Nodemailer a los directores de compra del tenant (`businessId`).

---

## 4. INTEGRACIÓN DE INFRAESTRUCTURA DE AUTOMATIZACIÓN

*   **Entornos Monolíticos / Inicio**: Se instrumenta mediante **node-cron** o librerías de temporización livianas embebidas dentro de Express.
*   **Entornos de Alta Disponibilidad**: Para despliegues horizontales multi-nodo, se descarta el uso de temporizadores embebidos nativos (que duplicarían la ejecución de las tareas en cada instancia). Se prescribe delegar la orquestación a una cola Redis con **BullMQ** ejecutando procesos en un hilo worker exclusivo de fondo.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en los jobs para evitar alertar cruces de stock entre diferentes empresas instaladas.
2.  **Locks de Lectura por Jobs Masivos**: La agregación analítica de inventarios pesados puede asfixiar a PostgreSQL. Se exige incorporar la cláusula de paginación o filtrado rápido, impidiendo escaneos continuos sobre la tabla total de `stock_movements`.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
