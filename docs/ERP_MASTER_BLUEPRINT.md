# ERP MASTER BLUEPRINT — LA CONSTITUCIÓN DEL SISTEMA
**Código de Identificación:** ERP-MB-2026-V1.0  
**Fecha de Publicación:** 12 de Julio, 2026  
**Status:** Aprobado para Guía de Desarrollo  

---

## 1. VISIÓN GENERAL

### Objetivo del ERP
El objetivo central de **PresuERP** es proporcionar una solución integral, SaaS (Software as a Service) multi-tenant de alto rendimiento y arquitectura limpia, diseñada específicamente para comercios, cadenas de distribución y puntos de venta minoristas/mayoristas. El sistema asegura aislamiento de datos con parametrizaciones flexibles por sucursal, listas de precios avanzadas y control financiero estricto.

### Tipo de Empresas Soportadas
- **Comercios Minoristas (Retail)**: Minimercados, tiendas de indumentaria, ferreterías, librerías.
- **Distribuidores Mayoristas**: Empresas con venta al por mayor por bulto, listas de precios segmentadas por volumen de compra y manejo de cuentas corrientes de clientes.
- **Cadenas Multi-Sucursal**: Franquicias o comercios con múltiples locales físicos que coordinan despachos y transferencias desde centros de distribución compartidos.

### Escenarios Operativos Soportados
1.  **Ventas Rápidas Offline/Online (POS)**: Checkout continuo en mostrador con lectores de códigos de barra y arqueos de caja rápidos.
2.  **Abastecimiento e Importación**: Emisión de órdenes de compra, control logístico y reclamos de mercadería en base a recepciones parciales.
3.  **Logística en Tránsito**: Transferencias lógicas y físicas de productos entre almacenes de diferentes ciudades.

### Limitaciones Conocidas y Mitigaciones
- *Limitación*: Latencia en conexiones móviles de cajeros remotos.
  - *Mitigación*: Implementación en el POS de bases de datos locales indexadas en caché de navegación del lado cliente para búsquedas de stock y SKU offline temporales.
- *Limitación*: Concurrencia masiva en cotizaciones y transacciones impositivas de cierre.
  - *Mitigación*: Base de datos particionada lógicamente mediante claves indexadas combinadas en base a `businessId` y colas de persistencia no bloqueantes en el servidor.

### Arquitectura General y Relación entre Módulos
El sistema sigue principios de **Clean Architecture** (Capas independientes) garantizando el desacoplamiento entre el núcleo administrativo y las tecnologías de terceros (Bases de datos, proveedores de correo, controladores de hardware de impresión).

```
   [ FRONTEND SPA (React) ] ── (Axios con Auto-refresh JWT) ──> [ API EXPRESS (NodeJS) ]
                                                                        │
        ┌───────────────────────────────────────────────────────────────┤
        │ (Controllers / Use Cases)                                     │ (Middlewares)
        ▼                                                               ▼
 [ Lógica de Módulos ] <──> [ Repositorios (Prisma Client) ] ──> [ Auth & RBAC Guard ]
        │
        ▼
 [ PostgreSQL DB ] (Ailsamiento estricto a través de filtros businessId locales)
```

---

## 2. TIPOS DE USUARIOS (RBAC COMPLETO)

### Tabla de Segmentación Operativa y Permisos

