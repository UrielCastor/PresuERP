# PRESUERP - AI DEVELOPMENT KIT: PROJECT CONTEXT

Este documento proporciona una descripción exhaustiva del estado actual y la arquitectura del sistema **PresuERP**. Está diseñado para servir como referencia general e introductoria para desarrolladores y sistemas de Inteligencia Artificial que requieran comprender holísticamente la lógica del software, los módulos implementados, sus interconexiones y tecnologías subyacentes.

---

## 1. DESCRIPCIÓN GENERAL

### Objetivo de PresuERP
PresuERP es una plataforma de software multi-tenant de tipo Software as a Service (SaaS). Su objetivo principal es permitir a múltiples y diversas empresas (tenants) gestionar de manera segura y aislada sus inventarios, múltiples almacenes/depósitos físicos, flujos de compras de mercaderías e historial inmutable de movimientos de stock (Kardex).

### Problemas que Resuelve
*   **Gestión Multi-depósito Desordenada**: Controla de manera centralizada la distribución de inventarios por ubicación física.
*   **Desviaciones en Impuestos de Compra**: Permite desglosar y persistir con exactitud el porcentaje de IVA y montos detallados para Otros Impuestos durante el ingreso de compras de mercaderías.
*   **Inconsistencias y Redondeos de Inventario**: Integra un módulo Kardex inmutable para registrar transacciones y evitar actualizaciones inconsistentes.
*   **Pérdida de Trazabilidad Operativa**: Registra los usuarios autores de cada creación, modificación e inicios de sesión a través de pistas de auditoría (`activity_logs` y `audit_logs`).

### Alcance Actual y Estado del Desarrollo
El sistema cuenta con la infraestructura completa de base de datos Postgres (mediante Prisma), autenticación robusta, seguridad RBAC dinámico en frontend y backend, y control completo sobre catálogos de inventario y compras. Se encuentran operacionales las funciones de:
*   Aprobación y registro de compras.
*   Actualizaciones automáticas de costos máster y precios de venta calculados en catálogo.
*   Generación de entradas y salidas de stock automáticas o manuales asociadas a una compra.
*   Auditoría de logs internos.

---

## 2. ARCHITECTURA GENERAL Y TECNOLOGÍAS

El monorepositorio está compuesto físicamente por dos entornos autocontenidos:

### A. Backend (`erp/backend`)
Construido sobre Node.js, Express y TypeScript.
*   **Filtros middleware**: Express se encarga de recibir, validar esquemas con Zod, y evaluar permisos mediante tokens JWT para filtrar la ejecución de rutas.
*   **Persistencia (Prisma)**: Prisma ORM conecta con PostgreSQL. Toda interacción física de datos viaja a través de repositorios específicos que actúan como la capa exclusiva de persistencia de Base de Datos.
*   **Arquitectura de Capas**: Divide la ejecución en Router -> Controller -> Service -> Repository.

### B. Frontend (`erp/frontend`)
Aplicación SPA en React configurada bajo Vite.
*   **Control de Estado Asincrónico**: Logrado a través de Tanstack React Query. Administra la sincronización automática de catálogos y transacciones con la API, administrando el estado en caché.
*   **Formularios**: React Hook Form coordina el comportamiento de los inputs y delega a Zod la validación estática local.
*   **Diseño y Componentes**: Basado en CSS vanilla con un sistema centralizado de temas (Dark mode, Light mode y variaciones cromáticas).

### C. Tecnologías Utilizadas y Librerías Principales

| Ecosistema | Tecnología / Librería | Propósito principal |
| :--- | :--- | :--- |
| **Común** | TypeScript | Tipado estático en todo el ciclo de código. |
| **Backend** | Express | Framework de ruteo HTTP. |
| **Backend** | Prisma Client | Gestión y persistencia del modelo relacional SQL. |
| **Backend** | jsonwebtoken | Firma y decodificación de tokens de sesión digital. |
| **Backend** | bcrypt | Hasheo de contraseñas de usuarios. |
| **Frontend** | React | Biblioteca de componentes de interfaz declarativa. |
| **Frontend** | @tanstack/react-query | Manejo de caché y consultas REST en el cliente. |
| **Frontend** | react-hook-form | Formulación reactiva y performante. |
| **Frontend** | zod | Validación de contratos de entrada y salida de datos. |
| **Frontend** | lucide-react | Iconografía de diseño unificada. |

---

## 3. ORGANIZACIÓN DEL PROYECTO

