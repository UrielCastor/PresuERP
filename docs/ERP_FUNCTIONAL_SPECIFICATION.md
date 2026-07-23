# ESPECIFICACIÓN FUNCIONAL COMPLETA – PRESUERP SAAS
**Versión de Documento:** 1.0.0  
**Fecha de Emisión:** 12 de Julio, 2026  
**Clasificación:** Confidencial / Arquitectura Interna  

---

## 1. INTRODUCCIÓN Y ALCANCE

Este documento define el comportamiento operativo, las reglas de negocio, las validaciones lógicas, las interfaces de flujo y las integraciones del sistema **PresuERP SaaS**. La especificación tiene por objetivo asegurar la coherencia del desarrollo posterior, estableciendo una única fuente de verdad funcional en el comportamiento multitenant antes de codificar la lógica comercial de los módulos.

El sistema PresuERP se concibe como una plataforma centralizada para múltiples empresas (SaaS), operando con aislamiento lógico absoluto a nivel de datos.

---

## 2. ARQUITECTURA FUNCIONAL Y PRINCIPIO SAAS (MUTITENANCY)

1. **Aislamiento a Nivel Físico y Lógico**: Todo flujo transaccional y consulta al motor relacional debe inicializarse bajo el filtro obligatorio `businessId`.
2. **Propiedad**: Ningún elemento de base de datos puede compartirse entre organizaciones distintas. La colisión de claves candidatas (ej. códigos internos SKU de producto o números de documento de clientes) se evita mediante la combinación indexada exclusiva a nivel base de datos (`businessId + sku` o `businessId + taxId`).
3. **Roles y Permisos Centralizados**: El acceso a cada flujo operativo está regido por la existencia explícita del permiso del módulo en la sesión JWT decodificada del usuario.

---

## 3. ESPECIFICACIÓN DETALLADA POR MÓDULO

---

### MÓDULO 1: Empresas (Tenants)

#### 1. Objetivo del Módulo
Administrar el ciclo de vida comercial e impositivo de las organizaciones registradas dentro de la plataforma (Tenant Management), controlando las credenciales globales y restricciones normativas.

#### 2. Casos de Uso
- Registro inicial de nueva empresa.
- Actualización de información de facturación y datos fiscales.
- Configuración y parametrización de preferencias operativas (moneda, formatos, SMTP).

#### 3. Flujo Completo
1. Un cliente accede al portal de registro corporativo.
2. Ingresa los datos fiscales (Nombre de Empresa, Identificación Tributaria/CUIT/RUT/RFC) y crea la cuenta del Administrador inicial.
3. El sistema valida la no existencia del CUIT/TaxId duplicado en base de datos.
4. Genera de forma transaccional el registro `Business`, los ajustes de visualización (`BusinessSettings`), ajustes tributarios (`FiscalSettings`), puntos de venta por defecto e inicializa los roles del sistema.
5. El sistema entrega la confirmación e inicia sesión automáticamente.

#### 4. Reglas de Negocio
- Cada empresa gestiona sus propios catálogos y depósitos de manera totalmente hermética.
- No se permiten operaciones de venta si el estado de `Business.isActive` es evaluado como `false`.
- El CUIT de la empresa es inmutable tras su almacenamiento de configuración inicial, para preservar el historial de auditorías impositivas.

#### 5. Validaciones
- El campo `taxId` debe corresponder a un formato legal según el país configurado (ej. CUIT de 11 dígitos numéricos en Argentina con dígito verificador válido).
- El email corporativo del emisor debe poseer un patrón de SMTP verificable.

#### 6. Permisos Necesarios
- `settings:write` (Modificación de configuración).
- Acceso reservado únicamente a usuarios con rol `Administrator`.

#### 7. Entidades Involucradas
- `Business`, `BusinessSettings`, `FiscalSettings`, `POSSettings`, `PrintSettings`, `EmailSettings`, `NumberSettings`.

#### 8. Eventos que Genera
- `BUSINESS_REGISTERED`: Disparador para aprovisionar datos base automáticos.
- `BUSINESS_SETTINGS_UPDATED`: Modificación en formatos globales.

#### 9. Auditoría
- Se debe almacenar: Fecha, hora, ID del negocio, usuario operador, acción explícita del cambio en ajustes y valores anteriores/nuevos modificados.

#### 10. Posibles Errores
- `ERR_TAXID_DUPLICATED`: El identificador impositivo de empresa ya se encuentra activo en el SaaS.
- `ERR_SMTP_CONNECTION_FAILED`: Imposibilidad de conectar al servidor SMTP configurado por el cliente.

#### 11. Integraciones Futuras
- Conexión vía API con sistemas nacionales de validación de estatus impositivo fiscal.

#### 12. Impacto sobre Otros Módulos
- Cualquier cambio de estado impositivo en `FiscalSettings` (ej. pasar de Monotributista a Responsable Inscripto) inhabilita o habilita automáticamente tasas aplicadas en el módulo POS y Facturación.

#### 13. Diagrama de Flujo en Texto
```
[Ingreso de CUIT/RUT] -> [Validación de formato] -> [Verificación de existencia en base de datos]
                                                             |
                                      +----------------------+----------------------+
                                      | (Existe)                                    | (No existe)
                                      v                                             v
                              [Error Duplicado]                   [Creación transaccional: Business, Roles, Admin]
                                                                                    |
                                                                                    v
                                                                          [Inicializar Settings 1-1]
```

---

### MÓDULO 2: Usuarios, Autenticación y RBAC

#### 1. Objetivo del Módulo
Controlar el acceso físico y lógico de los colaboradores del ERP, segmentar sus permisos operativos según el Rol asignado y vigilar activamente sus sesiones.

#### 2. Casos de Uso
- Inicio de sesión (Autenticación por contraseña y obtención de accessToken/refreshToken).
- Recuperación de contraseña mediante tokens firmados enviados por email.
- Creación, modificación y bloqueo preventivo de usuarios.

#### 3. Flujo Completo
1. El usuario ingresa email y contraseña.
2. El sistema comprueba su estado activo y que la asociación impositiva (`businessId`) del usuario coincida con una empresa activa.
3. Se compara contra el hash usando bcrypt.
4. Genera e inyecta la cookie http-only con el `refreshToken` y emite el `accessToken` en la respuesta JSON.
5. Si el accessToken expira, el interceptor de Axios realiza llamada al endpoint `/auth/refresh` reactivando la sesión sin alterar la experiencia del usuario.

#### 4. Reglas de Negocio
- La contraseña debe contener requisitos mínimos de complejidad (mínimo 8 caracteres, al menos una mayúscula y un carácter especial).
- Una sesión expira tras transcurrir 15 minutos de inactividad de red si no se actualiza vía Refresh Token.
- Un usuario bloqueado (`isActive == false`) es deslogueado y sus refresh tokens son marcados como `revoked = true` en base de datos inmediatamente.

#### 5. Validaciones
- Formato de entrada de correo electrónico unificado.
- Verificación del dominio impositivo antes de dar acceso.

#### 6. Permisos Necesarios
- `users:read` (Visualizar listado de personal).
- `users:write` (Crear o modificar usuarios).
- `users:delete` (Bloquear accesos corporativos).

#### 7. Entidades Involucradas
- `User`, `Role`, `Permission`, `RolePermission`, `RefreshToken`.

#### 8. Eventos que Genera
- `USER_LOGIN_SUCCESS`: Acceso exitoso.
- `USER_PASSWORD_RESET_REQUEST`: Generación de token de restablecimiento.
- `USER_BLOCKED`: Bloqueo permanente de credenciales.

#### 9. Auditoría
- Registro de IP, fecha/hora y agente de navegación en cada intento fallido de acceso y cambio de clave.

#### 10. Posibles Errores
- `ERR_BAD_CREDENTIALS`: Email o contraseña inválidos.
- `ERR_ACCOUNT_SUSPENDED`: Usuario suspendido por la administración corporativa.
- `ERR_MAX_ATTEMPTS`: Superado el límite de 5 intentos fallidos (Bloqueo temporal de IP por Rate Limiter).

#### 11. Integraciones Futuras
- Autenticación multifactor (2FA) vía TOTP Google Authenticator.

