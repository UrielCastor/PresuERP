# PRESUERP - SYSTEM CHANGELOG

Este documento registra de forma histórica y cronológica la evolución técnica (Changelog) del sistema **PresuERP**, detallando las versiones liberadas, los módulos core incorporados, e implementaciones estructurales.

---

## [1.0.0] - Versión Inicial Core (Lanzamiento de Base)

### Added (Incorporado)
*   **Aislamiento Multi-Tenant**: Inyección hermética a nivel de base de datos relacionales PostgreSQL a través de la columna `businessId` (tenants).
*   **Autenticación Criptográfica**: JWT de corta duración y ciclo de renovación dinámica mediante Refresh Tokens protegidos por cookies seguras `HttpOnly`.
*   **Módulo RBAC**: Registro dinámico de roles de usuario y middleware de Express Express interceptador de permisos `modulo:accion`.
*   **Activity Logs**: Trazabilidad e inmutabilidad de incidencias transaccionales mediante la tabla física `activity_logs`.
*   **Catálogo de Artículos (`products`)**: Estructuración del inventario, control único de SKU compuesto por tenant, y gestión de categorías.

---

## [1.1.0] - Módulo de Abastecimiento & Compras (Último Hito)

### Added (Incorporado)
*   **Módulo Compras (`purchases`)**: Circuito de compras en estados transaccionales (`DRAFT`, `APPROVED`, `CANCELLED`).
*   **Depósitos Independientes (`warehouses`)**: Control de múltiples depósitos organizacionales por empresa.
*   **Asiento Secuencial de Kardex (`stock_movements`)**: Registro histórico e inmutable de entradas y salidas de stock, persistiendo la valorización contable y costos unitarios de mercaderías adquiridas.
*   **Integración Transaccional**: Orquestación en backend de la transacción atómica `$transaction` para la aprobación de compras articulando existencias y catálogo en una sola llamada de base de datos Postgres.

### Fixed (Corregido)
*   **CORS & Middleware Security**: Se corrigieron fugas de cabeceras en ambientes locales y se reforzó el validador de Zod para UUIDs de entrada en Express.
*   **Bypass de Permisos**: Alineación del ruteo para otorgar bypass automático de protección de permisos al rol de sistema `'Administrator'`.

---

## [1.2.0] - AI Development Kit & Documentación (Hito Presente)

### Added (Incorporado)
*   **AI Development Kit (Docs 01-31)**: Creación de la especificación técnica completa y mapas de código fuente (`docs/ai/`) para asegurar el desarrollo asistido por IAs en PresuERP.
*   **AI Advanced Documentation (Docs 32-50)**: Integración de manuales avanzados de seguridad perimetral, estrategias de testing relacional, reglas operativas de negocio e índices de código.
