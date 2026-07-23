# PRESUERP - AI DEVELOPMENT KIT: RULES & CONVENTIONS

Este documento establece las directrices fundamentales, la arquitectura del software, los estándares de codificación y las reglas de diseño permanentes para **PresuERP**. El objetivo de este manual de desarrollo es guiar el comportamiento de cualquier agente de Inteligencia Artificial (IA) o desarrollador que colabore en la expansión, mantenimiento o depuración de este proyecto.

---

## 1. OBJETIVO DEL DOCUMENTO

Definir de manera no ambigua y basada estrictamente en la implementación existente, las normas técnicas, arquitectónicas y de seguridad del codebase de PresuERP. Cualquier intervención sobre el backend o frontend debe obedecer estas reglas para garantizar la consistencia, el aislamiento multi-tenant, la integridad de los datos, el patrón de auditoría y evitar la degradación de la arquitectura del software.

---

## 2. ARQUITECTURA GENERAL E INFRAESTRUCTURA

PresuERP está organizado metodológicamente como un monorepositorio compuesto por dos subproyectos desacoplados:

1.  **Backend (`erp/backend`)**: API REST desarrollada en Node.js, Express y TypeScript, empleando Prisma ORM para interactuar con una base de datos PostgreSQL.
2.  **Frontend (`erp/frontend`)**: Aplicación tipo Single Page (SPA) desarrollada en React (.tsx), empaquetada con Vite y utilizando TypeScript.

```
erp/
├── backend/
│   ├── prisma/             # Esquemas y migraciones de base de datos
│   └── src/                # Capas lógicas de la API
└── frontend/
    └── src/                # Interfaces y flux de datos React
```

### Principios de Clean Architecture y Repository Pattern

El backend respeta una separación rígida en capas lógicas:

```
  Solicitud HTTP (Express Router)
               ↓
     Middlewares (Auth / Validations)
               ↓
   Controller (Input Mapping & Response formatting)
               ↓
     Service (Core Business Logic Layer)
               ↓
   Repository (Database Access - Prisma)
               ↓
          Base de Datos
```

- **Repository Layer**: Única capa autorizada para realizar operaciones sobre Prisma ORM. Los repositorios se ubican en `src/repositories/` y encapsulan sentencias complejas de base de datos.
  - _Regla Implícita:_ Todo método de repositorio debe poder recibir opcionalmente una instancia de transacción Prisma (`tx?: any`) para heredar transacciones desde la capa de servicios.
- **Service Layer**: Contiene la lógica del negocio pura (cálculos financieros, variaciones de stocks, validaciones lógicas cruzadas). Consume uno o múltiples repositorios. Es la capa encargada de centralizar transacciones mediante `prisma.$transaction` e invocar logs de auditoría.
- **Controller Layer**: Se limita a capturar parámetros HTTP (Query, Param, Body), invocar al servicio de negocio y responder al cliente utilizando estructuras estables de estado (`res.status().json()`). No realiza lógica de negocio.
- **Middlewares**: Interceptan peticiones previas a los controladores para validar esquemas de datos, autenticar tokens JWT y filtrar accesos (RBAC).

---

## 3. CONVENCIONES DE BASE DE DATOS Y PRISMA

El motor relacional es PostgreSQL y es gestionado mediante Prisma.

### Estructura y Convenciones en `schema.prisma`

- **Mapeo físico**: Todos los modelos deben usar la directiva `@@map("nombre_tabla_plural")` para mantener nombres en minúsculas y snake_case en PostgreSQL (ej. `@@map("purchases")`).
- **IDs**: Todos los identificadores principales deben ser de tipo `String` usando UUID v4 por defecto como valor inicial: `@id @default(uuid())`.
- **Fechas de Auditoría**: Todo modelo transaccional y de catálogo debe incorporar controles de tiempo:
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
- **Tipos Numéricos**: Montos monetarios y cantidades de stock deben resistir decimales para evitar problemas de precisión flotante. Se utilizan los siguientes tipos explícitos:
  - Monetarios/Costos: `Decimal @db.Decimal(12, 2)` (ej. precios, subtotales, IVA).
  - Cantidades/Stocks/Costificación: `Decimal @db.Decimal(12, 3)` o `@db.Decimal(12, 4)` en casos de gran escala para ítems específicos.

---

## 4. CONVENCIONES DE DESARROLLO DE BACKEND

### Estructura de Capas en Backend

- **Controladores (`src/controllers/`)**:
  - Deben nombrarse con el sufijo `.controller.ts`.
  - Capturan el operador del request `req.user` para inyectar su identificador y su `businessId` en los servicios de negocio de forma obligatoria.