#### 12. Impacto sobre Otros Módulos
- El cambio del rol de un cajero repercute al instante en su capacidad para otorgar descuentos limitados en terminales POS vigentes.

#### 13. Diagrama de Flujo en Texto
```
[Ingreso de Credenciales] -> [Comprobar Usuario Activo] -> [Validar Hashes Bcrypt]
                                     |                             |
                                     | (Inactivo)                  | (Inválido)
                                     v                             v
                        [Error de Cuenta Bloqueada]       [Logger Auditoría Fallida + Error]
                                                                   |
                                                                   v (Válido)
                                                        [Generar JWT + Cookies HTTP-Only]
```

---

### MÓDULO 3: Productos (Catálogo Comercial)

#### 1. Objetivo del Módulo
Administrar los artículos de venta y materias primas del ERP, estructurando su identidad comercial, marcas, jerarquías de categoría e historial de trazabilidad.

#### 2. Casos de Uso
- Alta de producto individual.
- Edición de fichas técnicas de artículo.
- Configuración de códigos de barra alternativos.
- Baja lógica de producto del catálogo de facturación.

#### 3. Flujo Completo
1. El operador ingresa a la planilla de carga de producto.
2. Completa nombre, SKU única del negocio, categoría, subcategoría, marca, barcodes, y carga vínculos de fotos.
3. El sistema valida la no duplicidad del SKU y barcodes dentro del mismo `businessId`.
4. Almacena en la base de datos central.
5. Dispara procesos de mapeo para crear registros de stock vacíos en cada uno de los depósitos activos del negocio.

#### 4. Reglas de Negocio
- No existe el borrado físico de productos que posean transacciones de venta o compra históricas. Se asume baja lógica cambiando el estado a `INACTIVE` o `DRAFT` para resguardar la consistencia de reportes fiscales anteriores.
- Un producto puede poseer múltiples variaciones (talle, color, presentación) representadas bajo SKU diferenciados.
- Cada producto puede registrar múltiples barcodes alternativos (del fabricante, del pack mayorista, etc.).

#### 5. Validaciones
- SKU de formato alfanumérico sin espacios en blanco.
- Categoría y subcategoría deben existir y estar habilitadas bajo la misma empresa receptora.

#### 6. Permisos Necesarios
- `products:read` (Ver catálogo).
- `products:write` (Crear o modificar registros).
- `products:delete` (Baja lógica).

#### 7. Entidades Involucradas
- `Product`, `Category`, `SubCategory`, `Brand`, `Supplier`, `ProductImage`, `ProductBarcode`, `Stock`, `Tax`.

#### 8. Eventos que Genera
- `PRODUCT_CREATED`: Gatillo para asignación de almacenes.
- `PRODUCT_ARCHIVED`: Se marca como inactivo y se descarta de las listas de búsqueda rápida del POS.

#### 9. Auditoría
- Guardar cambio exacto en datos maestros: variación en costos de fabricación sugeridos, modificaciones de SKU de manera unificada y registros en `ActivityLog`.

#### 10. Posibles Errores
- `ERR_SKU_DUPLICATED`: SKU asignada a otro artículo del mismo negocio.
- `ERR_CATEGORY_MISMATCH`: Asignar subcategoría ajena a la categoría principal seleccionada.

#### 11. Integraciones Futuras
- Conexión dinámica con catálogos mayoristas para importación automatizada de productos comerciales via JSON.

#### 12. Impacto sobre Otros Módulos
- Inactivar un producto impide que los cajeros POS lo listen durante los flujos de venta en caja rápida.

#### 13. Diagrama de Flujo en Texto
```
[Formulario Alta Producto] -> [Validar SKU + Barcode Unicidad] -> [Vincular Categoría/Marca]
                                              |
                                              v (Pasa)
                                   [Almacenar en DB (Product)]
                                              |
                                              v
                              [Crear Stocks = 0 en Depósitos]
```

---

### MÓDULO 4: Listas de Precios

#### 1. Objetivo del Módulo
Administrar de manera segmentada e ilimitada los valores de venta al público de los productos, controlando vigencias, promociones específicas y asignaciones por perfil de cliente.

#### 2. Casos de Uso
- Creación de nueva tarifa o catálogo de precios (ej. Minorista, Mayorista 10%, VIP).
- Modificación masiva e incremental de precios de venta (porcentual o absoluta).
- Asignación de lista preestablecida a legajos de clientes particulares.

#### 3. Flujo Completo
1. El usuario administrativo crea una lista identificadora `PriceList` (ej. "Distribuidor").
2. Accede al listado y establece el precio final asignable en `PriceListItem` a cada producto, junto con la cantidad mínima de corte.
3. El sistema sincroniza los valores.
4. Cuando un cliente es asignado en el POS, el sistema re-calcula los montos de la venta activa adoptando esta lista predeterminada.

#### 4. Reglas de Negocio
- Cada negocio debe poseer al menos una lista marcada como `isDefault = true`.
- Los precios almacenados en `PriceListItem.price` deben guardarse con dos decimales de precisión fija.
- Se soporta escala de precios por volumen: un mismo ítem puede tener distintos registros bajo la misma lista determinando variaciones según el valor del campo `minQuantity` (ej. 1 unidad = $100 c/u, de 10 unidades en adelante = $80 c/u).

#### 5. Validaciones
- El valor del precio debe ser un número decimal estrictamente mayor a `0`.
- El campo `minQuantity` no puede ser menor o igual a `0`.

#### 6. Permisos Necesarios
- `products:write` (Administración de precios corporativos).
- El cajero solo puede cambiar la lista durante la venta si posee rol `Supervisor` o superior, o si la configuración global del POS lo habilita explícitamente.

#### 7. Entidades Involucradas
- `PriceList`, `PriceListItem`, `Product`, `Customer`.

#### 8. Eventos que Genera
- `PRICELIST_UPDATED`: Disparador para refrescar caches locales del punto de venta.
- `MASSIVE_PRICE_ADJUSTMENT`: Registro de incremento porcentual masivo.

#### 9. Auditoría
- Almacenamiento continuo en `ActivityLog` de los campos editados en precio histórico para seguimiento de márgenes de beneficio del comercio.

#### 10. Posibles Errores
- `ERR_NO_DEFAULT_PRICELIST`: Intento de deshabilitar la única lista por defecto del negocio.
- `ERR_DUPLICATED_PRICE_RULE`: Regla duplicada para las mismas combinaciones de lista, producto y cantidad mínima.

#### 11. Integraciones Futuras
- Conexión con un actualizador masivo vía planillas de cálculo (intercambio CSV/Excel).

#### 12. Impacto sobre Otros Módulos
- Modificar una lista de precios impacta al instante sobre las devaluaciones/actualizaciones del carro de venta en todas las cajas activas.

#### 13. Diagrama de Flujo en Texto
```
[Selección de Productos] -> [Indicar Cambio % o Monto] -> [Comprobar Vigencia / Rangos]
                                                                    |
                                                                    v
                                                       [Modificar en PriceListItem]
                                                                    |
                                                                    v
                                                     [Invalidar caché POS Activas]
```

---

### MÓDULO 5: Inventario, Stock y Kardex

#### 1. Objetivo del Módulo
Registrar y vigilar las unidades de productos almacenados en los diferentes depósitos, registrando cada ingreso/egreso con trazabilidad total para prevenir faltantes y pérdidas.

#### 2. Casos de Uso
- Auditoría o conteo físico de inventario (Ajuste).
- Obtención del inventario valorizado por depósito.
- Consulta del histórico de movimientos de stock (Kardex).

#### 3. Flujo Completo
1. El operario de depósito abre una sesión de `Inventory` para auditoría física.
2. El sistema recupera el conteo esperado (`systemQuantity`).
3. El operario ingresa la cuenta real contada en estanterías (`physicalQuantity`).
4. Al confirmar la planilla de inventario (`status = SUBMITTED`), el sistema calcula la desviación (`variance`) y actualiza el balance de la tabla `Stock` mediante transacciones atómicas.
5. Registra de forma simultánea un comprobante de tipo `StockMovement` explicando los motivos del reajuste de almacén.