| Rol | Objetivo Principal | Dashboard Ideal | Menú Permitido | Reportes Habilitados |
| :--- | :--- | :--- | :--- | :--- |
| **Administrador** | Gestión de negocio, control de sucursales, facturación fiscal. | Telemetría financiera consolidada, gráficos anuales, alertas del sistema. | Acceso Completo (100% de opciones). | Auditorías forenses, IVA ventas, rentabilidad grupal. |
| **Supervisor** | Control de stocks, arqueos de caja, anulaciones POS. | Alertas de stock crítico, cajas abiertas de operarios, diferencias. | Productos, Stock, Depósitos, Cajas, Clientes, Compras. | Rotación de stocks, reportes de cajas de terceros. |
| **Cajero** | Checkout rápido, cobros divididos, apertura/cierre. | Estado de caja y saldo de efectivo actual, tickets facturados. | POS, Ventas de sucursal propia, Clientes (solo lectura). | Cierres de caja diarios y arqueos individuales. |
| **Vendedor** | Asistencia comercial, preventas. | Comisiones devengadas, histórico de facturas vendidas. | POS (Preventa), Clientes. | Ranking de ventas individuales. |
| **Dueño** | Supervisión global de ingresos y rentabilidades. | Gráficos de facturación mensual y márgenes por sucursal. | Visualización general (Lectura exclusiva). | Rentabilidades ponderadas, compras vs ventas globales. |
| **Contador** | Liquidaciones fiscales y conciliación contable. | Resumen de IVA devengado, series numeradas. | Ventas (Lectura), Compras (Lectura), Ajustes Fiscales (Lectura). | IVA Ventas, IVA Compras, Saldos de proveedores. |
| **Auditor** | Fiscalización interna y prevención de fraudes. | Logs de actividad inusual, diferencias en cierres de caja. | Auditoría global, ActivityLog (Lectura). | Trazabilidad de accesos e histórico forense de precios. |

### Acciones Exclusivas y Prohibidas por Rol

-   **Administrador**:
    *   *Acciones Permitidas*: Edición de CUIT, configurar regímenes impositivos, habilitar sucursales.
    *   *Acciones Prohibidas*: Eliminar registros con implicancias fiscales e históricos contables consolidados.
-   **Supervisor**:
    *   *Acciones Permitidas*: Corregir precios del POS, autorizar ventas a clientes morosos, validar diferencias menores en arqueo.
    *   *Acciones Prohibidas*: Modificar la matriz de permisos de seguridad de usuarios o alterar credenciales SMTP de la empresa.
-   **Cajero**:
    *   *Acciones Permitidas*: Insertar productos al carro, cobrar en efectivo, tarjeta o cuenta corriente, procesar cierres e imprimir tickets.
    *   *Acciones Prohibidas*: Anular facturas impresas o alterar stocks teóricos de productos sin auditorías concurrentes.
-   **Contador**:
    *   *Acciones Permitidas*: Descargar reportes consolidados en formato oficial Excel/PDF y verificar correlatividad.
    *   *Acciones Prohibidas*: Generar despachos de remitos de mercadería o procesar egresos de efectivo.

---

## 3. DISEÑO DE DASHBOARDS PERSONALIZADOS

### Dashboard: Administrador
-   **Indicadores Clave (KPIs)**:
    *   Venta Total Impositiva Mensual vs Periodo Anterior (con diferencial porcentual).
    *   Margen Bruto Ponderado sobre Ventas.
    *   Ingresos Totales por Método de Pago Agrupados.
-   **Widgets & Gráficos**:
    *   *Gráfico de Área*: Evolución diaria de facturación neta corporativa.
    *   *Gráfico de Rosca*: Ventas divididas por sucursales y depósitos físicos.
-   **Alertas**: Estado general de conexiones API y límites máximos acumulados de créditos de clientes morosos.
-   **Accesos Rápidos**: Crear nuevo usuario, Modificar impuestos, Configurar pasarelas de pago.

### Dashboard: Supervisor
-   **Indicadores Clave (KPIs)**:
    *   Cantidad de productos en quiebre de stock crítico.
    *   Total de transferencias lógicas pendientes de recibir.
    *   Cajas físicas activas sin arqueo formal de cierre.
-   **Widgets & Gráficos**:
    *   *Widget de Inventario*: Tabla ordenada de SKU más críticos y días estimados de cobertura.
    *   *Gráfico de Barras*: Diferencia detectada en cierres de cajas de operarios recientes.
-   **Accesos Rápidos**: Ingresar ajuste físico de inventario, Validar orden de compra, Confirmar transferencia.

### Dashboard: Cajero
-   **Indicadores Clave (KPIs)**:
    *   Saldo de efectivo exacto acumulado en el cajón de mostrador.
    *   Monto facturado en el turno activo.
    *   Tiempo operativo promedio transcurrido desde la apertura de caja.
-   **Widgets & Gráficos**:
    *   *Widget de Ventas Suspendidas*: Acceso instantáneo a carritos retenidos.
    *   *Indicador Visual*: Semáforo de estado de conexión local a impresoras y red interna.
-   **Accesos Rápidos**: Abrir/Cerrar Caja, Generar preventa externa, Cargar movimiento rápido de caja chica.

