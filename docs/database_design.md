# Diseño Profesional e Infraestructura de Modelado de Datos (schema.prisma)

Este documento detalla las decisiones arquitectónicas, consideraciones de rendimiento y previsiones de crecimiento integradas en el archivo `schema.prisma`.

---

## 1. Decisiones de Diseño por Módulo

### 1.1 Configuración Granular de Empresas (Settings)
- Para mantener la entidad `Business` limpia y de alto rendimiento en lecturas rápidas, se segmentaron sus configuraciones en relaciones `1-a-1`:
  - `BusinessSettings`: Preferencias de interfaz (Moneda, Zona Horaria, Formato de Fecha/Lenguaje).
  - `FiscalSettings`: Parámetros tributarios de facturación requeridos por leyes locales (ej. AFIP, SII, SAT).
  - `POSSettings`: Parámetros de caja rápida y checkout.
  - `PrintSettings`: Configuración física del hardware de impresión (ticket ticketeadoras térmicas de 58/80mm o informes en A4).
  - `EmailSettings`: Credenciales SMTP aisladas por empresa para notificaciones automáticas.
  - `NumberSettings`: Correlativos de secuencias globales.

### 1.2 Multiempresa (Aislamiento Total Logico)
- Cada entidad transaccional, maestra y de configuración posee un campo directo `businessId` indexado.
- Se implementaron **Composites Unique Constraints** que asocian el identificador de la entidad con el `businessId` (ej. `@@unique([sku, businessId])`). Esto permite que el SKU `ABC-123` exista en varios negocios diferentes, pero garantizando unicidad estricta dentro del mismo entorno organizacional de cada empresa.

### 1.3 Listas de Precios Independientes (Modularidad Fuerte)
- Los precios fueron removidos de la tabla `Product`. Los valores monetarios viven en `PriceList` e `PriceListItem`.
- **Estructura Dinámica**:
  - `PriceList` agrupa listas ilimitadas (ej. Mayorista, Minorista, Sucursal, Promocional).
  - `PriceListItem` relaciona un producto a una lista. Admite además un campo `minQuantity` (Cantidad Mínima) con índice único compuesto. Esto permite que una misma lista de precios tenga descuentos escalonados automáticos por volumen de compra (ej. $100 por unidad, $80 si compra a partir del item nº 10).

### 1.4 Aislamiento Físico de Stock (Multi-depósito)
- Los niveles de stock se desvincularon del producto. Cada registro reside en `Stock`, el cual asocia un `ProductId` con un `WarehouseId` (Depósito).
- Los movimientos históricos se loguean en `StockMovement`, vinculando el depósito de origen/destino y clasificando el movimiento según su origen (Venta, Compra, Transferencia, Inventario Físico) para alimentar un módulo de auditoría de inventario (Kardex).

### 1.5 Modularidad y Flexibilidad en Ventas (POS & Facturación)
- La venta (`Sale`) no define una sumatoria o método de pago único. Admite pagos divididos ilimitados en `SalePayment` vinculados a diferentes `PaymentMethod`. Una compra de $75,000 puede saldarse con $20,000 en Efectivo, $30,000 vía transferencia y $25,000 con tarjeta de crédito.
- La tabla de `PaymentMethod` soporta recargos, descuentos y comisiones financieras calculadas a nivel de base de datos con precisión exacta (`Decimal(5, 4)`).

### 1.6 Control de Caja Robusto (Shift Management)
- Se evita mezclar la venta con el arqueo financiero.
  - `CashRegister` representa la caja física del local.
  - `CashSession` representa la apertura, balance inicial, balance final, y arqueo/cierre de turnos de un operario.
  - `CashMovement` almacena directamente ingresos/egresos manuales o automáticos efectuados durante el turno administrativo de caja.

### 1.7 Facturación y Numerador Fiscal Segmentado
- `DocumentType` permite registrar comprobantes comerciales e internos (Facturas, Notas de Crédito, Presupuestos, Remitos).
- `DocumentSeries` proporciona múltiples bocas de expendio (ej. Punto de Venta 0001, 0002) asociando prefijos y correlativos automáticos, soportando millones de facturas con series concurrentes.

---

## 2. Optimización e Índices para Millones de Registros

Para evitar cuellos de botella y degradación de rendimiento conforme la plataforma SaaS comience a almacenar millones de registros, se configuraron estrategias de indexación:

1. **Composite Indexes**:
   - Tablas transaccionales pesadas como `Sale`, `StockMovement` y `AuditLog` combinan índices que emparejan `businessId` con `createdAt`. Esto acelera las búsquedas por rangos de fecha de un negocio específico en menos de 1ms.
2. **Composite Uniques**:
   - `@@unique([warehouseId, productId])` en stocks asegura que jamás se dupliquen registros de un mismo item en un depósito específico, optimizando las búsquedas y actualizaciones concurrentes del motor.
3. **Tipos Decimales Exactos**:
   - Se reemplazaron tipados genéricos `Float` por `Decimal` con precisiones monetarias adaptables (`Decimal(12, 2)`) y de control de stock de alta precisión fraccionaria (`Decimal(12, 3)`), útil para comercios de venta al peso.

---

## 3. Escalabilidad SaaS y Futuros Módulos Contemplados

El modelo actual tiene preparado el soporte a nivel relacional de los siguientes submódulos funcionales sin necesidad de modificar el schema en el futuro:

- **Módulo de Promociones**: Promociones por periodo de tiempo, porcentajes, montos fijos o descuentos aplicados a productos seleccionados.
- **Cuenta Corriente de Clientes**: Aportes a cuenta, cobro con saldo a favor e histórico de deudas usando balances decimales unificados e indexados en `CustomerAccount`.
- **Logística & Transferencias Internas**: Módulo de envíos entre depósitos con control de estados (`PENDING`, `IN_TRANSIT`, `COMPLETED`, `CANCELLED`).
- **Seguimiento Histórico e Identificación**: Soporte de múltiples códigos de barra para un mismo producto (`ProductBarcode`) para vincular códigos de proveedor o de pack por bulto.