#### 4. Reglas de Negocio
- Todas las salidas del POS disminuyen automáticamente el valor en `Stock.quantity` del depósito seleccionado.
- Si el stock de un producto cruza el umbral definido en `Stock.minAlertLevel`, se dispara un correo y una alerta dirigida al panel del depósito central.
- El costo ponderado del Kardex se calcula en base a las compras documentadas.

#### 5. Validaciones
- No se permiten movimientos de inventario sobre almacenes desactivados.
- Las cantidades a mover deben presentarse con precisión de hasta tres dígitos decimales (ej. `1.150kg`).

#### 6. Permisos Necesarios
- `products:read` (Visualizar stock).
- `products:write` (Efectuar ajustes de inventario).

#### 7. Entidades Involucradas
- `Stock`, `StockMovement`, `Warehouse`, `Product`, `Inventory`, `InventoryItem`.

#### 8. Eventos que Genera
- `STOCK_OUT_ALERT`: Alerta de stock mínimo o quiebre de stock.
- `INVENTORY_AUDIT_SUBMITTED`: Cierre de conteo físico y aplicación de variaciones.

#### 9. Auditoría
- Cada cambio físico de stock registra el usuario responsable, el almacén físico, la causa (ej. Venta Nro X, Remito de Compra Y, Rotura) y las diferencias cuantitativas exactas.

#### 10. Posibles Errores
- `ERR_STOCK_INSUFFICIENT`: Intento de retiro por encima de lo disponible si las ventas sin stock están parametrizadas como prohibidas.

#### 11. Integraciones Futuras
- Integración automática con lectores portátiles industriales PDA con sistema operativo Android.

#### 12. Impacto sobre Otros Módulos
- Si un artículo es reportado con stock crítico, el listado del POS alerta visualmente al cajero para advertir sobre demoras en la entrega física inmediata.

#### 13. Diagrama de Flujo en Texto
```
[Inicio de Auditoría Física] -> [Captura de Inventario Teórico] -> [Carga de Conteo Real]
                                                                            |
                                                                            v
                                                                  [Calcular Desviaciones]
                                                                            |
                                                                            v
                                                                 [Actualizar Fila Stock]
                                                                            |
                                                                            v
                                                                [Crear Fila StockMovement]
```

---

### MÓDULO 6: Depósitos (Warehouses) & Logística

#### 1. Objetivo del Módulo
Administrar los distintos puntos físicos de almacenamiento comercial de la empresa y coordinar la transferencia lógica/física de mercaderías entre ellos.

#### 2. Casos de Uso
- Creación y desactivación de depósitos/sucursales.
- Transferencia de stock entre depósito de origen y destino.
- Confirmación de recepción de envíos logísticos en destino.

#### 3. Flujo Completo
1. Un operario genera un vale de envío inter-sucursal (`WarehouseTransfer`) especificando origen, destino, productos y cantidades.
2. La transferencia queda en estado `PENDING` disminuyendo el stock comprometido.
3. Se despacha el flete lógico, pasando el flag de transferencia a `IN_TRANSIT` (la mercadería sale físicamente del stock disponible del origen, pero no ingresa en el destino).
4. El depósito de destino recibe, inspecciona físicamente y pasa la transferencia a `COMPLETED`.
5. El sistema actualiza el stock real del destino y registra los `StockMovement` correspondientes por entrada y salida.

#### 4. Reglas de Negocio
- Un depósito con transacciones no puede eliminarse de forma física. Pasa a estado `isActive = false`, inhabilitando nuevos movimientos informáticos.
- Una transferencia en estado `IN_TRANSIT` no puede editarse. Solo permite ser confirmada como recibida o cancelada (en este último caso, el stock retorna al depósito de origen de inmediato).
- No se pueden realizar transferencias que tengan como origen y destino el mismo ID de sucursal.

#### 5. Validaciones
- Existencia real de los depósitos activos e identidades de productos válidas.
- Las cantidades a transferir deben estar físicamente disponibles en stock al momento del despacho del camión lógico.

#### 6. Permisos Necesarios
- `settings:write` (Administración de depósitos).
- `products:write` (Creación e inicio de transferencias de inventario).

#### 7. Entidades Involucradas
- `Warehouse`, `WarehouseTransfer`, `WarehouseTransferItem`, `Stock`, `StockMovement`.

#### 8. Eventos que Genera
- `TRANSFER_IN_TRANSIT`: Despacho confirmado.
- `TRANSFER_COMPLETED`: Recepción física parcial o total verificada.

#### 9. Auditoría
- Almacenamiento continuo del log de remitos logísticos, tiempos transcurridos de tránsito inter-sucursal y los usuarios despachantes/receptores.

#### 10. Posibles Errores
- `ERR_TRANSFER_LOOP`: Origen y destino coinciden.
- `ERR_CANCEL_COMPLETED`: Intento de anulación de una transferencia de inventario ya completada y almacenada.

#### 11. Integraciones Futuras
- Conexión vía GPS con plataformas de rastreo vehicular corporativas.

#### 12. Impacto sobre Otros Módulos
- El módulo de compras determina el ingreso lógico al depósito de recepción seleccionado, impactando inmediatamente la disponibilidad comercial disponible para el POS en esa zona.

#### 13. Diagrama de Flujo en Texto
```
[Crear Transferencia] -> [Estado PENDING (Reserva)] -> [Estado IN_TRANSIT (Salida Origen)]
                                                                    |
                                        +---------------------------+---------------------------+
                                        | (Cancelar)                                            | (Confirmar Recepción)
                                        v                                                       v
                         [Retorno de Stock a Origen]                               [Suma Inventario Destino]
                                                                                                |
                                                                                                v
                                                                                       [Estado COMPLETED]
```

---

### MÓDULO 7: Compras y Proveedores

#### 1. Objetivo del Módulo
Administrar los requerimientos de abastecimiento de insumos y mercadería, registrando comprobantes de compra, costos logísticos, cuentas corrientes de proveedores y actualizando precios de venta de manera automatizada.

#### 2. Casos de Uso
- Generación de Órdenes de Compra (OC).
- Remisión y recepción física de productos facturados.
- Seguimiento de Cuentas Corrientes comerciales e históricos de pagos a proveedores.

#### 3. Flujo Completo
1. El sector de compras emite una solicitud `Purchase` en estado `PENDING`.
2. Al recibir la mercadería y la factura del proveedor, se ingresan las cantidades realmente enviadas.
3. Se actualizan las existencias de stock asociadas al depósito receptor.
4. El sistema registra el pasivo en la cuenta corriente del proveedor e incrementa el costo unitario de reposición histórica en los artículos de inventario.
5. De estar configurado en el panel, se aplica un incremento automático proporcional a la lista de venta para retener márgenes de ganancia.

#### 4. Reglas de Negocio
- Las compras admiten recepcciones parciales (el estado de la compra pasa a `PARTIALLY_RECEIVED` y las unidades ingresadas impactan en stock, mientras que el resto queda listado en compras pendientes).
- La anulación de una compra exige revertir el stock de forma atómica. Si no hay suficiente stock físico disponible en el depósito de ingreso para revertir, la acción física queda inhabilitada y el sistema notifica error de conciliación de inventario.

#### 5. Validaciones
- Identificación fiscal del proveedor unificada.
- Montos de compra calculados en base a combinaciones de costo unitario por cantidad, aplicando el desglose impositivo (ej. IVA/Tasas).

#### 6. Permisos Necesarios
- `sales:write` o permiso personalizado de administración de compras corporativas.

#### 7. Entidades Involucradas
- `Purchase`, `PurchaseItem`, `Supplier`, `Warehouse`, `Stock`, `StockMovement`, `Product`.

#### 8. Eventos que Genera
- `PURCHASE_RECEIVED`: Aumento del stock de depósito activo.
- `PURCHASE_CANCELLED`: Operación anulada con reversión de inventarios.

#### 9. Auditoría
- Monitoreo del costo histórico de adquisición y registro de márgenes de variación respecto a las últimas compras asentadas.

#### 10. Posibles Errores
- `ERR_COST_OUT_OF_BOUNDS`: Diferencia de coste ingresada superior al 100% respecto a la última compra registrada (Alerta por presunto error tipográfico de carga).