---

## 4. MAPA GENERAL DEL ERP

Siguiente mapa de integración de menús y flujos de dependencias jerárquicas:

```
[INICIO LOGIN] ──> [Comprobación de Rol / Roles Guardados]
                         │
                         ▼
┌────────────────── [DASHBOARD CENTRAL] ──────────────────┐
│                                                         │
├──> [CATÁLOGO] ─> [Productos] ─> [Categorías/Marcas]     │
│       │                                                 │
│       └──> [Listas de Precios] ──> (Sincronizan POS)    │
│                                                         │
├──> [OPERACIONES COMERCIALES]                            │
│       │                                                 │
│       ├──> [POS] ──> (Conserva ventas pendientes)       │
│       │     │                                           │
│       │     └──> [Cajas y Arqueos] ──> [Cierre Caja]    │
│       │                                                 │
│       └──> [Ventas/Remitos/Documentos Impositivos]      │
│                                                         │
├──> [ABASTECIMIENTO & LOGÍSTICA]                         │
│       │                                                 │
│       ├──> [Compras y Proveedores]                      │
│       │                                                 │
│       └──> [Depósitos] ─> [Stocks] ─> [Transferencias]  │
│                                                         │
└──> [PANEL CONTROL] ─> [Configuraciones] ─> [Auditorías] │
```

---

## 5. FLUJOS TRANSACCIONALES DETALLADOS

### Flujo: Venta y Facturación de Mostrador
1.  **Inicio**: El cliente presenta los artículos en mostrador o el cajero procesa una preventa previa.
2.  **Pasos**:
    1.  Cajero inicia la lectura por código de barras o búsqueda rápida alfanumérica.
    2.  Verifica stock disponible del depósito local asignado en la sesión de venta.
    3.  Aplica lista de precios definida del cliente seleccionado (ej. Lista VIP).
    4.  Carga descuentos permitidos según la matriz de rol.
    5.  Selecciona medios de cobro. Escribe el desglose proporcional.
    6.  Confirma la finalización.
3.  **Validaciones**:
    *   Validar existencia de sesión de caja activa del usuario correspondiente.
    *   Validar balance de venta contra suma de pagos.
4.  **Estados**: `BORRADOR` -> `CONFIRMADA` -> `FACTURADA` -> `PAGADA`.
5.  **Errores Posibles**:
    *   `ERR_INSUFFICIENT_STOCK`: Stock faltante para egreso físico.
    *   `ERR_ZERO_PAYMENT`: Intento de asentar cobros nulos.
6.  **Impacto**: Actualiza tablas de `Stock` y balances de `CashSession` e impacta en libros contables impositivos de IVA Ventas.

### Flujo: Compras y Abastecimiento de Depósito
1.  **Inicio**: Generación de una solicitud formal de mercaderías al proveedor.
2.  **Pasos**:
    1.  Creación de Orden de Compra (`Purchase` con estado `PENDING`).
    2.  Ingreso de los costos sugeridos y pactados de adquisición.
    3.  Al recibir el camión distribuidor con el remito, se cotejan cantidades ingresando los valores reales.
    4.  Asentamiento de la factura de compra emitida por el proveedor en el ERP.
    5.  Cierre de compra e imputación del pasivo comercial en la cuenta corriente del proveedor.
3.  **Validaciones**:
    *   No permitir duplicar un número de comprobante/factura para un mismo proveedor.
    *   Montos de detalle de impuestos exactos.
4.  **Estados**: `PENDING` -> `PARTIALLY_RECEIVED` -> `RECEIVED` o `CANCELLED`.
5.  **Impacto**: Aumento del stock de depósito activo, re-cálculo masivo opcional de costos de reposición y generación de deudas a pagar en tesorería.

---

## 6. MATRIZ DE ESTADOS POR MÓDULO