### Estructura del Backend (`erp/backend/src`)

*   `app.ts` / `index.ts`: Puntos de inicio de Express y bootstrap de la aplicación.
*   `config/`: Ajustes de Base de Datos (`db.ts`), Entorno (`env.ts` con validación Zod), e inicialización del Logger.
*   `controllers/`: Clases controladoras que gestionan requests HTTP y formulan reenvíos hacia los servicios.
*   `services/`: Lógica central del negocio financiero y de inventarios.
*   `repositories/`: Contiene clases que implementan SQL/Prisma directo.
*   `middlewares/`: Rate limiter, validación de variables Zod, parseo JWT de autenticación y ruteo seguro.
*   `routes/`: Mapea URLs locales a controladores y asocia middlewares de permisos específicos.
*   `utils/`: Definición de excepciones tipo `AppError`.

### Estructura del Frontend (`erp/frontend/src`)

*   `main.tsx` / `AppRoutes.tsx`: Inyección inicial en el DOM y configuración del enrutador React Router DOM.
*   `config/`: Configuraciones de menú lateral (`menu.ts`) y variables de entorno.
*   `contexts/`: Controladores de contexto (`AuthContext.tsx`, `ThemeContext.tsx`).
*   `layouts/`: DashboardLayout que coordina barras de menú de opciones y layouts reutilizables.
*   `pages/`: Pantallas completas ligadas a las vistas del ERP (ejemplo: `Products.tsx`, `Purchases.tsx`, `Suppliers.tsx`).
*   `services/`: Instancia cliente de Axios estructurada para el mapeo de llamadas REST hacia el Backend.
*   `styles/` / `themes/`: Declaraciones CSS globales del sistema de Themes.

---

## 4. MÓDULOS DEL ERP

A continuación se detalla el estado actual, las dependencias e integraciones de cada módulo definido en PresuERP:

### 1. Control de Acceso (Usuarios y Roles RBAC)
*   **Estado**: **Implementado** al 100%.
*   **Objetivo**: Permitir a administradores crear perfiles internos de usuarios asociados a la empresa, asignando roles dinámicos con contraseñas seguras individuales hashed por bcrypt.
*   **Dependencias**: `User`, `Role`, `RolePermission`, `Permission` en base de datos.
*   **Integración**: Restringe y da forma tanto al sidebar en el frontend como a los filtros de controladores en el backend del ERP.

### 2. Catálogo de Artículos (Productos y Categorías)
*   **Estado**: **Implementado** al 100%.
*   **Objetivo**: Gestionar categorías y productos. Controla atributos como código de barras único para la empresa, SKU, precios de compra, márgenes de utilidad calculables y precios de venta resultantes.
*   **Dependencias**: `Product`, `Category`, `SubCategory`, `Supplier` (relación opcional).
*   **Integración**: Provee la información máster del catálogo en el POS y módulo de Compras. Gatilla borrados lógicos automáticos cambiando estado a `'INACTIVE'` si hay dependencias transaccionales en bases de datos.

### 3. Ficha de Proveedores
*   **Estado**: **Implementado** al 100%.
*   **Objetivo**: Mantener el registro y datos detallados de contacto de proveedores comerciales vinculados por CUIT/RUT/RFC.
*   **Dependencias**: `Supplier`.
*   **Integración**: Utilizado como selección restrictiva inicial en el módulo de registro de compras de mercaderías.

### 4. Almacenes y Depósitos (Warehouses)
*   **Estado**: **Implementado** al 100%.
*   **Objetivo**: Parametrización física de depósitos. Controla si están `'ACTIVE'` o `'INACTIVE'`, y cuál actúa como base o depósito principal (`isMain`).
*   **Dependencias**: `Warehouse`, `Stock`.
*   **Integración**: Esencial para ubicar las existencias en compras y transferencias.

### 5. Gestión de Compras
*   **Estado**: **Implementado** al 100%.
*   **Objetivo**: Registrar ingresos de mercadería, controlando costos unitarios, descuentos específicos, y desglose manual impositivo por porcentaje de IVA (`vatRate`) y Otros Impuestos dinámicos (`otherTaxes` que persisten un tipo PERCENTAGE o FIXED con su respectivo valor y monto calculado).
*   **Dependencias**: `Purchase`, `PurchaseItem`, `Warehouse`, `Supplier`, `StockMovementService`.
*   **Integración**: Al aprobarse la compra viaja una transacción que actualiza el stock físico de depósitos, incrementa el costo máster de producto del catálogo, recalcula los precios de venta asociados, genera el registro de Kardex de inventario y el log auditable final.

