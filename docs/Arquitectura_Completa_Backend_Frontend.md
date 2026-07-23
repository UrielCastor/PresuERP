# 🏗️ Auditoría Arquitectónica y Estructural Integral: PresuERP (SaaS + ERP)

Este documento detalla exhaustivamente cómo está constituido el sistema **PresuERP** a nivel de ingeniería, patrones de diseño, flujos de base de datos y ciclo de vida de peticiones en ambos polos (Backend/Frontend).

---

## 1. 🌐 ECOSISTEMA TECNOLÓGICO (TECH STACK)
**Arquitectura Global:** Monorepo distribuido (Lógicamente separado en `backend` y `frontend`).
**Paradigma:** REST API state-less + SPA (Single Page Application) reactiva.

### ⚙️ BACKEND (Core Engine)
- **Runtime:** Node.js (v20+).
- **Lenguaje:** TypeScript (Tipado estricto).
- **Framework Web:** Express.js.
- **ORM / Capa de Datos:** Prisma (Abstracción Declarativa).
- **Motor de Base de Datos:** PostgreSQL.
- **Seguridad y Cifrado:** bcryptjs (Hashing de contraseñas), JSON Web Tokens (JWT) para sesiones, Helmet, Express-Rate-Limit.
- **Librerías Extra:** Winston / Morgan (Logging), Nodemailer (Comunicaciones), MercadoPago Config v2 (Gateway de Pagos), CORS, Dotenv.

### 🎨 FRONTEND (Capa de Presentación)
- **Runtime de Compilación:** Vite (Embalaje súper rápido, HMR).
- **Core Library:** React 18+ (Hooks, Componentes funcionales).
- **Lenguaje:** TypeScript + TSX.
- **Enrutamiento:** React Router DOM (Manejo de rutas jerárquicas y Layouts anidados).
- **Cliente HTTP:** Axios (con interceptores adjuntos para token refresh y headers de autenticación).
- **Estilos:** Tailwind CSS (Utility-first framework).
- **Iconografía:** Lucide-React.

---

## 2. 🏛️ PATRÓN DE DISEÑO BACKEND (CLEAN ARCHITECTURE)

El backend no acopla la lógica de negocio al ruteador. Emplea un modelo estricto de n-capas (Clean Architecture adaptada) en su carpeta `src`:

1. **`Routes` (`*.routes.ts`)**: Reciben la llamada HTTP bruta. Se insertan Middlewares (Validaciones, JWT Auth, RBAC Admin/Staff) y derivan el control al Controlador.
2. **`Controllers` (`*.controller.ts`)**: Parsean y desestructuran `req.body`, `req.params`, `req.query`, envían excepciones genéricas al envoltorio `NextFunction` e invocan al servicio.
3. **`Services` (`*.service.ts`)**: **El Cerebro**. Operan la Lógica de Negocio estricta (ej. Calcular márgenes, renovar ciclos, aplicar lógicas Multi-Tenant). No tienen idea de qué es HTTP, Request o Response. Envían órdenes al repositorio estructurado.
4. **`Repositories` (`*.repository.ts`)**: Puente agnóstico hacia el ORM (Prisma). Encapsulan las queries densas, los count, transacciones ACID `skip/take` para la DB. Retornan los datasets puros al Servicio.

### Infraestructura Multi-Tenant (Inquilinos Aislados)
El sistema utiliza un enfoque **"Row-Level Logic Isolation"** o **Discriminador de Columna**. Todo en base de datos convive en las mismas 54+ tablas de PostgreSQL, pero el **100% de los modelos transaccionales** (Ventas, Productos, Movimientos, Usuarios) portan la llave foránea `businessId`.
NUNCA el backend cruza información; se inyecta por Middleware `req.user.businessId` en cada capa inferior del Repositorio garantizando inviolabilidad de fronteras.

---

## 3. 🔐 SEGURIDAD, RBAC Y STAFF LAYER

Existen **dos mundos** paramétricos en el control de acceso de la arquitectura:

### A) El Mundo Inquilino (ERP Operativo)
Opera bajo un Sistema **RBAC** (Role-Based Access Control) nativo.
- Tablas: `Role`, `Permission`, `RolePermission`.
- Middlewares Interceptores restringen acceso si tu rol no tiene (por ejemplo) capacidad de transaccionar finanzas.
- Todo atado obligatoriamente a tu `businessId`.

### B) El Mundo Sistema (SaaS Staff / SuperAdmin)
Opera mediante un **Flag de Bypass Global**: `isStaff: true`.
- Los administradores "Dios" del sistema no mapean bajo `businessId` limitante ni roles.
- Utilizan rutas separadas que nacen bajo `/api/v1/system/*`.
- Protegidos por el Middleware `requireSystemAdmin` que verifica la firma secreta de Staff en el JWT.