```
[Venta]
  BORRADOR ────────> PENDIENTE ────────> CONFIRMADA ────────> FACTURADA ────────> PAGADA (FINALIZADA)
                                              │                                      │
                                              └──> ANULADA <─────────────────────────┘

[Compra]
  PENDIENTE ────────> PARCIALMENTE RECIBIDA ────────> RECIBIDA (COMPLETA)
     │                                                   │
     └──> CANCELADA <────────────────────────────────────┘

[Transferencia de Stock]
  PENDIENTE ────────> EN TRÁNSITO ────────> RECIBIDA (CONFIRMADA)
     │                                         │
     └──> CANCELADA <──────────────────────────┘

[Sesión de Caja]
  ABIERTA ────────> CERRADA ────────> ARQUEADA (CONCILIADA)

[Auditoría de Ajustes / Inventario]
  PENDIENTE (DRAFT) ────────> EN PROCESIVO ────────> FINALIZADA (SUBMITTED)
     │
     └──> ANULADA
```

---

## 7. UX DEL SISTEMA (DISEÑO DE INTERFAZ Y NAVEGACIÓN)

-   **Navegación Eficiente (Teoría de 3 Clics)**:
    *   Ninguno de los flujos principales (Venta, Consulta de Stock, Cobro en Cuenta Corriente) debe requerir más de tres clics consecutivos del Mouse desde el Dashboard General.
-   **Configuración y Filtrado de Grillas**:
    *   Búsquedas dinámicas instantáneas con optimización Debounce de 300ms a nivel de backend.
    *   Persistencia del estado de los filtros de grilla seleccionados en LocalStorage, permitiendo al operador recargar la pantalla sin extraviar su contexto de análisis del día.
-   **Confirmaciones Críticas y Modales no Intrusivos**:
    *   Mensajes de alerta toast flotantes no bloqueantes para avisos ordinarios (ej. "Stock descontado").
    *   Modales de confirmación con doble validación visual para acciones destructivas e irrevocables (ej. Anular Facturas fiscales o Cancelar Órdenes de Compra consolidadas).

---

## 8. ESPECIFICACIÓN DETALLADA DEL POS (Terminal de Punto de Venta)

La pantalla del POS divide su interfaz visual en tres paneles estratégicos auto-ajustables conformando un diseño de alto rendimiento:

```
┌────────────────────────────────────────────────────────┬────────────────────────────────┐
│ PANEL IZQUIERDO: Búsqueda Rapida, Articulos Scaneados  │ PANEL DERECHO: Datos Fieles    │
│                                                        │                                 │
│ [ Barcode Input / Scanner Trigger ]                    │ [ Cliente Activo ]             │
│                                                        │ [ Cambiar Lista / Depósito ]   │
│ Cantidad | Descripción             | Subtotal          │                                 │
│ 1.000    | Remera Negra XL         | $45,000.00        │ [ Resumen Financiero ]         │
│ 2.000    | Media Deportiva         | $12,000.00        │ Subtotal:           $57,000    │
│                                                        │ Descuento:          -$5,000    │
│                                                        │ Total Venta:        $52,000    │
├────────────────────────────────────────────────────────┼────────────────────────────────┤
│ PANEL INFERIOR: Botones de Medios de Pago Rápidos      │ [BOTÓN ACCION COBRAR [F10]]     │
│ [Efectivo] [Débito] [Crédito] [QR Pago] [Cuenta Corr]  │                                 │
└────────────────────────────────────────────────────────┴────────────────────────────────┘
```

### Tabla de Atajos de Teclado del POS
| Tecla | Acción en POS |
| :--- | :--- |
| **F1** | Enfocar barra de búsqueda rápida de catálogo. |
| **F2** | Abrir modal de selección de cliente. |
| **F3** | Cambiar cantidad de unidades del producto activo seleccionado en la lista. |
| **F4** | Registrar descuento porcentual o directo. |
| **F6** | Modificar lista de precios activa aplicable al total. |
| **F7** | Abrir selector complejo de medios de cobro dividido (Pago Mixto). |
| **F8** | Suspender venta activa en marcha, despejando la pantalla. |
| **F9** | Generar presupuesto borrador imprimible. |
| **F10**| Confirmar cobro y disparar orden de impresión térmica. |
| **ESC**| Cancelar toda la operación en marcha, limpiando el carrito. |
| **ENTER**| Agregar artículo consultado al lote de venta. |

---

## 9. MODELADO DE MEDIOS DE PAGO Y FLUJOS FINANCIEROS

