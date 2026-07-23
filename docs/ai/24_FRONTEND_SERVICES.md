# PRESUERP - AI DEVELOPMENT KIT: FRONTEND SERVICES LAYER

Este documento proporciona la especificación técnica y de desarrollo oficial de la **Capa de Servicios de Frontend (API Services)** de **PresuERP**, detallando la configuración del cliente HTTP Axios, los interceptores de inyección JWT, la renovación automática de tokens de refresco, y el tratamiento unificado de errores.

---

## 1. INTRODUCCIÓN GENERAL Y OBJETIVOS

La **Capa de Servicios** representa la única puerta lógica de salida y entrada del cliente React con la API Express del backend.
*   **Encapsulamiento del Cliente**: Queda estrictamente vetada la invocación directa a Axios/Fetch en los componentes React de interfaces de usuario.
*   **Abstracción Transaccional**: Centralizar el tipado TypeScript, el ruteo relativo y el parseo de payloads.

---

## 2. ARQUITECTURA FISICA Y FLUJO DEL NEGOCIO

El ciclo de una llamada a la API por parte del frontend sigue el siguiente esquema de dependencias:

```
[ Formulario / Datatable React ]
               │
               ▼
      [ React Query Hook ]
  (useQuery / useMutation / useAuth)
               │
               ▼
       [ API Service File ] (TypeScript)
 (Ej: services/purchase.service.ts)
               │
               ▼
      [ Axios Client Instance ] (api.ts)
  (Intercepta requests e inyecta JWT)
               │
               ▼
[ Backend Express: /api/v1/* ]
```

---

## 3. INSTANCIACIÓN DE AXIOS Y RENOVACIÓN TRANSPARENTE DE TOKENS

El cliente HTTP reside físicamente en `erp/frontend/src/services/api.ts` y gestiona las siguientes intercepciones de ruteo:

### 1. Interceptor de Petición (Request Injection)
Configura automáticamente la cabecera `Authorization: Bearer <token>` recuperando el token activo en memoria desde el hook de autenticación en cada transacción saliente.

### 2. Interceptor de Respuesta y Autocierre de Expiración (Token Refresh Loop)
*   **Tratamiento del Error 401 (Access Token Expirado)**: Si el backend retorna una respuesta con estado HTTP 401, el interceptor detiene temporalmente la petición de origen.
*   **Llamada al Refresh**: Realiza de forma transparente una llamada POST al endpoint `/api/v1/auth/refresh` enviando la cookie HttpOnly portadora de la llave de refresco.
*   **Reintento Recursivo**: Si el backend responde el nuevo Access Token de corta duración, el interceptor reconfigura la cabecera de la llamada en espera y la ejecuta de nuevo, garantizando que el cajero o supervisor no experimente caídas visuales o pérdida de la sesión activa en el mostrador.
*   **Corte por Vencimiento en Base**: Si el Refresh Token persiste revocado u obsoleto, limpia el estado de `AuthContext` redirigiendo al operador de inmediato hacia `/login` de forma controlada.

---

## 4. MODELO DE COMUNICACIÓN MODULAR RECURRENTE

Cada módulo cuenta con su wrapper correspondiente. Ejemplo real de `purchase.service.ts`:
```typescript
import api from './api';

export interface PurchaseItem {
  productId: string;
  quantity: number;
  unitCost: number;
  discount: number;
}

export const createPurchase = async (purchaseData: any) => {
  const response = await api.post('/purchases', purchaseData);
  return response.data;
};

export const approvePurchase = async (id: string) => {
  const response = await api.post(`/purchases/${id}/approve`);
  return response.data;
};
```

---

## 5. OBSERVACIONES TÉCNICAS Y RIESGOS

1.  **Impedimento de Inyección de Tenants**: Al igual que en la capa de base de datos relacionales, el frontend omite registrar o enviar la variable `businessId` para bloquear accesos cruzados ilegales.
2.  **Alineación de Permisos en la UI**: Al capturar los errores 403 (Forbidden) lanzados por el middleware `requirePermission` del backend, la capa de servicios debe delegar al hook de notificaciones visuales (Toasts) una alerta semántica limpia, previniendo caídas críticas en la UI del operador.
3.  **Conversión Decimal**: Dado que las cantidades y precios se manejan en formato `Decimal` en el backend, la capa de servicios debe asegurarse de normalizar a tipo `number` de Javascript en las respuestas mapeadas a las interfaces de React, evitando errores de renderizado de texto.