---

## 4. 🗄️ MAPA ALGEBRAICO DE DATABASE (PRISMA SCHEMA)

Se identifican agrupaciones nucleares (Módulos):

- **[Business / Settings]**: `Business`, `BusinessSettings`, `Tax`, `FiscalSettings`, `PrintSettings`. Controlan el setup de una empresa.
- **[SaaS Billing]**: `Subscription`, `Plan`, `Invoice`, `SystemGatewayConfig`. Controlan la membresía madre, el cobro (Mercado Pago SDK linkeado a Invoices) y Webhooks de renovación autosustentables.
- **[Catálogo y Stock]**: `Product`, `Category`, `Warehouse`, `Stock`, `StockMovement`, `Inventory`. Gestión de Kardex rigurosa.
- **[Flujo de Dinero / TPV]**: `Sale`, `Purchase`, `SalePayment`, `CashRegister`, `CashSession`, `CashMovement`. Auditorías de liquidez.
- **[Monitor Audit]**: `ActivityLog` (Eje del módulo Auditoría que captura silenciosamente todas las transacciones `actionType`, prevValues, newValues y userAgents en todo el flujo del API).

---

## 5. 🖥️ ORGANIZACIÓN DEL FRONTEND (ARQUITECTURA COMPONENTIZADA)

La UI en React emplea **Smart/Dumb Components Concept** y **Compound Layouts**:

### Rutas (En `AppRoutes.tsx`)
Separación radical (Split-Routing) aislando:
1. `(Auth)`: Login / Register públicos.
2. `(System)`: Panel exclusivo SaaS (Membresías, Planes, Invoices, Gateway MP, Config, Audit Dashboard). Empotrados en `SystemLayout.tsx`.
3. `(Tenant)`: Panel ERP comercial (Ventas, Cajas, Productos, Tableros de Negocio, Inventarios). Empotrados en un Layout que inyecta los `Context/Stores` vinculados a un solo negocio.

### UI Library (`/components/ui/`)
Diseño Atómico e instanciable:
- `StatCard`, `PageHeader`, `Card`, `Modal`, `Button`, `Table`.
Toda la interfaz mantiene consistencia de estandarización visual. Se prescinde de librerías costosas estilo Material-UI o AntDesign para mantener un *Bundle Size* ínfimo gracias a clases puras de Tailwind compiladas al vuelo.

### Peticiones API (`/services/api.ts`)
Única instancia generadora mutante vía Axios:
- Mantiene los prefijos `/api/v1`.
- Captura automáticamente 401/403 intentando refrescar el `RefreshToken` contra la base de datos de manera silenciosa, proveyendo al usuario una navegación sin interrupciones abruptas de sesión caducada.

---

## 6. 💸 CICLO DE VIDA: PASARELA DE PAGOS Y SUSCRIPCIONES
Desacople perfecto para integraciones limpias.

1. Al dar de alta un `Business`, el *BusinessService* auto-inscribe una `Subscription` en el plan base (FREE).
2. Un Staff solicita **Cobrar** desde el front. Petición va a `/system/payments/create-preference`.
3. **Billing Controller** levanta el API de Mercado Pago validando credenciales asadas en `SystemGatewayConfig`, forma una pre-`Invoice` en base de datos.
4. Genera `pref.id` y devuelve *Checkout URL*.
5. Cliente cursa el pago. Sistema MP apela silenciosamente de retorno al `/system/payments/webhook`.
6. Sin intervención humana, se procesa la `Invoice`, muta a state `PAID`, se regenera el timestamp futuro del tenant y se estampan los logs. *Transacción Completada*.

---

## 7. 🛡️ SISTEMA DE RASTREO Y SEGURIDAD (AUDITORÍA)
1. Nada escapa al `ActivityLog`.
2. Las consultas del backend limitan el arrastre de registros implementando paginación total.
3. El `AuditService` inyecta en el loop un despachador recursivo localizador de Strings. Si localiza una cadena en un JSON anidado que contenga `Token`, `Password`, `Webhook` o variantes, lo eclipsa en tiempo real con asteriscos antes del `Return` a la API HTTP. Nunca hay vulnerabilidad de filtración de claves.

---

## CONCLUSIÓN FINAL DEL ESTADO DEL PROYECTO
- **Deuda Técnica:** Baja. La segregación de caprichos ha erradicado enmarañamientos de Controladores gigantes (*Fat Controllers*).
- **Escalabilidad:** Alta. Puedes escalar las bases de datos transaccionales, o puedes conectar n-GatewayPayments extendiendo `BillingController`.
- **Rendimiento:** El backend opera de manera stateless (sin estado in-memory), es 100% horizontalmente escalable vía PM2 o Docker Containers. El Frontend compila a ~1MB Gzippeado.