### 6. Kardex y Control de Existencias (Stock Movements)
*   **Estado**: **Implementado** al 100%.
*   **Objetivo**: Controlar niveles de stock por producto-depósito y persistir en la tabla `StockMovement` (Kardex) un récord inmutable de todo ingreso, egreso o ajuste.
*   **Dependencias**: `Stock`, `StockMovement`, `Product`, `Warehouse`.
*   **Integración**: Es impactado de forma directa por transacciones del módulo de compras o por ventas locales. Restringe operaciones aplicando verificaciones automáticas de stock negativo no configurado.

### 7. Facturación y Ventas (POS)
*   **Estado**: **Parcial**.
*   **Objetivo**: Simular ventas en puntos de cobro físicos.
*   **Comentarios de Implementación**: El backend dispone del endpoint POST `/api/v1/sales` en `sales.routes.ts` el cual calcula y descuenta stock del depósito especificado e inserta movimientos Kardex de egreso (`EXIT`). Sin embargo, **esta transacción NO se persiste** en las tablas relacionales de la base de datos `Sale` o `SaleItem`, operando libre de la validación contable física. Adicionalmente, el frontend carece de interfaz visual alguna para efectuar o listar ventas (la ruta `/sales` no existe en la navegación de `AppRoutes.tsx` del cliente React).

### 8. Clientes, Cuentas Corrientes y Cajas
*   **Estado**: **Pendiente / Inexistente**.
*   **Comentarios**: Aunque existen esquemas conceptuales mapeados en base de datos (`Customer`, `CustomerAccount`, `CashSession`, `CashRegister`), no existen controladores asociados en el backend ni vistas construidas en el frontend.

### 9. Mercado Pago Pasarela / Reportes Analíticos
*   **Estado**: **Pendiente / Inexistente**.
*   **Comentarios**: No existe código relacionado al tratamiento de cobros digitales en el backend ni en la interfaz del frontend. El dashboard principal muestra recuadros representativos con información mockeada de prueba.

---

## 5. INTERACCIONES E IMPACTOS ENTRE MÓDULOS

Las transacciones lógicas del ERP vinculan de forma directa múltiples capas. El siguiente gráfico e historial representan el impacto encadenado del ciclo de aprobación de compras:

```
                  [ Aprobación de Compra ]
                             ↓
             [ Cambia Status: APPROVED y PAID ]
                             ↓
          [ Para cada PurchaseItem ingresado: ]
                             ↓
   ┌─────────────────────────┼─────────────────────────┐
   ↓                         ↓                         ↓
[Kardex / Movimiento] [Stock Consolidado]     [Ficha Producto Catálogo]
   (Crea ENTRY           (Suma quantity al      (Actualiza purchasePrice,
  in StockMovement)          depósito)          recalcula salePrice y
                                               proveedor asignado)
                             │
                             ↓
                    [ Registro ActivityLog ]
                     (Guarda auditable final)
```

1.  **Validación de Depósito**: Compras evalúa inicialmente si el depósito parametrizado se encuentra `'ACTIVE'` antes de efectuar el procesamiento.
2.  **Kardex**: El aumento de volumen en el inventario gatilla un registro `'ENTRY'` inmutable en el Kardex.
3.  **Costos y Venta**: La actualización del costo de compra en catálogo re-calcula de forma automática los precios de venta asociados de cara al público basándose en el margen de ganancia histórico, reasignando al proveedor respectivo como predeterminado en el catálogo de productos.
4.  **Auditoría**: Se inyectan logs estructurados en logs de actividad para salvaguardar y verificar la trazabilidad.

---

## 6. FLUJO GENERAL DEL SISTEMA (FRONTEND ↔ BACKEND ↔ DB)

```
[ Frontend: React - Pages ]  ──( Axios con Bearer Token JWT )──>  [ Backend: Express - Routes ]
            ↑                                                                │
     ( Actualiza Caché                                               ( Procesa validación
       y renderiza )                                                   Zod e intercepta )
            │                                                                ↓
[ QueryClient / React Query ]  <──( Retorna JSON Estructurado )──  [ Controllers / Services ]
                                                                             │
                                                                       ( Lógica Lanza
                                                                         Transacciones )
                                                                             ↓
                                                                   [ Repositories / Prisma ]
                                                                             │
                                                                     ( Acciones SQL )
                                                                             ↓
                                                                   [ Base de Datos: PostgreSQL ]
```