#### 11. Integraciones Futuras
- Conexión con portales B2B directos de proveedores mayoristas para sincronización automática de costos.

#### 12. Impacto sobre Otros Módulos
- Actualiza el módulo de cuentas de pago a proveedores y repercute de inmediato recalculando la cotización mínima permitida en las listas de distribución del ERP.

#### 13. Diagrama de Flujo en Texto
```
[Ingreso de Orden de Compra] -> [Estado PENDING] -> [Recepción de Remito/Factura]
                                                           |
                                 +-------------------------+-------------------------+
                                 | (Recepción Completa)                              | (Recepción Parcial)
                                 v                                                   v
                       [Stock + Involucrado]                               [Stock = Items Recibidos]
                       [Actualizar Cuenta Fila]                            [Estado PARTIALLY_RECEIVED]
                       [Estado RECEIVED]                                             |
                                                                                     v
                                                                           [A la espera del saldo]
```

---

### MÓDULO 8: Clientes, Cuentas Corrientes y Créditos

#### 1. Objetivo del Módulo
Administrar el legajo de compradores habituales, registrando datos de contacto y facturación, controlando líneas de crédito vigentes y registrando históricamente sus pagos y deudas pendientes.

#### 2. Casos de Uso
- Registro y actualización de ficha de cliente con múltiples direcciones residenciales y fiscales.
- Entrega de adelantos o acreditación de depósitos a su favor.
- Asignación de líneas de crédito máximo autorizado.

#### 3. Flujo Completo
1. Durante una venta en el POS, el cajero registra o selecciona a un cliente `Customer`.
2. Si el cliente opta por pagar mediante el medio de pago "Cuenta Corriente" (Venta a Crédito), el sistema comprueba la disponibilidad en `CustomerAccount.creditLimit`.
3. Valida la transacción.
4. Reduce la línea de crédito disponible y aumenta el balance deudor (`CustomerAccount.balance` en negativo).
5. Cuando el cliente aporta efectivo para cancelar saldo, se genera un comprobante de recibo impositivo asentando el movimiento y restituyendo su capacidad de compra.

#### 4. Reglas de Negocio
- Cada `Customer` puede tener asignado un tipo de listado de precio predeterminado (`defaultPriceListId`), el cual se activa automáticamente al seleccionarse el cliente en la venta.
- Un cliente con deuda superior al tope límite impositivo del ERP no permite procesar ventas en cuenta corriente a menos que sea visado mediante autorización de usuario de rango `Supervisor`.
- El balance financiero se gestiona bajo el tipo `Decimal(12,2)`. Los saldos a favor del comprador se computan positivamente y las deudas en saldo negativo.

#### 5. Validaciones
- Un cliente no puede tener dos fichas asociadas basadas en el mismo valor de identificación fiscal impositivo (CUIT/RUT/RFC).
- El límite de crédito del comprador en valores iniciales debe ser igual o superior a `0`.

#### 6. Permisos Necesarios
- `users:read` (Visualizar deudores corporativos).
- Acceso a transacciones de cobro requiere permisos de caja.

#### 7. Entidades Involucradas
- `Customer`, `CustomerAddress`, `CustomerAccount`, `Sale`, `SalePayment`.

#### 8. Eventos que Genera
- `CREDIT_LIMIT_REACHED`: Deuda roza el máximo límite programado.
- `CUSTOMER_PAYMENT_RECEIVED`: Cobro registrado y acreditado en cuenta corriente.

#### 9. Auditoría
- Track de estados de deudas históricas con sellos de fechas y operaciones de cajeros responsables de conciliaciones bancarias.

#### 10. Posibles Errores
- `ERR_CREDIT_EXCEEDED`: Saldo insuficiente para realizar la transacción corriente.
- `ERR_CUSTOMER_SUSPENDED`: Bloqueado por incumplimiento financiero de pago de facturas.

#### 11. Integraciones Futuras
- Conexión con burós de crédito e informes financieros externos nacionales.

#### 12. Impacto sobre Otros Módulos
- Bloquea la generación de pedidos en depósito central si el cliente presenta morosidad prolongada en sus cuentas.

#### 13. Diagrama de Flujo en Texto
```
[Solicitud de Venta en Cuenta Corriente] -> [Recuperar CustomerAccount] -> [Comprobar Deuda vs Límite]
                                                                                  |
                                            +-------------------------------------+-----------------------------+
                                            | (Supera Límite)                                                   | (Disponible)
                                            v                                                                   v
                                   [Error Límite Excedido]                                            [Validar Operación Venta]
                                   [Requiere login Supervisor]                                                  |
                                                                                                                v
                                                                                                       [Descontar de Cuenta]
```

---

### MÓDULO 9: POS (Punto de Venta Rápido)

#### 1. Objetivo del Módulo
Proporcionar una interfaz web veloz, optimizada y fluida para el checkout en mostrador, compatible con lectores de códigos de barras, que agrupe búsqueda rápida y permita facturaciones segmentadas en múltiples medios de pago simultáneos.

#### 2. Casos de Uso
- Facturación rápida de artículos mediante pistola de código de barras.
- Suspensión de transacciones de compra en marcha (ventas en espera para liberar el mostrador).
- Selección de sucursal/depósito y medios de pago integrados.
- Anulaciones de ventas inmediatas y devoluciones ordenadas.

#### 3. Flujo Completo
1. El cajero abre la pantalla de punto de venta.
2. Lee los códigos de los artículos con la lectora láser.
3. El sistema busca de manera optimizada sobre las tablas configuradas en caché local.
4. El cajero aplica descuentos autorizados, visualiza bonificaciones y selecciona al cliente asociado.
5. Selecciona los métodos de cobro, procesando transacciones integradas de cobro dividido (ej. Efectivo + QR).
6. Presiona completar. El backend asienta la venta `Sale`, actualiza el inventario del depósito asignado, emite los comprobantes tributarios a la impresora y notifica la confirmación.

#### 4. Reglas de Negocio
- No se permite abrir la terminal de venta POS si no existe una sesión de caja (`CashSession`) activa en estado `OPEN` asociada a dicho usuario operador.
- Cada ítem del POS calcula al vuelo: subtotal de unidades, deducciones de descuentos por rol y recargos por tarjeta.
- El cajero de mostrador puede aplicar un descuento de venta máximo global parametrizado según el nivel de jerarquía de su rol corporativo.

#### 5. Validaciones
- Existencia impositiva real del tipo de documento impositivo (Ticket, Factura) y disponibilidad de secuencia correlativa activa en `DocumentSeries` para evitar saltos numéricos en auditoría.
- La suma total liquidada en pagos de cobro dividido debe coincidir exactamente con el valor final liquidado en la venta del carrito.

#### 6. Permisos Necesarios
- `sales:write` (Acceder e interactuar en mostrador de ventas rápidas).

#### 7. Entidades Involucradas
- `Sale`, `SaleItem`, `SalePayment`, `PaymentMethod`, `CashSession`, `Product`, `Customer`, `DocumentType`, `DocumentSeries`.

#### 8. Eventos que Genera
- `SALE_COMPLETED`: Venta consumada e ingresada en las colas del servidor.
- `SALE_SUSPENDED`: Carro guardado en memoria temporal.
- `SALE_REFUNDED`: Devolución parcial o total de la venta con emisión de notas de crédito y reversión del inventario.

#### 9. Auditoría
- Registro de hora milimétrica de cobro, medios, cambios devueltos a clientes, cajero activo y depósito de egreso de mercaderías físicas.

#### 10. Posibles Errores
- `ERR_CASH_SESSION_CLOSED`: Intento de facturación sin sesión de caja activa.
- `ERR_TRANSACTION_PAYMENT_MISMATCH`: Error de suma en cobranza de la venta.

#### 11. Integraciones Futuras
- Conexión vía SDK directo con terminales físicas Mercado Pago Point o POSNET inteligentes.

#### 12. Impacto sobre Otros Módulos
- Disminuye directamente las existencias de stock por depósito a nivel global, y alimenta de manera concurrente los flujos del reporte diario de caja del ERP.

