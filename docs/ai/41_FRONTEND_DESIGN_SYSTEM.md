# PRESUERP - AI DEVELOPMENT KIT: FRONTEND DESIGN SYSTEM

Este documento proporciona la especificación técnica y de desarrollo oficial del **Sistema de Diseño del Frontend (Design System)** de **PresuERP**, detallando los tokens de estilos en CSS Vanilla, la tipografía corporativa, los botones base del panel visual, y las pautas responsive.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

PresuERP prioriza una estética visual de calidad enterprise.
*   **Consistencia de Marca**: Definir esquemas temáticos estructurados a través de propiedades variables CSS Vanilla (`:root`), bloqueando el uso de paletas de colores informales sin concordancia CSS.
*   **Reutilización UI**: Reducir el tamaño general de la aplicación empaquetada forzando la reutilización de componentes atómicos de UI y limitando estilos inline.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El flujo de renderizado visual se estructura en cascada:

```
[ Variables CSS Unificadas (:root) ] (index.css)
                 │
                 ▼
[ Componentes de UI Base (Atoms) ] (components/ui/)
  (Button, Input, Select, Modal, Table)
                 │
                 ▼
[ Layouts Estructurales / Sidebar ] (layouts/)
                 │
                 ▼
[ Páginas de Negocio del Sistema ] (pages/)
```

---

## 3. TOKENS DE DISEÑO VISUAL (CSS VARIABLES SPEC)

Los estilos se gobiernan en `erp/frontend/src/index.css` a través de variables unificadas en cascada:

```css
:root {
  /* Paleta de Colores Primaria */
  --primary-color: #1e3a8a;      /* Azul Corporativo */
  --primary-hover: #1e40af;
  --secondary-color: #4b5563;    /* Gris Neutral */
  --secondary-hover: #374151;
  --accent-color: #0d9488;       /* Teal */
  
  /* Estados de Negocio */
  --color-success: #10b981;      /* Verde */
  --color-danger: #ef4444;       /* Rojo */
  --color-warning: #f59e0b;      /* Amarillo */
  --color-info: #3b82f6;
  
  /* Fuentes */
  --font-family: 'Inter', sans-serif;
  --border-radius: 6px;
}
```

---

## 4. BIBLIOTECA DE COMPONENTES ATÓMICOS DESEADOS

Los componentes comunes se registran bajo `components/ui/` para homogeneizar comportamientos interactivos (Hover, Active):

### 1. `Button` (`components/ui/Button.tsx`)
Acepta variantes de tipado rígido: `variant: 'primary' | 'secondary' | 'danger' | 'success' | 'outline'`. Bloquea la inyección de clases CSS inline ad-hoc para diseño de botones comunes.

### 2. `DataTable` (`components/ui/Table.tsx`)
Implementa las cabeceras comunes, ordenamiento, indicadores de progreso loading integrados, y desbordamientos horizontales fluidos adecuados para visualización en teléfonos móviles.

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Alineación de Columnas de Tenants**: La columna configurada físicamente en el motor PostgreSQL se llama strictly `businessId`. No debe codificarse bajo el concepto `tenantId` en la arquitectura de CSS ni en los parámetros generales para evitar desvíos en el tipado de TypeScript.
2.  **Doble Aspecto Clásico/Oscuro (Dark Mode)**: El cambio de modo estético se opera agregando una clase al body html (`dark-theme`) gobernada por `AppearanceContext.tsx`. Es imperativo que cada componente implemente sus estilos utilizando las propiedades de las variables CSS de origen para evitar que queden textos oscuros ilegibles sobre fondos grises en modo noche.
3.  **Seguridad de Operarios**: Las consultas de usuarios del repositorio omiten el envío del hash de clave (`password`) en las selecciones ordinarias, derivando la validación del hash exclusivamente a las rutinas internas del login local en `AuthRepository`.
4.  **Bypass de System Roles**: Los roles bootstrapping (`isSystem = true`) no permiten re-programación de nombre o remoción física para prevenir que fallas operativas de base de datos alteren la inicialización básica de los inquilinos.