1.  **Efectivo (`CASH`)**:
    *   *Caja*: Suma directa de inmediato al saldo de la sesión activa de caja en el campo `cashTransactionsTotal`.
    *   *Tesorería*: Disponible líquido inmediato en el corte diario de arqueo físico.
2.  **Tarjeta de Débito/Crédito (`CARD`)**:
    *   *Caja*: No suma en el arqueo físico de efectivo directo, pero se lista en cierres para conciliación de tickets.
    *   *Finanzas*: Devenga comisiones calculadas y recargos programados. Los fondos ingresan netos restando la retención pactada transcurridos los días de `clearanceDays` preestablecidos.
3.  **Transferencia Bancaria (`TRANSFER`)**:
    *   *Auditoría*: Requiere la entrada manual obligatoria de la referencia de la operación bancaria inter-CBU.
4.  **Billeteras Digitales (Mercado Pago QR / Point / MODO)**:
    *   *Circuito*: La transacción queda atada a la notificación de aprobación digital remota del backend.
5.  **Cuenta Corriente (`CREDIT`)**:
    *   *Caja*: Zero impacto líquido a arqueo de caja del día.
    *   *Cuenta Corriente*: Se carga el valor deudor del comprobante a la ficha del cliente, alterando los límites y reduciendo su crédito.

---

## 10. REGLAS DE NEGOCIO GLOBALES DE INFRAESTRUCTURA

1.  **Bloqueo de Modificación de Documentos Cerrados**:
    *   Ningún registro de venta, pago o movimiento histórico en tablas de auditoría impositiva permite sentencias SQL de tipo `UPDATE` o `DELETE` bajo ninguna circunstancia externa. La corrección contable se efectúa exclusivamente mediante Notas de Crédito, Débito o transacciones complementarias autorizadas.
2.  **Conciliación Obligatoria de Caja**:
    *   No es admisible la facturación mostrador del POS si el cajero posee una devaluación contable, o si la caja física principal se evalúa como `CLOSED`.
3.  **Matriz de Descuentos Máximos**:
    *   El porcentaje máximo acumulado en descuentos en el carro de venta POS nunca podrá superar el tope asignado al nivel de rol del usuario de la sesión, bloqueando la confirmación y demandando ingreso de credenciales de un rol superior.

---

## 11. MATRIZ DE ALERTAS Y EVENTOS CORPORATIVOS

1.  **Alerta de Stock Crítico (Notificación Inmediata)**:
    *   *Gatillo*: `Stock.quantity <= Stock.minAlertLevel`.
    *   *Layout*: Alerta en pantalla de color naranja en sección de alarmas del Dashboard, acompañado de un informe semanal compilador automático enviado al área de compras.
2.  **Caja sin Cerrar (Fuera de Horario)**:
    *   *Gatillo*: Sesión de caja en estado `OPEN` posterior a las 22:00 hs.
    *   *Destinatarios*: Emails alertas al administrador avisando sobre posible descuido operativo de arqueo de mostrador.
3.  **Clientes con Deudas Vencidas**:
    *   *Gatillo*: Deudor supera en un 10% el límite máximo asignado al perfilar cobros corrientes.
    *   *Efecto*: Bloqueo automático preventivo de preventas rápidas en cuenta corriente en terminales POS.

---

## 12. DEFINICIÓN DE REPORTES REQUERIDOS

### Reporte de IVA Ventas (Contable y Fiscal)
-   *Filtros*: Rango mensual, Sucursal emisora, Tipo de comprobante (A, B, C).
-   *Métricas indicadas*: Total neto gravado por tasas (21%, 10.5%), Total de IVA devengado, Tasas de exención aplicadas, Totales brutos facturados.

### Reporte de Rentabilidad Operativa de Catálogo
-   *Filtros*: Categorías, marcas, listas de precios consultadas.
-   *Métricas*: Costo promedio neto ponderado de reposición contra precio de venta final facturado, determinando el margen bruto neto porcentual de beneficio por SKU.

### Reporte de Caja y Arqueo Consolidado
-   *Filtros*: Operario cajero, Sesión específica, Fecha del arqueo.
-   *Métricas*: Saldo inicial asentado, sumatoria de transacciones liquidadas por método de cobro, total de retiros de seguridad efectuados, arqueo real e inconsistencias monetarias de arqueos al cierre de jornada.

---