#### 13. Diagrama de Flujo en Texto
```
[Lectura/Carga Item] -> [Validar Existencia / Lista Tarifa] -> [Verificar Estado Sesión Caja]
                                                                        |
                                                                        v (Válida)
                                                             [Configurar Medios Pago]
                                                                        |
                                                                        v
                                                          [Venta Emitida + Stock Limpio]
```

---

### MÓDULO 10: Medios de Pago y Finanzas

#### 1. Objetivo del Módulo
Estructurar y parametrizar las formas de pago admitidas dentro del ERP, controlando surtidos contables por tipo de medio, comisiones financieras asociadas y tiempos de liquidaciones de fondos.

#### 2. Casos de Uso
- Creación de nuevo medio de pago (ej. Transferencia, QR).
- Configuración de recargos / intereses por uso de tarjetas de crédito o descuentos por abono en efectivo.
- Liquidación de fondos de billeteras digitales con estimación de tramos de acreditación.

#### 3. Flujo Completo
1. El administrador da de alta un canal financiero `PaymentMethod` (ej. "Tarjeta de Crédito Visa").
2. Especifica un recargo del 5% (`chargeRate = 0.0500`) y comisión bancaria retenida del 2% (`commissionRate = 0.0200`).
3. Al gestionar un pago con este medio en el POS, el sistema calcula de forma instantánea el valor adicional del recargo al carro de venta.
4. El cajero procesa el cobro.
5. El sistema calcula tanto el dinero que ingresa contablemente, el valor a percibir por el banco y las comisiones descontadas en el reporte final de cierre.

#### 4. Reglas de Negocio
- La sumatoria de tasas (comisiones, recargos y descuentos) se ingresa con precisión decimal de cuatro decimales (`Decimal(5, 4)`).
- Todo pago con medio "Cuenta Corriente" (a crédito) no asume ingresos reales en la caja diaria, sino una facturación en diferido.
- La acreditación de dinero en cuenta bancaria lógica se asocia a la estimación del campo `clearanceDays` (ej. 14 días para fondos con tarjetas).

#### 5. Validaciones
- Los porcentajes de descuento o intereses financieros no pueden ser inferiores a `0` ni superar al valor 1.00 (equivalente a un 100% de aumento/descuento).

#### 6. Permisos Necesarios
- `settings:write` (Parametrización financiera corporativa global).

#### 7. Entidades Involucradas
- `PaymentMethod`, `SalePayment`, `CashMovement`, `CustomerAccount`.

#### 8. Eventos que Genera
- `PAYMENT_METHOD_CREATED`: Habilitar nuevos flujos contables.
- `BREADOWN_COMMISSION_DISCOUNT`: Cálculo de retención fiscal y comisiones bancarias devengadas.

#### 9. Auditoría
- Control de inconsistencias financieras entre lo cobrado digitalmente y lo conciliado de forma manual al cierre de la sesión de caja.

#### 10. Posibles Errores
- `ERR_PAYMENT_METHOD_INACTIVE`: Método elegido deshabilitado temporalmente de mostrador.

#### 11. Integraciones Futuras
- Conexión dinámica con Procesadores de Pagos (MODO, Mercado Pago) por API Webhook automáticos.

#### 12. Impacto sobre Otros Módulos
- Modula las lógicas de arqueo general del ERP y define las deudas activas imputadas en las cuentas corrientes de los clientes deudores.

#### 13. Diagrama de Flujo en Texto
```
[Procesar Pago] -> [Mapeo de comisión y/o recargo de PaymentMethod] -> [Calcular Totales Adicionales]
                                                                                 |
                                                                                 v
                                                                   [Asociar a la Venta (SalePayment)]
                                                                                 |
                                                                                 v
                                                                   [Llenar Registros Cierre Caja]
```

---

### MÓDULO 11: Control de Caja y Arqueo (Shift Management)

#### 1. Objetivo del Módulo
Vigilar las fluctuaciones fisicotransaccionales del dinero del local comercial, requiriendo operaciones controladas de inicio de jornada, depósitos, retiro, diferencias y arqueos.

#### 2. Casos de Uso
- Apertura de turno administrativo de caja con saldo de base.
- Ingreso y egreso manual de caja chica (Gasto de papelería, pago a comisionista).
- Cierre y arqueo integral (Comparación de saldo reportado por sistema contra conteo real).

#### 3. Flujo Completo
1. El operario cajero inicia sesión y abre caja (`openedById`) indicando un saldo contable base en la base de datos central.
2. La base del POS se habilita.
3. Cada venta operada por caja chica incrementa el valor de la sesión contable de forma transaccional.
4. El cajero realiza transferencias o egresos imprevistos por retiros de seguridad (`CashMovement` en OUT) reduciendo su tenencia disponible.
5. Al finalizar, el cajero cierra caja indicando el saldo físico real de efectivo.
6. El sistema calcula la diferencia entre lo sumado vía transacciones y lo asentado real en arqueo, registrando el valor de la inconsistencia financiera y cerrando de inmediato la terminal de venta.

#### 4. Reglas de Negocio
- Ninguno de los usuarios cajeros puede tener más de una sesión de caja abierta al mismo tiempo para evitar cruces financieros.
- El saldo disponible para retiros contables no puede ser negativo; no se pueden forzar retiros manuales que superen los totales de caja vigentes.
- La diferencia de cierre generada es inmutable y no se permite su alteración por parte de los cajeros una vez procesado el arqueo final.

#### 5. Validaciones
- Saldo inicial y final de caja superiores o iguales a `0`.
- El ID de sesión de caja asociado debe pertenecer al cajero y estar registrado en su sucursal dependiente.

#### 6. Permisos Necesarios
- `sales:write` o permisos específicos del cajado diario de transacciones.
- Registrar diferencias elevadas en caja dispara avisos de tipo auditoría restrictiva con roles superiores.

#### 7. Entidades Involucradas
- `CashRegister`, `CashSession`, `CashMovement`, `Sale`, `User`.

#### 8. Eventos que Genera
- `CASH_SESSION_OPENED`: Apertura de sesión financiera comercial.
- `CASH_SESSION_CLOSED`: Registro del arqueo diario corporativo.
- `CASH_SHORTAGE_WARNING`: Saldo físico con faltante de fondos relevante en caja de ventas.

#### 9. Auditoría
- Guardar la secuencia correlativa de retiros manuales de valores y el histórico consolidado de ajustes del turno operativo de mostrador.

#### 10. Posibles Errores
- `ERR_CASH_ALREADY_OPEN`: Sesión previa activa.
- `ERR_WITHDRAWAL_OVERDRAFT`: Retiro de fondos de seguridad por montos mayores a lo recaudado.

#### 11. Integraciones Futuras
- Conexión con contadores físicos digitales de billetes via puerto local USB.

#### 12. Impacto sobre Otros Módulos
- Inhabilita la edición de facturas cobradas en el POS anteriores de esa caja una vez que la caja del día ha sido confirmada como cerrada.

#### 13. Diagrama de Flujo en Texto
```
[Ingreso Apertura de Turno] -> [Crear Fila CashSession (OPEN)] -> [Confirmar Saldo Inicial de Caja]
                                                                           |
                                                                           v
                                                               [Operaciones Venta/Egresos]
                                                                           |
                                                                           v
                                                               [Ingreso de Conteo Real Cierre]
                                                                           |
                                                                           v
                                                             [Calcular Diferencia Arqueo]
                                                                           |
                                                                           v
                                                             [Estado CashSession (CLOSED)]
```

---

### MÓDULO 12: Ventas y Comprobantes Impositivos

#### 1. Objetivo del Módulo
Administrar y controlar la legalidad, emisión y ciclo transaccional de todo comprobante mercantil de salida del ERP (Presupuestos, Facturas de venta nacionales, Remitos logísticos y Notas correctoras de crédito/débito).

#### 2. Casos de Uso
- Transformación de presupuesto digital del cliente a preventa de mostrador.
- Confección de Facturas de Ventas A/B/C u homologables a entes estatales de recaudación.
- Emisión de Notas de Crédito comerciales por devoluciones comerciales de clientes.

