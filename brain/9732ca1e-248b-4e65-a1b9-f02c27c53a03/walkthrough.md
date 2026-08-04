# Walkthrough - Unificación y Refactor de la Arquitectura Multi-Depósito

Se ha completado el refactor integral del ERP para unificar la arquitectura Multi-Depósito en todos los módulos del sistema, garantizando el aislamiento absoluto por local e independizando el **Contexto Operativo** del **Contexto Administrativo**.

---

## 1. Estructura de Arquitectura Implementada

### ⚡ 1. Contexto Operativo (Operación Diaria)
- **Fuente de verdad**: `CashSession` → `warehouseId`.
- **Módulos Afectados**: **Caja** y **POS**.
- **Comportamiento**:
  - Tanto el frontend como el backend obtienen el `warehouseId` automáticamente desde la `CashSession` activa.
  - Se eliminaron todos los selectores de depósito manuales dentro de Caja y POS durante una sesión abierta.
  - La cabecera del POS y la pantalla de Caja muestran el depósito real inmutable de la sesión en curso.
  - Las consultas de stock, búsquedas de productos y ventas en el POS quedan estrictamente aisladas al `warehouseId` de la caja abierta.
  - `SaleService.create` valida e impone `data.warehouseId = activeSession.warehouseId`, asegurando que el descuento de stock, el Kardex y el movimiento de caja pertenezcan exclusivamente a dicho local.

### 📊 2. Contexto Administrativo (Gestión y Análisis)
- **Fuente de verdad**: Depósito seleccionado por el usuario en los módulos administrativos (o `"ALL"` / "Todos los depósitos").
- **Módulos Afectados**: **Stock**, **Kardex**, **Compras**, **Traspasos**, **Auditorías**, **Ajustes de Stock**, **Reportes** y **Dashboard**.
- **Comportamiento**:
  - Toda consulta administrativa filtra por `businessId + warehouseId`.
  - **Stock & Kardex**: Muestra únicamente existencias y movimientos del depósito seleccionado.
  - **Compras**: La mercadería ingresa exclusivamente al `warehouseId` definido en la orden de compra.
  - **Traspasos**: Registra explícitamente `sourceWarehouseId` y `targetWarehouseId`, descontando del origen y aumentando el destino.
  - **Auditorías & Ajustes**: Afectan única y aisladamente al depósito configurado.
  - **Reportes & Dashboard**: Filtran por `warehouseId`. Únicamente al seleccionar **"Todos los depósitos"** se genera el consolidado consolidado global de la empresa.

---

## 2. Estado de Compilación y Servidor

- **Backend (`tsc`)**: Compilado sin errores (**0 errores**).
- **Frontend (`tsc && vite build`)**: Compilado y empaquetado sin errores (**0 errores**).
- **Servidor Backend**: En ejecución en puerto `5099` (Task ID `task-6825`).