1.  **Sesión**: El operador realiza login. El backend valida encriptación bcrypt, genera tokens y responde un accessToken firmado (JWT) más un refreshToken persistido.
2.  **Operación**: El cliente React envía peticiones a la API adjuntando el payload en formato Bearer Token.
3.  **Seguridad**: El backend intercepta con `auth.middleware.ts`, asigna `req.user` mediante decodificación segura y valida permisos de rol.
4.  **Negocio / SQL**: El controlador llama al Servicio. El Servicio abre transacciones de ser necesario y delega escrituras directas sobre base de datos a través de los Repositorios Prisma.
5.  **Final**: La base de datos guarda y responde a la capa lógica, finalizando en el envío de un JSON `{ success: true, data: [...] }` de retorno al cliente React. Zod en el frontend valida el contrato, y React Query expira e invalida la caché de listados para forzar el redibujado de la interfaz de usuario en pantalla.

---

## 7. ESQUEMA MULT-TENANT

El multi-inquilino (multi-tenant) se gestiona de forma estricta y lógica:
*   **ID Organizativo**: Es el campo UUID `businessId`.
*   **Exclusión del Frontend**: Los formularios en la pantalla del cliente React no disponen de inputs para setear o cambiar el `businessId`. Este parámetro es omitido en el frontend.
*   **Extracción en el Token**: Durante el login, el backend cifra el `businessId` del usuario dentro del JWT.
*   **Tratamiento Lógico en el Backend**: `requireAuth` lo rescata en cada request para fijarlo en `req.user.businessId`. De este modo, los servicios del backend inyectan el `businessId` obligatoriamente a los controladores y repositorios en todo select, insert, update o delete de base de datos.
*   **Consistencia**: Se previene que usuarios visualicen, modifiquen o borren inventarios o transacciones de otras empresas registradas en la base de datos PostgreSQL de PresuERP.

---

## 8. SEGURIDAD

*   **Firmas JWT**: Tokens de corta duración (por defecto, 15 minutos en producción/desarrollo) firmados mediante algoritmo HS256 con `JWT_SECRET`.
*   **Refresh Tokens**: Strings de alta entropía firmados y guardados en la tabla `refresh_tokens` con expiración de 7 días. Previenen deslogueos abruptos forzando re-emisiones seguras tras el vencimiento.
*   **Filtros de Control de Acceso (RBAC)**:
    *   Los permisos están tipados por string (ej. `products:read`, `purchases:approve`).
    *   `requirePermission` realiza la validación. Si el rol es el string exacto `'Administrator'`, se autoriza bypass completo por código.
*   **Protected Routes**: Componente envolvente en React que evalúa el token guardado en el navegador. De fallar la verificación, redirige dinámicamente al login.
*   **Validaciones**: Middleware de validación Express que corta requests erróneos analizando variables en el router mediante esquemas e inferencia de Zod.

---

## 9. INTEGRACIONES DEL SISTEMA Y VÍNCULOS TÉCNICOS

Al realizar el análisis del proyecto, se confirman las siguientes integraciones activas:

### A. Integración Stock ↔ Kardex (Interna)
*   **Función**: Centralizar variaciones físicas del catálogo de productos protegiendo la consistencia de inventario.
*   **Vínculos**: `StockMovement` (Kardex) actúa como el historial inmutable vinculado directamente a la tabla consolidadas de stock por depósito `Stock`.

### B. Integración Facturación ↔ Ventas POS ↔ Stock (Interna)
*   **Función**: Reducir el inventario disponible de manera directa tras la venta rápida.
*   **Vínculos**: El router de venta rápido `/api/v1/sales` interactúa decrementando existencias consolidables y escribiendo el egreso de Kardex.

### C. Mercado Pago Pasarela / SDK (Externa)
*   **Estado**: **Pendiente / Inexistente**. El código analizado en backend y frontend no cuenta con integraciones, webhooks o dependencias dedicadas a Mercado Pago.

---

## 10. DEPENDENCIAS TÉCNICAS (BACKEND Y FRONTEND)