## 13. DISEÑO DE INTEGRACIONES Y COMUNICACIONES DE RED

### Conexión AFIP u Oficina Impositiva Local
- Para validar facturas, el backend conforma un layout de firma digital asimétrica con clave privada local, conectándose con los servidores del estado para obtener el CAE. En caso de caídas o caídas del servicio estatal, el sistema permite de forma programática almacenar comprobantes en estado "Preventa transitoria pendiente de homologación contable posterior" para asegurar que la sucursal continúe vendiendo localmente en momentos de cortes de conectividad.

### Integración de Lectores de Código de Barra y Ticketeadoras
- **Lector**: El sistema opera capturando la velocidad consecutive de entrada de dígitos en el DOM. Si se leen más de 8 caracteres consecutivos en intervalos menores a 30ms, el ERP anula la entrada en campos convencionales y carga el código directamente como un trigger de disparo del carrito POS.
- **Ticketeadora**: Consiste en la exportación de layouts mediante comandos directos ESC/POS hacia un daemon de spool de impresión del lado cliente para anular diálogos de impresión estándar de sistemas operativos de consumo.

---

## 14. ROADMAP ESTRATÉGICO DE DESARROLLO (DE ORDEN DE EJECUCIÓN)

```
        ┌────────────────────────────────────────────────────────┐
        │  ETAPA I: BASE DE DATOS E INFRAESTRUCTURA CORE DE RED  │ (Completado)
        └───────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
        ┌────────────────────────────────────────────────────────┐
        │       ETAPA II: CATAÓLGO DE PRODUCTOS Y COMPRAS        │ (Fase Inicial)
        └───────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
        ┌────────────────────────────────────────────────────────┐
        │    ETAPA III: CUENTAS DE CLIENTES Y CONTROL CAJAS      │
        └───────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
        ┌────────────────────────────────────────────────────────┐
        │      ETAPA IV: PUNTO DE VENTA (POS) Y FACTURACIÓN      │
        └────────────────────────────────────────────────────────┘
```

### Planificación de Fases y Dependencias
1.  **Fase 1: Catálogos, Marcas y Depósitos**:
    *   *Justificación*: Sin de depósitos no se puede imputar stock, y sin fichas de productos y listas de precios no es posible alimentar al POS.
    *   *Complejidad*: Media-Baja (Esqueleto estructural CRUD maestro).
2.  **Fase 2: Compras y Proveedores**:
    *   *Justificación*: Permite ingresar valores de stock teóricos reales en los almacenes por compras consolidadas.
    *   *Complejidad*: Media.
3.  **Fase 3: Caja, Sesiones y Cuentas de Compradores**:
    *   *Justificación*: Habilita y valida los requerimientos y canales previos requeridos antes del flujo del checkout.
    *   *Complejidad*: Media-Alta.
4.  **Fase 4: Desarrollo del POS**:
    *   *Justificación*: Integración visual final de la plataforma mostrador consumiendo todas las fases estables previas.
    *   *Complejidad*: Alta.

---

## 15. AUDITORÍA DEL PROYECTO (PLAN DE AJUSTES EN EL CODIGO)

Tras revisar la base relacional creada en el actual `schema.prisma` y confrontarla contra los principios estipulados en esta Especificación y Constitución general del ERP, se determinan sugerencias de normalización en base de datos previas al desarrollo:

1.  **Campo `cuit` en `Business`**:
    *   *Detalle*: El campo de base de datos figura mapeado como `taxId`. Es una convención idónea multilingüe para adaptar la plataforma SaaS en otros países (CUIT, RFC, RUT). Se mantiene la denominación general `taxId` en el motor para flexibilidad.
2.  **Valores de Comisiones y Descuentos en Métodos de Pago**:
    *   *Esquema*: Validar que el tipo de datos sea explicitado siempre bajo configuraciones del tipo `Decimal` y que no existan variables que puedan distorsionar la precisión final del arqueo de fondos.
3.  **Integridad de Auditoría en la Tabla `AuditLog`**:
    *   *Detalle*: Mantener la inmutabilidad de la tabla evitando Cascade deletes accidentales sobre los logs cuando un usuario es borrado lógicamente del sistema. Se garantiza que la relación de usuario con los logs sea `onDelete: SetNull` para preservar los históricos forenses.