#### 3. Flujo Completo
1. El sistema procesa un presupuesto comercial de venta (`status = DRAFT`) a la espera de confirmación.
2. Al consolidarse el pago, la preventa pasa a confirmada. Se lee el correlativo incremental de la tabla `DocumentSeries`.
3. Se asienta la venta `Sale` conteniendo el desglose detallado impositivo.
4. El sistema emite la numeración de ventas e imprime el ticket y remito correspondiente para ser expedido con la mercadería.
5. De generarse una devolución sobre esa compra, se emite una Nota de Crédito impositiva modificando el estado, generando el reembolso financiero exacto e ingresando las mercaderías devueltas al almacén físico de origen.

#### 4. Reglas de Negocio
- La numeración fiscal de facturas del ERP corre bajo estricto incremento secuencial por serie y tipo de comprobante.
- No se permite borrar ninguna venta impositiva confirmada en base de datos. Solo admite el estado anulado mediante Nota de Crédito para mantener consistencia de numeración de cara al fisco.
- Un remito de salida reserva y compromete temporalmente stock del depósito, mientras que la factura formaliza de forma definitiva el egreso del inventario.

#### 5. Validaciones
- Verificación del código impositivo asociado según tipo de cliente.
- Desglose contable automático e indispensable de tasas e impuestos internos devengados.

#### 6. Permisos Necesarios
- `sales:read` (Visualizar historial de exportación contable).
- `sales:write` (Confección y anulación impositiva de facturas).

#### 7. Entidades Involucradas
- `Sale`, `SaleItem`, `DocumentType`, `DocumentSeries`, `Customer`, `User`, `Tax`.

#### 8. Eventos que Genera
- `INVOICE_GENERATED`: Comprobante consolidado.
- `CREDIT_NOTE_ISSUED`: Generación de comprobante anulador e incremento automático de stock por devoluciones físicas de mostrador.

#### 9. Auditoría
- Control exhaustivo en la base de datos de saltos imprevistos en las secuencias de de talonarios de facturación activos.

#### 10. Posibles Errores
- `ERR_SEQUENCE_GAP`: Salto en números correlativos de factura.
- `ERR_TAX_CALCULATION_ERROR`: Diferencias aritméticas en los desgloses impositivos declarados.

#### 11. Integraciones Futuras
- Conexión vía Webhook con servidores AFIP / ARCA (Facturación Electrónica en Argentina).

#### 12. Impacto sobre Otros Módulos
- Actualiza las deudas de clientes de cuenta corriente y determina la valorización fiscal de los reportes impositivos del periodo del ERP.

#### 13. Diagrama de Flujo en Texto
```
[Preventa / Presupuesto] -> [Pago Confirmado] -> [Mapeo de Serie Impositiva DocumentSeries]
                                                           |
                                                           v
                                              [Validar Correlatividad]
                                                           |
                                                           v
                                            [Confección Sale + Items]
                                                           |
                                                           v
                                             [Emitir Comprobante Fiscal]
```

---

### MÓDULO 13: Gestión de Promociones y Descuentos

#### 1. Objetivo del Módulo
Programar, probar y desplegar estrategias promocionales automatizadas en el POS, aplicando desgloses de descuentos basados en cantidades, importes, horarios habituales de poca afluencia y listas de compras preferentes.

#### 2. Casos de Uso
- Configuración de descuentos tipo 2x1 y 3x2.
- Aplicación de descuentos porcentuales directos sobre categorías exclusivas.
- Promociones segmentadas por horarios de venta específicas de locales comerciales (Happy Hours).

#### 3. Flujo Completo
1. El responsable de mercadotecnia crea una campaña dinámica `Promotion` determinando vigencias, locales comerciales que la aceptan y tipo de beneficio (ej. Descuento porcentual).
2. Agrega los artículos seleccionados en la tabla `PromotionItem`.
3. Cuando el POS procesa compras que corresponden al patrón, el motor aplica de forma silenciosa el descuento modificando el valor impositivo del item en la facturación del ticket.
4. Finaliza anotando el monto ahorrado para cálculo de rentabilidad del local.

#### 4. Reglas de Negocio
- Las promociones no son acumulables entre sí de forma automática a menos que la configuración impositiva de la campaña indique lo contrario de forma manual.
- Las promociones respetan sus rangos horarios de vigencia (`startDate` y `endDate`) basados en los husos configurados de la empresa.
- En ofertas tipo "Llevá X y pagá Y", el descuento se aplica automáticamente deduciendo el precio del producto de menor costo unitario del listado cargado en el carro.

#### 5. Validaciones
- Las fechas de inicio deben ser anteriores a la finalización esperada de la campaña.
- Tasas de descuentos no negativas.

#### 6. Permisos Necesarios
- `products:write` (Diseño e inserción de incentivos comerciales de venta).

#### 7. Entidades Involucradas
- `Promotion`, `PromotionItem`, `Product`, `Sale`, `SaleItem`.

#### 8. Eventos que Genera
- `PROMOTION_APPLIED`: Aplicación de descuento en ticket del comercio.
- `CAMPAIGN_EXPIRED`: Cierre cronológico programado de la promoción comercial.

#### 9. Auditoría
- Log de pérdidas operativas calculadas por promociones aplicadas para balances del margen bruto operativo de la empresa.

#### 10. Posibles Errores
- `ERR_PROMO_VIGENCY_OVER`: Intento de cobro con precio de promoción finalizada en mostrador.

#### 11. Integraciones Futuras
- Conexión con portales ecommerce para sincronización omnicanal de promociones comerciales de venta.

#### 12. Impacto sobre Otros Módulos
- Altera la valorización promedio del ticket en el POS y condiciona los reportes contables del área de tesorería y finanzas comerciales.

#### 13. Diagrama de Flujo en Texto
```
[Procesar Carrito POS] -> [Recuperar Promociones Activas por Horario y Sucursal]
                                               |
                                               v
                                [Cruzar SKU de Items de Venta]
                                               |
                                               v
                             [Aplicar Reglas: Combos, 2x1, %]
                                               |
                                               v
                             [Deducir Descuento en Carro Venta]
```

---

### MÓDULO 14: Reportes, Inteligencia de Negocio y Telemetría

#### 1. Objetivo del Módulo
Concentrar y procesar los registros crudos de datos mercantiles del ERP para convertirlos en herramientas de decisión gerencial consolidadas (Márgenes de rentabilidad, stock valorizado, finanzas de caja diaria, deudas activas e impuestos devengados).

#### 2. Casos de Uso
- Exportación del reporte contable de IVA Ventas.
- Visualización de curvas de ventas históricas consolidadas del periodo.
- Reporte detallado del índice de rotación física de inventarios de depósitos.

#### 3. Flujo Completo
1. El usuario gerencial ingresa al menú de reportería y selecciona un tipo de informe (ej. Rentabilidad por Categoría de Artículos) determinando filtros de fechas.
2. El sistema realiza consultas indexadas optimizadas en base de datos.
3. Genera agregaciones sobre totales de venta menos los costos históricos asociados al Kardex.
4. Retorna el resultado estructurado listo para exportar a PDF / Excel.

#### 4. Reglas de Negocio
- La obtención de datos para reportes no modifica bajo ninguna circunstancia el estado de las filas de base de datos (`Read-Only Operations`).
- Los cálculos financieros impositivos deben desglosar el valor neto gravado de las tasas e impuestos indirectos liquidados por el negocio.
- Los reportes financieros históricos se ejecutan considerando exclusivamente facturas y comprobantes cerrados en estado `COMPLETED` para resguardar la exactitud del consolidado definitivo.

#### 5. Validaciones
- Los rangos de fechas de inicio deben ser anteriores o iguales a las fechas de corte seleccionadas en el panel.

#### 6. Permisos Necesarios
- `sales:read` y accesos asociados a perfiles `Supervisor` o `Administrator` exclusivamente.

#### 7. Entidades Involucradas
- Todas las del ERP de forma indirecta, principalmente `Sale`, `Purchase`, `CustomerAccount`, `Stock`, `AuditLog`.

#### 8. Eventos que Genera
- `REPORT_EXPORTED`: Registro de telemetría y descargas del sistema.

