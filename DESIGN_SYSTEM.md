# 🎨 PresuERP - Design System & Master Layout Documentation

Este documento establece el **Sistema de Diseño Oficial y la Arquitectura Visual Maestra** de PresuERP. Todos los módulos (Dashboard, POS, Ventas, Compras, Productos, Clientes, Caja, Reportes, Configuración) deben adherirse estrictamente a esta guía para garantizar una experiencia SaaS uniforme, elegante y profesional.

El **Módulo de Caja Financiera (`Cash.tsx`)** es el módulo de referencia estándar para toda la aplicación.

---

## 1. 📐 Ley de Layout Maestro (Estructura Unificada)

Todas las pantallas de PresuERP deben organizarse siguiendo exactamente el siguiente orden jerárquico de 5 zonas:

```
────────────────────────────────────────────────────────────────────────────────
1. ZONA DE CABECERA (Header Bar)
   - Título Principal (PageHeader) + Subtítulo explicativo
   - Badges Contextuales de Estado (Ej. Caja Abierta, Sucursal Principal)
   - Botonera Superior de Acciones Principales y Secundarias

2. ZONA DE HERO KPIS (Indicadores Clave de Desempeño)
   - Grilla de 4 a 5 tarjetas numéricas financieras/operativas
   - Icono representativo, valor principal en tipografía Monospaced, subtítulo y borde de acento

3. ZONA DE FILTROS AGRUPADOS (Filter Card)
   - Tarjeta contenedora única (`Card`) con buscador amplio (Search)
   - Desplegables de filtrado (`Select`), rango de fechas y botón de limpieza limpia

4. ZONA DE CONTENIDO PRINCIPAL (DataTable / Grilla / Timeline)
   - Tabla moderna con cabecera sticky, alto de fila confortable, hover sutil
   - Badges estandarizados de estado y botones de acción compactos con aria-label

5. ZONA DE MODALES Y PANELES SECUNDARIOS
   - Formulario compacto de entrada con componentes ui/* estandarizados
────────────────────────────────────────────────────────────────────────────────
```

---

## 2. 🎨 Filosofía de Color y Semántica

PresuERP utiliza una base **sobria, neutra y limpia** basada en tonos slate/grises sobre fondos blancos o dark mode slate-900. El color **nunca se utiliza de forma meramente decorativa**, sino para comunicar estado e información funcional de un vistazo:

| Rol Semántico | Color Primario | Color Fondo / Badge | Caso de Uso |
| :--- | :--- | :--- | :--- |
| **Neutral / Baseline** | `slate-900` / `slate-100` | `slate-50` / `slate-800` | Estructura general, texto, bordes y tarjetas neutras. |
| **Éxito (Success)** | `emerald-600` / `emerald-400` | `emerald-50` / `emerald-950` | Transacciones completadas, caja abierta, stock óptimo, cobros positivos. |
| **Advertencia (Warning)** | `amber-600` / `amber-400` | `amber-50` / `amber-950` | Cierre Z pendiente, stock bajo, borradores, diferencias de caja. |
| **Error / Peligro (Danger)** | `rose-600` / `rose-400` | `rose-50` / `rose-950` | Comprobantes anulados, faltante de caja, eliminar registros, egresos manuales. |
| **Información / Digital** | `indigo-600` / `indigo-400` | `indigo-50` / `indigo-950` | Cobros digitales, tarjetas, reportes, botones primarios de acción. |

---

## 3. 📏 Grilla Espacial y Radios de Borde (Grid de 8px)

PresuERP utiliza una escala espacial estricta basada en múltiplos de 8px:

- **Espaciados Internos (Padding)**:
  - Tarjetas principales / Modales: `p-5` (20px) o `p-6` (24px).
  - Tarjetas secundarias / KPIs: `p-4` (16px).
  - Celdas de tabla: `px-5 py-3.5` (14px/20px).
- **Brechas (Gaps)**:
  - Entre tarjetas KPI / Grillas: `gap-3.5` (14px) o `gap-4` (16px).
  - Entre secciones principales: `space-y-6` (24px).
- **Radios de Borde (Border Radius)**:
  - Contenedores / Modales / Tarjetas principales: `rounded-2xl` (16px).
  - Inputs / Selects / Botones / Badges: `rounded-xl` (12px) o `rounded-lg` (8px).
  - Chips / Badges redondos: `rounded-full`.

---

## 4. 🔤 Tipografía y Números Financieros

- **Fuente Principal**: Inter / Sans-serif (`font-sans`).
- **Títulos de Pantalla**: `text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight`.
- **Valores Financieros / Montos**: Siempre utilizar tipografía monoespaciada (`font-mono font-black` o `font-mono font-bold`) formateados en ARS mediante `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.

---

## 5. 🧩 Especificaciones de Componentes del Design System

### A. Botones (`Button.tsx`)
- **Variantes**: `primary` (Índigo), `secondary`, `success` (Esmeralda), `danger` (Rosa/Rojo), `warning` (Ámbar), `outline`, `ghost`.
- **Comportamiento**: Transiciones de 150ms, estado disabled con cursor prohibido, spinner de carga `isLoading`.

### B. Campos de Entrada (`Input.tsx` y `Select.tsx`)
- **Placeholders**: Nunca inicializar campos numéricos mostrando `0` precargado; utilizar `placeholder="0.00"` o `placeholder="0"`.
- **Iconos Integrados**: Sostenidos mediante la propiedad `leftIcon`.
- **Borde de Focus**: `focus:ring-2 focus:ring-primary-500 focus:outline-none`.

### C. Tarjetas de KPI (`Card` / `StatCard`)
- Borde lateral semántico de 4px (`border-l-4 border-l-[color]`).
- Fondo con gradiente sutil (`from-[color]/10 to-transparent`).
- Subtítulo descriptivo en la parte inferior.

### D. Tablas de Datos (`DataTable.tsx` / `Table`)
- Cabecera sticky con fondo `bg-slate-50 dark:bg-slate-950` y texto en mayúsculas `text-xs font-semibold uppercase text-slate-500`.
- Filas con efecto hover `hover:bg-slate-50/80 dark:hover:bg-slate-800/50`.
- Paginación estandarizada en el pie de tabla.

---

## 6. 🎬 Micro-animaciones

- **Duración Estándar**: `150ms - 220ms` (`transition-all duration-200`).
- **Interacciones Hover**: Elevación ligera (`hover:-translate-y-0.5`), escalado táctil (`active:scale-[0.98]`).
- **Pulso de Estado**: `animate-pulse` para indicadores de sesión activa o cajas abiertas.

---

## 7. ♿ Accesibilidad y Estándares WCAG

- **Navegación por Teclado**: Anillos de foco visibles mediante `focus-visible:ring-2`.
- **Iconos Sin Texto**: Todos los botones que contengan únicamente un icono deben incluir el atributo `aria-label` descriptivo.
- **Contraste Mínimo**: Cumplimiento del ratio WCAG AA (mínimo 4.5:1) en textos y badges.