- **Servicios (`src/services/`)**:
  - Nombrados con el sufijo `.service.ts`.
  - Si realizan mutaciones múltiples del modelo de datos, deben emplear `prisma.$transaction(async (tx) => { ... })` y pasar dicho objeto `tx` a los métodos internos de los repositorios para garantizar la atonicidad.
- **Repositorios (`src/repositories/`)**:
  - Nombrados con el sufijo `.repository.ts`.
  - Las firmas de los métodos deben prever opcionalmente el cliente de transacción: `async create(data: any, tx?: any)`. Dentro del método se evalúa: `(tx || prisma).modelName.create(...)`.
- **Validadores (`src/validators/`)**:
  - Mapeo de datos entrantes resuelto mediante esquemas de validación Zod.
  - El middleware `validation.middleware.ts` se encarga de interceptar y devolver errores Bad Request automaticos si no coincide el esquema.

### Control de Errores e Invariabilidad

- El backend dispone de la estructura de excepción `AppError` en `src/utils/appError.ts`.
- Se prohibe retornar códigos de error HTTP HTML plano; toda excepción debe derivar en subclases controladas:
  - `BadRequestError` (400)
  - `UnauthorizedError` (401)
  - `ForbiddenError` (403)
  - `NotFoundError` (404)
  - `ConflictError` (409)
  - `InternalServerError` (500)
- Cualquier excepción arrojada es interceptada automáticamente por el middleware centralizado `error.middleware.ts`, imprimiendo logs de advertencia (`logger.warn`) para fallos del cliente u operacionales (HTTP 4xx), y logs críticos (`logger.error`) para problemas internos del código (HTTP 500).

---

## 5. CONVENCIONES DE DESARROLLO DE FRONTEND

La SPA de React debe seguir un enfoque de diseño modular y control estricto de tipos de datos.

### Organización de Código en Frontend

- **Pages (`src/pages/`)**: Contienen las pantallas completas ligadas a las rutas. Deben ser autocontenidas y hacer uso exclusivo de hooks y servicios expuestos.
- **Layouts (`src/layouts/`)**: Plantillas maestras de diseño estructural (ej. `DashboardLayout`). Centralizan barras laterales de navegación dinámica y componentes de barra de herramientas.
- **Services (`src/services/`)**: Capa de cliente API estructurada que utiliza Axios para realizar peticiones HTTP de forma modular (ej. `purchase.service.ts`).
- **Components (`src/components/ui/`)**: Bloques reutilizables sencillos y limpios (botones, inputs, selects).

### React Query y Mutaciones

- La lectura y refresco de catálogos y transacciones se modela enteramente bajo `@tanstack/react-query` usando hooks `useQuery`.
- Las modificaciones (POST, PUT, DELETE) se gobiernan usando `useMutation`.
- _Regla Obligatoria:_ Al concretarse con éxito una mutación (`onSuccess`), se debe llamar explícitamente a `queryClient.invalidateQueries(['nombre_query'])` para forzar la actualización de datos en el cliente.

### Formulación y Validaciones de Interfaz

- Todos los formularios principales se implementan con `react-hook-form` asociado al validador `@hookform/resolvers/zod`.
- Zod valida los campos antes de enviarlos a la API, previniendo incoherencias antes de abandonar el navegador.

---

## 6. AISLAMIENTO MULT-TENANT Y SEGURIDAD (RBAC)

### Regla Fundamental Multi-Tenant

PresuERP es un sistema de tipo SaaS multi-tenant estricto.

- **Verificación Automática:** Ninguna petición frontend debe establecer o enviar la variable `businessId` para crear, editar o eliminar registros de catálogo o movimientos.
- **Bajo el Backend:** El identificador del tenant (`businessId`) es decodificado por `requireAuth` en el middleware del backend desde el Access Token JWT del operador lógico (`req.user.businessId`).
- **Consistencia:** Todo query de búsqueda, conteo o filtrado Prisma debe constar de la restricción `{ where: { ..., businessId } }`.

### Control de Roles y Acceso Dinámico (RBAC)

- Los accesos se controlan dinámicamente mediante el listado de strings de permisos del JWT del usuario.
- En el backend, se implementa mediante `requirePermission('modulo:accion')` en las rutas Express.
- _Bypass Administrator:_ Si el rol del operador (`req.user.role`) es igual al string `'Administrator'`, se concede acceso incondicional salteando el chequeo de permisos detallados por string en el middleware del backend.
- En el frontend, el menú y la navegación se validan dinámicamente contra la función `hasPermission('modulo:accion')` provista por el hook `useAuth()`. Las opciones a las que el operador no tiene permisos asignados son removidas en tiempo de renderizado de la UI.