#### 9. Auditoría
- Almacenar el usuario operador del sistema que procedió a la exportación de información comercial sensible o reportes de deudores de la empresa.

#### 10. Posibles Errores
- `ERR_REPORT_TIMEOUT`: Exceso de tiempo en búsquedas sobre bases no optimizadas sin índice de segmentación adecuado.

#### 11. Integraciones Futuras
- Conexión dinámica con sistemas de visualización de Inteligencia de Negocios (BI) como Microsoft Power BI.

#### 12. Impacto sobre Otros Módulos
- Módulo nativo de lectura y consulta sin impacto de alteración en stock o cajas activas.

#### 13. Diagrama de Flujo en Texto
```
[Configuración de Filtros e Informe] -> [Verificar Permiso Operario] -> [Consulta Inmutable Indexada]
                                                                                    |
                                                                                    v
                                                                        [Agregación de Valores]
                                                                                    |
                                                                                    v
                                                                        [Conversión a PDF/Excel]
```

---

### MÓDULO 15: Notificaciones, Alertas y Automatización

#### 1. Objetivo del Módulo
Notificar de manera oportuna a través de diversos canales lógicos y correos electrónicos a los equipos designados sobre alertas imprevistas o tareas pendientes urgentes surgidas en el ERP (Stock mínimo, cajas abiertas en exceso, deudas vencidas y transferencias pendientes).

#### 2. Casos de Uso
- Alertas de ruptura de stock asignables a personal de abastecimiento.
- Notificaciones de alarmas imprevistas de cajas diarias abiertas por cajeros ausentes al fin de la jornada comercial.

#### 3. Flujo Completo
1. El backend cuenta con un daemon programado (Worker o Cron Job).
2. Analiza de forma automatizada las existencias físicas en el stock de los productos.
3. Al detectar que un SKU en un depósito cruza su mínimo parametrizado, crea un registro de notificación `Notification` y despacha un correo de advertencia con formato HTML interactivo.
4. El personal visualiza en tiempo real en la barra de tareas de la interfaz web una campana que alerta sobre la situación comercial.

#### 4. Reglas de Negocio
- La marca `isRead` pasa de `false` a `true` al momento del click de visualización en la interfaz por parte del usuario destinatario, estampando la fecha en `readAt`.
- Las notificaciones del sistema expiran automáticamente en pantalla y se archivan tras cumplirse 30 días de su fecha de almacenamiento.
- Una notificación marcada de tipo global para una sucursal se hace visible para todo usuario que contenga permisos vigentes de dicho local.

#### 5. Validaciones
- El formato del mail debe coincidir con estructuras de red válidas para el despacho del SMTP.

#### 6. Permisos Necesarios
- Habilitación del sistema de avisos transparente a nivel de interfaz global.

#### 7. Entidades Involucradas
- `Notification`, `User`, `Business`.

#### 8. Eventos que Genera
- `NOTIFICATION_CREATED`: Nuevo aviso emitido en las colas del ERP.
- `NOTIFICATION_READ`: Registro del fin de la alerta por parte del operador responsable.

#### 9. Auditoría
- Auditoría de los tiempos de confirmación y lectura de las alarmas críticas operativas enviadas al panel del administrador.

#### 10. Posibles Errores
- `ERR_NOTIF_DISPATCH_FAILED`: Envío fallido de mails por error en el servidor SMTP local de la empresa.

#### 11. Integraciones Futuras
- Conexión vía API con avisos instantáneos automáticos de WhatsApp Business.

#### 12. Impacto sobre Otros Módulos
- Modula e incentiva la corrección de errores imprevistos operativos en cajas desatendidas y acelera los remitos lógicos de compras pendientes del negocio.

#### 13. Diagrama de Flujo en Texto
```
[Proceso Crónico / Evento Crítico] -> [Validar Escenario de Alerta] -> [Crear Fila Notification]
                                                                                |
                                                                                v
                                                                    [Disparar Websocket UI]
                                                                                |
                                                                                v
                                                                    [Despacho de Mail SMTP]
```

---

## 4. DIAGRAMAS DE FLUJO EN TEXTO

A continuación, se describen los flujos lógicos definitivos para el desarrollo de los procesos principales del core transaccional del ERP:

### Diagrama 1: Flujo Completo del Carro de Ventas (Checkout POS)
```
          [Cajero escanea códigos barcode de productos]
                             |
                   [Validar SKU en DB]
                             |
         +-------------------+-------------------+
         | (Existe)                              | (No existe)
         v                                       v
[Recuperar PriceListItem]                [Lanzar Notificación y
[Validar Stock en Warehouse]              permitir carga manual]
         |
         v
[¿Hay Stock Disponible?]
         |
         +------- Sí ----------------------------+
         |                                       | No (Configurable)
         v                                       v
[Incorporar a Carrito]                  [¿Permite Stock Negativo?]
         |                                       |
         v                                       +-- Sí -> [Cargar con Advertencia]
[Cruzar Promociones Vigentes]                    |
         |                                       +-- No -> [Error: Denegar Item]
         v
[Seleccionar Cliente] -> (Cargar precios por defecto del cliente)
         |
         v
[Procesar Pago Mixto (Dividir cobros)]
         |
         v
[¿Cobranza cubre Total Venta?]
         |
         +------- Sí ----------------------------+
         |                                       | No
         v                                       v
[Validar Secuencia de Factura]           [Requerir Saldo Faltante]
         |
         v
[Consolidar Venta (Sale)] -> [Actualizar Stock Físico (Stock)] -> [Generar Comprobante Impositivo]
```

### Diagrama 2: Recepción de Mercadería de Compra
```
                   [Llegada de Camión con Pedido]
                                 |
              [Ingreso de Orden de Compra Pendiente]
                                 |
          [Operario inspecciona visualmente cantidades]
                                 |
                [Carga de Unidades Recibidas en ERP]
                                 |
                     [¿Coincide con Esperado?]
                                 |
         +-----------------------+-----------------------+
         | Sí                                            | No
         v                                               v
[Estado: RECEIVED]                              [Estado: PARTIALLY_RECEIVED]
         |                                               |
         +-----------------------+-----------------------+
                                 |
                                 v
        [Procesar Incremento Atómico en Stocks de Destino]
                                 |
             [Generar Fila en StockMovement (IN)]
                                 |
          [Impactar Costos en Lista de Precios e IVA]
                                 |
           [Asentar Cuenta Acreedora en SupplierAccount]
```

### Diagrama 3: Transferencia de Inventario Inter-Sucursales
```
                  [Generación de ticket de envío]
                                 |
          [Seleccionar Almacén Origen y Destino Habilitados]
                                 |
                [Cargar SKU de Artículos e Importes]
                                 |
                     [¿Stock Disponible Origen?]
                                 |
         +-----------------------+-----------------------+
         | Sí                                            | No
         v                                               v
[Estado: PENDING]                               [Denegar Operación]
[Stock Físico -> Reservado]
         |
         v
[Chofer retira mercadería] -> [Estado: IN_TRANSIT] -> [Salida Física de Origen]
                                                             |
                                      +----------------------+----------------------+
                                      | (Furgón cancela en tránsito)                | (Llegada a Destino)
                                      v                                             v
                        [Estado: CANCELLED]                         [Operario Destino Re-cuenta]
                        [Retornar Stock a Origen]                                   |
                                                                                    v
                                                                           [¿Cantidades concuerdan?]
                                                                                    |
                                                          +-------------------------+-------------------------+
                                                          | Sí                                                | No
                                                          v                                                   v
                                                [Estado: COMPLETED]                         [Consolidar Parcial / Ajuste]
                                                [Ingreso Físico en Destino]                 [Diferencia a StockMovement]
```

### Diagrama 4: Apertura de Caja
```
                      [Cajero ingresa al mostrador]
                                   |
                     [¿Tiene Caja Abierta Activa?]
                                   |
         +-------------------------+-------------------------+
         | Sí                                                | No
         v                                                   v
[Denegar Apertura] -> [Re-dirigir a POS]           [Comprobación de Máquina Registradora]
                                                             |
                                                             v
                                                  [Ingreso de Saldo Inicial]
                                                             |
                                                             v
                                                [Crear CashSession (OPEN)]
                                                             |
                                                             v
                                                  [Emitir Logger Auditoría]
```

