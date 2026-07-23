# 📡 ENDPOINTS API REFERENCE ACTUAL

## MÓDULO AUTH (`/api/v1/auth`)
| Método | Ruta | Descripción | Permisos (Middleware) |
|---|---|---|---|
| POST | `/login` | Resuelve credenciales y emite jwt + refresh cookie. | Público |
| POST | `/refresh` | Renueva Access Token silenciosamente en UI. | Requiere RefreshCookie |
| GET | `/me` | Retorna claims incrustadas del tenant Auth payload. | Usuario Autenticado (`requireAuth`) |

## MÓDULO SYSTEM / SAAS ADMIN (`/api/v1/system`)
| Método | Ruta | Descripción | Permisos |
|---|---|---|---|
| GET | `/dashboard` | Retorna Revenue MRR, Subscripciones, ARR global. | `requireSystemAdmin` (Sólo Staff) |
| GET | `/audit` | Query paginada y filtrada al ActivityLog global centralizado. | `requireSystemAdmin` |
| PATCH | `/businesses/:id/activate` | Revive/habilita un Tenant suspendido del uso de red. | `requireSystemAdmin` |
| POST | `/payments/create-preference` | Fabrica Checkout Pro MP link para Invoice SaaS. | `requireSystemAdmin` |
| POST | `/payments/webhook` | Webhook de MP para acreditar PAGO, regenerar Subs y disparar Email. | IP SDK Externa Pública (Validación interna HMAC) |

## MÓDULO ERP (Punto de Venta) (`/api/v1/pos` | `/api/v1/sales`)
| Método | Ruta | Descripción | Permisos (RBAC Roles) |
|---|---|---|---|
| POST | `/pos` | Inyecta y consolida ticket facturación y rebaja de stock automática (Kardex). | App User + `SALES_CREATE` Role |
| GET | `/sales` | Trae DataGrid con filtrado avanzado per Business ID. | App User + `SALES_VIEW` Role |

## MÓDULO CATÁLOGO (`/api/v1/products` etc)
| Método | Ruta | Descripción | Permisos |
|---|---|---|---|
| GET | `/products` | Lista ítems para ventas. | App User (`PRODUCTS_VIEW`) |
| POST | `/products` | Crea un artículo anclado a `businessId` limitante. | App User (`PRODUCTS_CREATE`) |
| PUT | `/products/:id` | Modificación de valores / precios. | App User (`PRODUCTS_UPDATE`) |

## MÓDULO COMPRAS (`/api/v1/purchases`)
| Método | Ruta | Descripción | Permisos |
|---|---|---|---|
| POST | `/purchases` | Genera una orden de adquisición entrante. Incremente Bodegas. | App User + `PURCHASES_CREATE` |
| GET | `/purchases/:id` | Visualiza detalle de costo total, proveedor. | App User + `PURCHASES_VIEW` |

*(Listado simplificado para fines de Auditoría de Endpoints macro-funcionales)*
