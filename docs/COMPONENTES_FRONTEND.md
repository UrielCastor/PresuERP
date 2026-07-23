# ⚛️ COMPONENTES FRONTEND Y ARQUITECTURA REACT

El frontend de PresuERP es una SPA (React 18 / Vite) fuertemente componenteada mediante el uso de "Atomic Design" con Tailwind CSS.

## 1. RUTAS DEL HILADO PRINCIPAL (`AppRoutes.tsx`)

### `/login` (Auth Route)
Accesible sin autorización. Retiene Token en Cache/HTTPOnly y bifurca contexto hacia ERP o Staff según Payload de roles.

### `/system/*` (Global SaaS Layer)
Inyectadas dentro de `SystemLayout.tsx` (Sin acceso a dependencias del Tenant local).
- `/system/dashboard` ➔ Renderiza KPIs `SystemDashboard.tsx` (MRR, Churn).
- `/system/audit` ➔ Visor JSON y filtro en `SystemAudit.tsx`.
- `/system/settings` ➔ Pasarela Mercado Pago y Conectividad.
- `/system/businesses` ➔ Gestión de Alta/Bajas de Inquilinos de empresas (SaaS Admin).

### `/*` (Multi-Tenant ERP Layer)
Protegidas e Inyectadas dentro de `DashboardLayout.tsx` (Extraen Data solo atada al usuario dueño de empresa operante).
- `/dashboard` ➔ Visor nativo de caja base y rendimiento de tienda.
- `/pos` ➔ Módulo `POS.tsx` independiente sin menús estorbosos para Cajeros Comerciales en hardware nativo.
- `/products`, `/categories`, `/kardex` ➔ Grillas de Inventariado y Catálogo (ABM visuales robustos).
- `/cash` ➔ TTP de cobros (Cajas y Sesiones de ventas).

## 2. COMPONENTES REUTILIZABLES CLAVE (`/components/ui/`)

- `StatCard.tsx`: Elemento KPI de alto impacto (Se utiliza en SaaS Dashboard y ERP). Incluye prop `trend` (positivo/negativo visual).
- `DataGrid.tsx` / `Table.tsx`: Estructura para desplegar listados paginados (Paginación controlada por hooks unificados al store API backend).
- `Modal.tsx` & `ConfirmDialog.tsx`: Ventanas reactivas usando Backdrop Blur en zIndex=50 (para borrado o confirmación doble).
- `FiltersBar.tsx`: Buscadores que mapean QueryParams `?search=&type=` y actualizan fetch Axios local al reaccionar el Hook useEffect.

## 3. CONTEXTOS REACT (`/contexts/`)

- `AuthContext.tsx`: Agente Maestro. Determina en runtime `isStaff` Boolean flag, el rol operativo de la franquicia y expide la función genérica `logout`.
- `AppearanceContext / ThemeContext`: Si se soporta DarkMode e inyección Root variables customizadas de UI CSS.

## 4. DESIGN SYSTEM Y ESTILOS
Reúne constantes sólidas mapeadas por Tailwind:
- `assets/index.css`: Directrices base.
- `/design-system/colors.ts`: Paleta tipificada.
- Integración transparente de `lucide-react` importado de-estructuradamente para empaquetado ultra ligero (Tree-shaking puro por Vite Configs).