---

## 7. SISTEMA DE AUDITORÍA Y TRAZABILIDAD (ACTIVITY LOGS)

El ERP guarda registros detallados de todo cambio material del catálogo y movimientos del almacén.

- Al crear, actualizar o realizar eliminaciones físicas o lógicas de entidades críticas (como `Product`, `Purchase`, `StockMovement`), el servicio de negocio invoca ineludiblemente al repositorio de logs `activityLogRepo.log(...)` o inserta directamente en la tabla `activity_logs`.
- Se almacena: `userId`, `businessId`, `entityName`, `entityId`, `actionType` (CREATE, UPDATE, DELETE, etc.), datos previos (`previousValues` en string JSON), y nuevos datos resultantes (`newValues` en string JSON).

---

## 8. REGLAS DE NEGOCIO DEL NEGOCIO INVIOLABLES

Cualquier agente inteligente o desarrollador encargado de intervenir en el ERP debe salvaguardar las siguientes reglas:

1.  **Integridad de Stock Negativo (`allowNegativeStock`)**:
    - Al registrar movimientos en la tabla `Stock` y `StockMovement`, es obligatorio leer los `BusinessSettings` del tenant.
    - Si se intenta restar stock y resulta un acumulado menor a cero, y la variable `allowNegativeStock` está fijada en `false`, la operación **debe fallar arrojando error lógico** y abortando la transacción SQL. No está permitido el bypass manual.
2.  **Recálculos Automáticos de Margen y Precios**:
    - El precio de venta final de un producto (`salePrice`) se calcula mediante la fórmula: `salePrice = purchasePrice * (1 + profitMargin / 100)`.
    - Si el usuario edita el `profitMargin` en el catálogo, debe autocalcularse el `salePrice`. Si edita el `salePrice` directo, el `profitMargin` debe autocalcularse a la inversa.
    - Al aprobarse un pedido de compras, el costo unitario de la compra actualiza automáticamente el costo máster del producto en catálogo (`purchasePrice`) y dispara el recálculo inmediato de su precio de venta final (`salePrice`) respetando su margen guardado.
3.  **Inalterabilidad de Documentos Aprobados**:
    - Los registros de compra (`Purchase`) en estado `'APPROVED'` o `'CANCELLED'` son **históricos e inmutables**. Únicamente los borradores (`status = 'DRAFT'`) pueden ser modificados físicamente.
4.  **Reversión en Cancelaciones**:
    - Si una compra que fue previamente aprobada (`'APPROVED'`) es cancelada (`'CANCELLED'`), el ERP debe automatizar de manera obligatoria la generación de movimientos Kardex inversos (`EXIT`) para regularizar y restar el stock ingresado inicialmente en el depósito respectivo.

---

## 9. FLUJO RECOMENDADO PARA FUTURAS MODIFICACIONES (IA GUIDELINES)

Cualquier IA que interactúe con PresuERP debe operar bajo las siguientes pautas paso a paso:

1.  **Inspección del Esquema de Datos**: Validar toda adición de campos o relaciones en `schema.prisma`. Tras realizar cambios, se debe ejecutar siempre la migración pertinente para mantener sincronizado local.
2.  **Soporte de Interfaces**: Comprobar interfaces en la capa común de definición antes de instanciar consumos de servicios en frontend.
3.  **Inyección del Tenant**: Asegurarse de no transferir variables `businessId` desde componentes de UI de React; la API en backend debe extraer y configurar este valor a partir de los datos seguros de sesión.
4.  **Transaccionabilidad y Auditoría**: Si el nuevo flujo actualiza el catálogo, es forzoso registrar la mutación en el log de actividades del ERP (`ActivityLog`). Si modifica múltiples tablas, debe estar envuelto en un bloque transaccional.
5.  **Alineación Visual de UI**: Los nuevos componentes visuales en la interfaz del cliente deben adherirse a las variables globales de themes definidas (Light, Dark, Slate, etc.) en los estilos CSS globales, y evitar el uso de colores codificados en código duro de forma directa en las etiquetas.

# Estado del documento

Versión del proyecto:

Fecha:

Commit de Git:

Rama analizada:

Última actualización:

Este documento describe el estado del proyecto en el momento de la auditoría.

No debe interpretarse como una especificación funcional futura.

Cualquier cambio en el código deberá reflejarse posteriormente en esta documentación.
