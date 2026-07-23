# PRESUERP - AI DEVELOPMENT KIT: FRONTEND COMPONENT ARCHITECTURE

Este documento proporciona la especificación técnica y de desarrollo oficial de la **Arquitectura de Componentes Frontend** de **PresuERP**, detallando los patrones React/Vite en TypeScript, la estructura del panel visual, la inyección del contexto de seguridad RBAC y la integración con React Query.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

El frontend de PresuERP está estructurado como una Single Page Application (SPA) modular construida en **React**, **Vite** y **TypeScript**.
*   **Separación de Responsabilidades**: Las vistas consumen exclusivamente hooks y wrappers de servicios independientes (`services/`).
*   **Seguridad Visual**: Ocultación dinámica de elementos del menú basada en los permisos del inquilino decodificados en el perfil de usuario.

---

## 2. ARQUITECTURA GENERAL E INFRAESTRUCTURA DE COMPONENTES

El cliente de frontend está organizado físicamente en la carpeta `erp/frontend/src/`:

```
erp/frontend/src/
├── api/             # Interceptores Axios e inicializadores de peticiones
├── components/      # UI Atoms, Inputs, Datatables, Badges
├── contexts/        # Estado global (AuthContext, AppearanceContext)
├── layouts/         # DashboardLayout, AuthLayout, Sidebar
├── pages/           # Vistas principales de módulos (Products, Purchases, Users)
├── routes/          # AppRoutes, ProtectedRoute (RBAC Guard)
├── services/        # Consumo de endpoints Express (purchase.service.ts)
└── utils/           # Formateadores financieros, fechas
```

---

## 3. GOBERNANZA DE RUTAS Y SEGURIDAD FRONTEND (RBAC GUARD)

### 1. `ProtectedRoute` (Guardia de Navegación)
*   Las páginas críticas se envuelven con `ProtectedRoute` en `AppRoutes.tsx`.
*   El componente valida si el token JWT decodificado en `AuthContext` contiene el subpermiso necesario. Si la validación falla, redirige al usuario a la página `/not-found` sin renderizar la estructura interna de la vista.

### 2. Sidebar React Dinámico
*   El panel lateral en `DashboardLayout.tsx` recibe el perfil de permisos desde `useAuth`.
*   El mapeador del menú oculta los botones de acceso a módulos (ejemplo: `/settings`, `/users`) si el operario no posee el string requerido, optimizando la usabilidad del sistema:
```typescript
// Mapeo lógico real en DashboardLayout:
const filteredMenu = menuConfig.filter(item => 
  !item.permission || user.permissions.includes(item.permission) || user.role === 'Administrator'
);
```

---

## 4. ADMINISTRACIÓN DE CACHÉ Y ESTADO GLOBAL

*   **Estado Global**: Gobernado mediante la Context API nativa de React para configuraciones transversales y de sesión (`AuthContext` y `AppearanceContext` para la gestión rápida de temas claros/oscuros).
*   **Caché Asíncrona (React Query)**: Toda petición transaccional que recupere colecciones (ej. lista de productos, existencias de inventario) es absorbida por `@tanstack/react-query` aplicando periodos de refresco y caché para evitar peticiones HTTP redundantes al backend de Express.
*   **Mutaciones**: Los guardados de formularios (ej: creación de ítems en compras) se disparan mediante `useMutation` invalidando las llaves de caché correspondientes para forzar la actualización transparente de las listas.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Diferencia de Nomenclatura**: La nomenclatura de permisos en el frontend de PresuERP utiliza strictly `:` en vez de `.` (ej. `users:read`, `purchases:approve`). Es mandatorio usar este formato en `ProtectedRoute` para evitar bloqueos imprevistos de acceso en producción.
2.  **Responsividad de Tablas Datatables**: Las planillas cargadas con múltiples columnas (ej: tabla de stock detallado por depósito) requieren desbordamientos horizontales controlados en dispositivos móviles compactos para sostener la usabilidad responsive del punto de venta (POS).
3.  **Redirecciones Inactivas en Menú**: Debido a que ciertas opciones del menú (ej: `/sales`) poseen vistas parcialmente vinculadas del lado del frontend, se debe vigilar la correcta redirección a pantallas informativas controladas en lugar de forzar excepciones de ruteo.