### Dependencias Principales del Backend (`erp/backend/package.json`)
*   `@prisma/client`: Gestor directo de relaciones de persistencia relacional SQL.
*   `bcryptjs`: Hasheo unidireccional de claves de seguridad de empleados.
*   `cors` / `helmet`: Cabeceras de seguridad y control de peticiones cruzadas originadas en el cliente Vite.
*   `dotenv` / `zod`: Carga limpia y validación estricta de variables de entorno de servidor.
*   `express`: Micro-framework router REST HTTP.
*   `jsonwebtoken`: Gestión de firmas, validaciones y decodificación de tokens digitales.
*   `winston`: Motor de generación de bitácoras y logs de servidor.

### Dependencias Principales del Frontend (`erp/frontend/package.json`)
*   `@tanstack/react-query`: Sincronización e invalidación de caché optimizada de llamadas locales.
*   `axios`: Cliente para consumar servicios REST HTTP.
*   `lucide-react`: Ecosistema de iconos de interfaz modularizados.
*   `react-hook-form` con `@hookform/resolvers/zod`: Coordinador de inputs del cliente y validación local de formularios.
*   `react-router-dom`: Enrutamiento SPA cliente.
*   `zod`: Definición de esquemas locales TypeScript.

---

## 11. CONVENCIONES DEL PROYECTO DETECTADAS

Durante el análisis del código fuente real se han constatado las siguientes convenciones organizacionales:

*   **Identificadores**: Siempre encapsulados como UUID estándar provistos por la base de datos bajo strings planos a nivel de código de tipado TypeScript.
*   **Respuestas en la API**: Las APIs en backend devuelven siempre objetos JSON estándar `{ success: true, data: [...] }` para respuestas exitosas, u objetos con la propiedad `{ status: 'error', message: '...' }` si ocurre una excepción de sistema.
*   **Convención en Nombres**:
    *   Servicios, repositorios y controladores se nombran siempre en minúscula mixta (camelCase) con su sufijo identificador explícito: (ejemplo: `product.service.ts`, `product.repository.ts`, `product.controller.ts`).
    *   Los componentes React y pantallas del frontend emplean PascalCase (ejemplo: `Products.tsx`, `Purchases.tsx`).
*   **Tratamiento de Decimales**: Se realiza una estricta conversión a clase nativa `Number()` (ejemplo: `Number(item.quantity)`) en el backend al leer de base de datos para no arrastrar clases wrapper complejas de base relacional.

---

## 12. ESTADO ACTUAL DEL PROYECTO (RESUMEN)

### Módulos Finalizados e Integrados
*   Autenticación de Usuarios de Empresa & Gestión de Roles (RBAC).
*   Gestión de Catálogos (Categorías, Proveedores y Productos).
*   Gestión de Almacenes y Depósitos Físicos.
*   Gestión y Procesamiento de Compras de Mercaderías.
*   Auditoría de Movimientos inmutables de Stock (Kardex).

### Módulos en Desarrollo / Parciales
*   Ventas (POS rápido): Falta de persistencia real en tablas históricas relacionales de base de datos `Sale` y `SaleItem`, operando solo a nivel lógico del stock físico. Falta total de interfaz de usuario en el frontend del cliente.

### Módulos Faltantes / No Registrados
*   Módulo Clientes y control de Deudas en Cuentas Corrientes.
*   Módulo de Apertura y Cierre de Sesiones de Caja (Turnos).
*   Pasarela y cobros digitales con Mercado Pago.
*   Sección analítica de Descargas y Reportes PDF/Dashboard.

---

## 13. OBSERVACIONES TÉCNICAS DETECTADAS

Se detallan e informan los siguientes aspectos notables para considerar antes de programar en el codebase:

1.  **Incongruencias en el Ruteo Local**: El submenú interactivo del layout del cliente React enlaza a páginas no definidas ni importadas en `AppRoutes.tsx` como `/sales` y `/reports`. La redirección comodín las derivará automáticamente al listado o al Not Found.
2.  **Operación POS sin Facturas**: Al procesar POST `/api/v1/sales` se manipula y descuenta el stock de depósitos y se asientan líneas de Kardex pero se pierden los datos materiales de facturación mercantil al omitirse la persistencia en las tablas `sales` e `items_sales` mapeadas en Postgres y Prisma.
3.  **Lógica Exclusiva Administrator**: El bypass automático para el rol Administrator obliga a que la asignación de este rol contenga filtros estrictos de autorización para salvaguardar la escalabilidad y consistencia del RBAC.
4.  **Bypass de Marcas**: Existen remanentes lógicos de Marcas (`Brand.tsx`) inactivos y desvinculados del enrutador tras haber sido reemplazados administrativamente en su totalidad por el módulo de Proveedores y sus endpoints asociados.