### Diagrama 5: Cierre de Caja
```
                     [Llegada de Fin de Jornada]
                                  |
              [Ingreso de Conteo Físico Real de Valores]
                                  |
         [Prisma extrae Sumatorias Teóricas de Transacciones]
                                  |
            [Cálculo de Diferencia: Físico vs Sumas ERP]
                                  |
             [¿Arqueo es Exacto (Cero Diferencia)?]
                                  |
         +------------------------+------------------------+
         | Sí                                              | No
         v                                                 v
[Registrar Diferencia = 0]                 [Registrar Diferencia de Caja]
                                           [Si Diferencia > Límite -> Alerta]
                                                           |
         +-------------------------------------------------+
         |
         v
[Pasar Estado a CLOSED] -> [Denegar nuevas operaciones POS] -> [Generar Informe de Cierres]
```

### Diagrama 6: Auditoría de Inventario Físico (Ajustes de Almacén)
```
                  [Apertura de Auditoría de Depósito]
                                  |
                  [Mapeo de Productos Seleccionados]
                                  |
             [Sistema bloquea cambios sobre stock temporal]
                                  |
                 [Ingreso manual de unidades contadas]
                                  |
               [Cálculo de Variaciones (Físico vs DB)]
                                  |
                [Confirmar Operación (SUBMITTED)]
                                  |
            [Actualización de Stocks físicos mediante Transacción]
                                  |
               [Generar Fila de Entrada o Salida en Kardex]
```

### Diagrama 7: Actualización de Precios de Venta
```
                [Selección de Lista de Precios de Destino]
                                  |
               [Configurar Criterio (Individual o Masivo)]
                                  |
          [Indicar Variación (Porcentaje % o Monto Fijo Absolute)]
                                  |
                      [Confirmación de Operador]
                                  |
             [Calcular nuevos precios en PriceListItem]
                                  |
                [Guardar datos históricos en ActivityLog]
                                  |
                 [Invalidar Caché del POS al instante]
```

### Diagrama 8: Ejecución de Cobros Divididos (Pago Mixto)
```
                   [Consolidación del Carrito de Ventas]
                                     |
                         [Solicitud en Caja POS]
                                     |
                       [Indicar importe a abonar]
                                     |
                      [Seleccionar Canal de Cobro 1]
                                     |
                          [¿Cubre Total del Carro?]
                                     |
         +---------------------------+---------------------------+
         | No                                                    | Sí
         v                                                       v
[Registrar Pago Parcial]                                [Registrar Cobro (SalePayment)]
[Actualizar Saldo Pendiente]                            [Cerrar Venta (Sale: COMPLETED)]
         |                                                       |
         v                                                       v
[Repetir para Medio de Pago 2]                         [Generar Comprobantes Fiscales]
```

### Diagrama 9: Compra e Impacto en Cuenta Corriente
```
                       [Establecer Orden de Compra]
                                     |
               [Recepcionar Mercadería (RECEIVED)]
                                     |
                  [Calcular costo total impositivo]
                                     |
                [¿Se cancela la compra en efectivo?]
                                     |
         +---------------------------+---------------------------+
         | No (A cuenta)                                         | Sí (Contado)
         v                                                       v
[Registar Pasivo SupplierAccount]                       [Registrar Salida de Valores]
[Saldo Deudor Incrementado]                             [Afectar Caja Diaria de Pagos]
         |                                                       |
         v                                                       v
[A la espera de Recibo de Pago]                         [Cerrar Compra en Sistema]
```

---

## 5. REGLAS DE NEGOCIO Y CONFIGURACIONES CONFIGURABLES

El ERP deberá responder a las siguientes variables de configuración dinámicas por empresa para alterar los comportamientos de los módulos comerciales:

1. **Gestión de Stock Riguroso (`SELL_WITHOUT_STOCK`)**:
   - *Descripción*: Alternador binario a nivel de local comercial.
   - *Valor true*: Permite la facturación y despacho inmediato de productos de mostrador aun si el inventario contable figura en cero o negativo (Útil en mercerías, locales de alta rotación donde el ingreso de compras físico es anterior a la carga impositiva en el ERP).
   - *Valor false*: Detiene el botón de venta en el POS arrojando error de stock crítico.
2. **Actualización Automática de Costos de Reposición (`AUTO_UPDATE_COSTS`)**:
   - *Descripción*: Vincula los remitos de compra con la ficha técnica del artículo.
   - *Valor true*: Al guardar una compra impositiva, actualiza automáticamente el costo promedio ponderado de producción del artículo a nivel de base de datos.
   - *Valor false*: Registra el comprobante de compra pero mantiene intactos los costos teóricos en catálogo de productos.
3. **Márgenes de Descuentos Máximos en Cajeros (`MAX_DISCOUNT_BY_ROLE`)**:
   - *Descripción*: Matriz de límites porcentuales de descuento sobre carros totales en el terminal POS:
     - Cajero / Operario de Ventas: Máximo 5% de descuento autorizado por ticket.
     - Supervisor de Turno: Máximo 25% de descuento autorizado.
     - Administrador / Gerente: Hasta el 100% (Bonificación total).
4. **Caja Abierta Obligatoria para Vender (`REQUIRE_OPEN_CASH_TO_SELL`)**:
   - *Descripción*: Bloqueador de seguridad física de mostrador.
   - *Valor true*: Cualquier petición de creación al endpoint `/sales` requiere contener un ID de sesión de caja válido y activo.
   - *Valor false*: Permite consolidar ventas administrativas en diferido sin arqueos asociados.
5. **Cierre de Caja Previo al Cambio de Operario (`FORCE_CLOSE_SESSION_ON_LOGOUT`)**:
   - *Descripción*: Control de auditoría que impide dejar turnos desatendidos con dinero físico pendiente.
   - *Valor true*: El cierre de sesión del usuario en la interfaz web obliga a ingresar el conteo real y cerrar el arqueo de valores de caja en el mostrador.

---

## 6. PLAN DE INTEGRACIONES FUTURAS

Para asegurar la flexibilidad evolutiva del ERP sin romper la arquitectura de datos, se detalla el modelado funcional de conectividad externa:

### 1. ARCA / AFIP (Facturación Electrónica en Argentina)
- **Flujo**: Al momento de emitir un ticket de tipo Factura A, B, o C, el backend intercepta el envío y realiza una consulta externa mediante protocolo SOAP/REST a los servidores fiscales utilizando los certificados provistos en `FiscalSettings`.
- **Cierre del Circuito**: Al obtener respuesta exitosa, se graba en los campos de auditoría el CAE (Código de Autorización Electrónico) y la fecha de vencimiento devuelta por el fisco, plasmando estos valores obligatorios en el layout de PDF de impresión automática.

### 2. Mercado Pago / MODO / Plataformas de Pago QR
- **Flujo**: El POS genera una transacción en la API externa del procesador seleccionando el dispositivo Point comercial o solicitando la creación de un QR dinámico inter-operable para pantalla.
- **Cierre del Circuito**: Un Webhook del procesador notifica la acreditación al backend de nuestra plataforma. El ERP asocia los fondos al medio de pago vinculando los identificadores de la transacción directamente sobre el recibo `SalePayment`.

### 3. Impresoras Térmicas y Lectores de Códigos
- **Flujo**: El frontend procesa comandos en texto nativos orientados al protocolo estándar de impresión electrónica ESC/POS (impresión directa en ticketeadoras matriciales térmicas).
- **Lectores**: Utilización masiva de periféricos configurados en modo emulación teclado físico. El frontend dispone de capturadores globales de eventos de teclado (Key Listeners) para concentrar caracteres consecutivos veloces iniciados por gatillos láser.

### 4. Inteligencia Artificial (IA) y Predicción de Compras
- **Flujo**: Modelos análiticos interpretan de manera inmutable el Kardex del ERP para anticiparse a compras de proveedores ideales.
- **Predicciones**: Determinar velocidades promedio de salidas de mercaderías para notificar alertas previas imprevistas de rotura de stocks de cara a periodos estacionales.
