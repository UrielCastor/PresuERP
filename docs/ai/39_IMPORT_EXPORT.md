# PRESUERP - AI DEVELOPMENT KIT: IMPORT & EXPORT ENGINE

Este documento proporciona la especificación técnica y de desarrollo oficial del **Motor de Importación y Exportación (Import & Export Engine)** de **PresuERP**, detallando los formatos válidos de importación de ítems de catálogo, la generación y exportación dinámica de archivos planos CSV y Excel, y la gobernanza de transacciones asociadas.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El volumen de carga inicial de un ERP exige motores para inyectar datos masivos de manera programática.
*   **Eficiencia de Carga**: Habilitar a las empresas a subir su listado de stock inicial y proveedores mediante plantillas de Excel o archivos CSV limpios.
*   **Consistencia de Datos Relacionales**: Validar línea por línea que las restricciones fiscales y de SKU único del inquilino se cumplan antes de inyectar las filas en PostgreSQL.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El flujo de procesamiento de cargas masivas entrantes sigue la siguiente estructura relacional:

```
[ POST /api/v1/imports/products ] ──> Input File (Multipart Form)
                                             │
                                             ▼
                                     [ Parseador Stream ]
                                 (CSV-Parser / XLSX Parser)
                                             │
                                             ▼
                                  [ Validaciones Zod ]
                           (Control de SKU y tipos de datos)
                                             │
                                             ▼
                                 [ Prisma.$transaction ]
                            (Inyección en bloque a Postgres)
```

---

## 3. IMPORTACIÓN MASIVA (PRODUCTS IMPORT SYSTEM)

### Paso 1: Validación y Parseo de Stream
El controlador Express recibe al archivo de subida, y utiliza librerías de streaming (como `csv-parser`) para procesar las líneas de forma secuencial sin llenar la memoria RAM de Node.js.

### Paso 2: Validación Transaccional
Para cada registro mapeado en el archivo, se corren validaciones atómicas:
*   El SKU no debe existir en los registros activos del `businessId` inyectado.
*   Los valores numéricos de costo (`purchasePrice`) y precios de venta (`salePrice`) deben ser mayores a cero. De registrarse discrepancias relacionales o formatos corruptos, toda la transacción interrumpe su ejecución con `ROLLBACK`, reportando la línea específica del fallo al frontend React.

---

## 4. EXPORTACIÓN DE REPORTES OPERATIVOS

El backend expone endpoints de descarga en formatos estructurados (CSV/Excel):
*   **Generación de CSV**: Construye un flujo plano concatenando strings sin retener bloques completos en RAM.
*   **Configuración de Cabeceras HTTP**: Para asegurar que el navegador del operario descargue el activo de forma directa, los controladores especifican las directivas correctas de adjunto:
```typescript
res.setHeader('Content-Type', 'text/csv');
res.setHeader('Content-Disposition', `attachment; filename=reporte-stock-${new Date().getTime()}.csv`);
```

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en los archivos de subida para evitar la inyección cruzada de catálogos entre clientes del SaaS.
2.  **Tamaño Excesivo de Archivos**: Cargas superiores a 5.000 filas concurrentes bloquean por demasiados segundos la tabla principal de `products`. Es mandatorio procesar estas subidas dividiendo el lote en bloques (chunks) relacionales de un máximo de 500 registros por transacción Prisma.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
