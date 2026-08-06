export interface CapabilitySeed {
  id: string;
  name: string;
  description: string;
  module: string;
  type: 'VIEW' | 'OPERATIVE' | 'CRITICAL';
  technicalPermission: string;
}

export const defaultCapabilities: CapabilitySeed[] = [
  // 1. DASHBOARD
  { id: 'dashboard.view', name: 'Ver Dashboard principal', description: 'Permite visualizar métricas generales, ventas y alertas', module: 'Dashboard', type: 'VIEW', technicalPermission: 'reports:read' },

  // 2. CAJA
  { id: 'cash.view', name: 'Ver caja', description: 'Permite consultar el estado y saldo de la caja actual', module: 'Caja', type: 'VIEW', technicalPermission: 'cash:view' },
  { id: 'cash.open', name: 'Abrir caja', description: 'Permite iniciar un turno o sesión de caja con fondo inicial', module: 'Caja', type: 'OPERATIVE', technicalPermission: 'cash:open' },
  { id: 'cash.close', name: 'Cerrar caja', description: 'Permite realizar el cierre de caja (Z) y arqueo físico', module: 'Caja', type: 'CRITICAL', technicalPermission: 'cash:close' },
  { id: 'cash.income', name: 'Registrar ingreso manual', description: 'Permite ingresar dinero en efectivo a la caja', module: 'Caja', type: 'OPERATIVE', technicalPermission: 'cash:movement' },
  { id: 'cash.expense', name: 'Registrar egreso / retiro', description: 'Permite declarar retiros o egresos de efectivo de la caja', module: 'Caja', type: 'OPERATIVE', technicalPermission: 'cash:movement' },
  { id: 'cash.transfer', name: 'Transferencia entre cajas', description: 'Permite transferir fondos entre distintas cajas activas', module: 'Caja', type: 'OPERATIVE', technicalPermission: 'cash:movement' },
  { id: 'cash.reopen', name: 'Reabrir caja cerrada', description: 'Permite reabrir una sesión de caja ya cerrada para correcciones', module: 'Caja', type: 'CRITICAL', technicalPermission: 'cash:close' },
  { id: 'cash.movement', name: 'Movimientos de caja (Genérico)', description: 'Permite declarar egresos e ingresos manuales de efectivo', module: 'Caja', type: 'OPERATIVE', technicalPermission: 'cash:movement' },
  { id: 'cash.cancel', name: 'Anular movimientos de caja', description: 'Permite anular o revertir transacciones manuales de caja', module: 'Caja', type: 'CRITICAL', technicalPermission: 'cash:close' },
  { id: 'cash.print', name: 'Imprimir comprobante de caja', description: 'Permite imprimir arqueos y reportes fisicos de caja', module: 'Caja', type: 'OPERATIVE', technicalPermission: 'cash:view' },
  { id: 'cash.export', name: 'Exportar movimientos de caja', description: 'Permite exportar planilla de caja a Excel o PDF', module: 'Caja', type: 'OPERATIVE', technicalPermission: 'cash:view' },
  { id: 'cash.audit', name: 'Auditoría de caja', description: 'Permite consultar el historial completo de sesiones y arqueos de caja', module: 'Caja', type: 'CRITICAL', technicalPermission: 'cash:audit' },

  // 3. POS / VENTAS
  { id: 'sales.view', name: 'Ver modulo POS / Ventas', description: 'Permite ingresar al punto de venta POS y consultar ventas', module: 'POS / Ventas', type: 'VIEW', technicalPermission: 'sales:read' },
  { id: 'sales.create', name: 'Realizar ventas', description: 'Permite cobros en punto de venta y emisión de tickets', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.change_customer', name: 'Cambiar cliente en POS', description: 'Permite seleccionar o cambiar el cliente asignado al ticket', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.change_seller', name: 'Cambiar vendedor asignado', description: 'Permite cambiar el vendedor responsable de la comisión', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.change_price', name: 'Modificar precio unitario manual', description: 'Permite cambiar precios unitarios manualmente en la venta', module: 'POS / Ventas', type: 'CRITICAL', technicalPermission: 'sales:write' },
  { id: 'sales.change_margin', name: 'Modificar margen en POS', description: 'Permite ajustar el porcentaje de margen en la venta', module: 'POS / Ventas', type: 'CRITICAL', technicalPermission: 'sales:write' },
  { id: 'sales.change_quantity', name: 'Modificar cantidad de ítems', description: 'Permite cambiar las cantidades de artículos cargados al ticket', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.delete_item', name: 'Quitar ítem del ticket', description: 'Permite eliminar líneas de productos agregadas a la venta', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.discount', name: 'Aplicar descuentos', description: 'Permite aplicar descuentos manuales o promociones en el POS', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.rounding', name: 'Aplicar redondeo en ticket', description: 'Permite redondear el total a cobrar en efectivo', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.points', name: 'Canjear puntos de fidelidad', description: 'Permite aplicar puntos acumulados como forma de pago', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.account', name: 'Venta a Cuenta Corriente', description: 'Permite fiar o enviar el saldo a la cuenta corriente del cliente', module: 'POS / Ventas', type: 'CRITICAL', technicalPermission: 'sales:write' },
  { id: 'sales.payment_cash', name: 'Cobro en efectivo', description: 'Permite seleccionar cobro por billete/efectivo', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.payment_card', name: 'Cobro con tarjeta crédito/débito', description: 'Permite registrar cobros posnet o tarjeta', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.payment_transfer', name: 'Cobro por transferencia', description: 'Permite cobros bancarios', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.payment_mp', name: 'Cobro por QR / MercadoPago', description: 'Permite cobrar vía pasarela MercadoPago', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.cancel', name: 'Anular ventas', description: 'Permite cancelar o anular ventas procesadas previamente', module: 'POS / Ventas', type: 'CRITICAL', technicalPermission: 'sales:cancel' },
  { id: 'sales.return', name: 'Procesar devoluciones', description: 'Permite generar notas de crédito y devolución de mercadería', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.reprint', name: 'Reimprimir comprobantes', description: 'Permite volver a imprimir tickets o facturas emitidas', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:read' },
  { id: 'sales.open_drawer', name: 'Abrir cajón sin venta', description: 'Permite enviar comando de apertura a la impresora fiscal', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'cash:open' },
  { id: 'sales.close', name: 'Cierre rápido POS', description: 'Permite finalizar el turno directo del POS', module: 'POS / Ventas', type: 'OPERATIVE', technicalPermission: 'sales:write' },
  { id: 'sales.history', name: 'Consultar historial de ventas', description: 'Permite ver el historial de ventas procesadas', module: 'POS / Ventas', type: 'VIEW', technicalPermission: 'sales:read' },

  // 4. CLIENTES
  { id: 'customers.view', name: 'Ver clientes', description: 'Permite consultar la lista e historial de clientes', module: 'Clientes', type: 'VIEW', technicalPermission: 'customers:read' },
  { id: 'customers.create', name: 'Crear clientes', description: 'Permite registrar nuevos clientes en el sistema', module: 'Clientes', type: 'OPERATIVE', technicalPermission: 'customers:write' },
  { id: 'customers.edit_basic', name: 'Editar datos básicos cliente', description: 'Permite modificar razón social, CUIT y tipo fiscal', module: 'Clientes', type: 'OPERATIVE', technicalPermission: 'customers:write' },
  { id: 'customers.edit_contact', name: 'Editar contacto cliente', description: 'Permite cambiar teléfono, email y dirección física', module: 'Clientes', type: 'OPERATIVE', technicalPermission: 'customers:write' },
  { id: 'customers.edit_price_list', name: 'Cambiar lista de precio asignada', description: 'Permite asignar tarifa especial al cliente', module: 'Clientes', type: 'OPERATIVE', technicalPermission: 'customers:write' },
  { id: 'customers.edit_credit_limit', name: 'Modificar límite de crédito', description: 'Permite cambiar el tope de saldo para fiar', module: 'Clientes', type: 'CRITICAL', technicalPermission: 'customers:write' },
  { id: 'customers.edit_balance', name: 'Ajustar saldo cta cte cliente', description: 'Permite cargar débitos/créditos manuales en la cuenta', module: 'Clientes', type: 'CRITICAL', technicalPermission: 'customers:write' },
  { id: 'customers.edit_points', name: 'Ajustar saldo de puntos', description: 'Permite modificar los puntos acumulados del cliente', module: 'Clientes', type: 'OPERATIVE', technicalPermission: 'customers:write' },
  { id: 'customers.edit_observations', name: 'Editar observaciones cliente', description: 'Permite cambiar las notas o anotaciones del cliente', module: 'Clientes', type: 'OPERATIVE', technicalPermission: 'customers:write' },
  { id: 'customers.update', name: 'Editar cliente (Obsoleto)', description: 'Permite modificar fichas e información de clientes', module: 'Clientes', type: 'OPERATIVE', technicalPermission: 'customers:write' },
  { id: 'customers.delete', name: 'Eliminar clientes', description: 'Permite eliminar registros de clientes', module: 'Clientes', type: 'CRITICAL', technicalPermission: 'customers:write' },
  { id: 'customer_balance.view', name: 'Ver saldos de clientes', description: 'Permite consultar saldos y créditos disponibles', module: 'Clientes', type: 'VIEW', technicalPermission: 'customers:read' },
  { id: 'customer_account.view', name: 'Ver cuenta corriente', description: 'Permite consultar el estado de cuenta corriente', module: 'Clientes', type: 'VIEW', technicalPermission: 'customers:read' },
  { id: 'customer_account.adjust', name: 'Ajustar saldo cuenta corriente', description: 'Permite aplicar notas de crédito o débitos manuales', module: 'Clientes', type: 'CRITICAL', technicalPermission: 'customers:write' },

  // 5. PRODUCTOS
  { id: 'products.view', name: 'Ver catálogo de productos', description: 'Permite consultar la lista de productos y precios', module: 'Productos', type: 'VIEW', technicalPermission: 'products:read' },
  { id: 'products.create', name: 'Crear productos', description: 'Permite dar de alta nuevos productos en el catálogo', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:create' },
  { id: 'products.edit_name', name: 'Editar nombre del producto', description: 'Permite modificar el nombre/descripción comercial', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'products.edit_description', name: 'Editar descripción detallada', description: 'Permite modificar la ficha detallada del artículo', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'products.edit_barcode', name: 'Editar código de barras / SKU', description: 'Permite cambiar código EAN o SKU interno', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'products.edit_supplier', name: 'Editar proveedor asignado', description: 'Permite cambiar el proveedor habitual del artículo', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'products.edit_category', name: 'Editar categoría / rubro', description: 'Permite recategorizar el producto', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'products.edit_brand', name: 'Editar marca', description: 'Permite cambiar la marca asociada al producto', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'products.edit_unit', name: 'Editar unidad de medida', description: 'Permite cambiar la unidad (Kg, Un, Mts)', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'products.edit_cost', name: 'Campo sensible: Editar costo', description: 'Permite cambiar el costo de reposición del producto', module: 'Productos', type: 'CRITICAL', technicalPermission: 'products:update' },
  { id: 'products.edit_margin', name: 'Campo sensible: Editar margen', description: 'Permite cambiar el porcentaje de ganancia proyectado', module: 'Productos', type: 'CRITICAL', technicalPermission: 'products:update' },
  { id: 'products.edit_price', name: 'Campo sensible: Editar precio', description: 'Permite cambiar el precio final de venta al público', module: 'Productos', type: 'CRITICAL', technicalPermission: 'products:update' },
  { id: 'products.edit_tax', name: 'Campo sensible: Editar IVA', description: 'Permite modificar la alícuota de impuesto (21%, 10.5%)', module: 'Productos', type: 'CRITICAL', technicalPermission: 'products:update' },
  { id: 'products.edit_stock_min', name: 'Editar stock mínimo', description: 'Permite cambiar el umbral de alerta de reposición', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'products.edit_image', name: 'Editar imagen del producto', description: 'Permite subir o cambiar la foto ilustrativa', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'products.activate', name: 'Activar producto', description: 'Permite habilitar productos para la venta', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'products.deactivate', name: 'Desactivar producto', description: 'Permite pausar productos sin borrarlos', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'products.update', name: 'Editar productos (Obsoleto)', description: 'Permite modificar precios, descripción y datos de productos', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'products.cost.update', name: 'Modificar costos de compra (Obsoleto)', description: 'Permite cambiar costos de reposición de artículos', module: 'Productos', type: 'CRITICAL', technicalPermission: 'products:update' },
  { id: 'products.delete', name: 'Eliminar productos', description: 'Permite eliminar físicamente productos del catálogo', module: 'Productos', type: 'CRITICAL', technicalPermission: 'products:delete' },
  { id: 'products.import', name: 'Importar productos masivo', description: 'Permite cargar planillas Excel/CSV de productos', module: 'Productos', type: 'CRITICAL', technicalPermission: 'products:create' },
  { id: 'products.export', name: 'Exportar catálogo', description: 'Permite descargar el catálogo de productos a Excel', module: 'Productos', type: 'OPERATIVE', technicalPermission: 'products:read' },

  // 6. LISTAS DE PRECIOS
  { id: 'price_lists.view', name: 'Ver listas de precios', description: 'Permite consultar tarifas y listas registradas', module: 'Listas de Precios', type: 'VIEW', technicalPermission: 'products:read' },
  { id: 'price_lists.create', name: 'Crear listas de precios', description: 'Permite crear nuevas listas de precios o tarifas', module: 'Listas de Precios', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'price_lists.edit_name', name: 'Editar nombre de lista', description: 'Permite renombrar o modificar el tipo de tarifa', module: 'Listas de Precios', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'price_lists.edit_items', name: 'Editar ítems de la lista', description: 'Permite modificar los valores individuales por artículo', module: 'Listas de Precios', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'price_lists.update', name: 'Editar listas de precios (Obsoleto)', description: 'Permite modificar precios asignados a listas', module: 'Listas de Precios', type: 'OPERATIVE', technicalPermission: 'products:update' },
  { id: 'price_lists.delete', name: 'Eliminar listas de precios', description: 'Permite eliminar listas de precios no predeterminadas', module: 'Listas de Precios', type: 'CRITICAL', technicalPermission: 'products:delete' },
  { id: 'price_lists.mass_update', name: 'Actualización masiva de listas', description: 'Permite aplicar incrementos o descuentos en lote', module: 'Listas de Precios', type: 'CRITICAL', technicalPermission: 'products:update' },
  { id: 'price_lists.export', name: 'Exportar lista de precios', description: 'Permite descargar la lista de precios a Excel/PDF', module: 'Listas de Precios', type: 'OPERATIVE', technicalPermission: 'products:read' },

  // 7. CATEGORÍAS
  { id: 'categories.view', name: 'Ver categorías', description: 'Permite consultar la estructura de rubros y categorías', module: 'Categorías', type: 'VIEW', technicalPermission: 'categories:read' },
  { id: 'categories.create', name: 'Crear categorías', description: 'Permite registrar nuevos rubros o familias de productos', module: 'Categorías', type: 'OPERATIVE', technicalPermission: 'categories:create' },
  { id: 'categories.update', name: 'Editar categorías', description: 'Permite modificar nombres y parámetros de familias', module: 'Categorías', type: 'OPERATIVE', technicalPermission: 'categories:update' },
  { id: 'categories.delete', name: 'Eliminar categorías', description: 'Permite dar de baja categorías de productos', module: 'Categorías', type: 'CRITICAL', technicalPermission: 'categories:delete' },

  // 8. PROVEEDORES
  { id: 'suppliers.view', name: 'Ver proveedores', description: 'Permite consultar la lista e historial de proveedores', module: 'Proveedores', type: 'VIEW', technicalPermission: 'suppliers:read' },
  { id: 'suppliers.create', name: 'Crear proveedores', description: 'Permite dar de alta nuevos proveedores', module: 'Proveedores', type: 'OPERATIVE', technicalPermission: 'suppliers:create' },
  { id: 'suppliers.edit_basic', name: 'Editar datos básicos proveedor', description: 'Permite cambiar razón social y CUIT de proveedores', module: 'Proveedores', type: 'OPERATIVE', technicalPermission: 'suppliers:update' },
  { id: 'suppliers.edit_contact', name: 'Editar contacto proveedor', description: 'Permite cambiar teléfono y correo de proveedores', module: 'Proveedores', type: 'OPERATIVE', technicalPermission: 'suppliers:update' },
  { id: 'suppliers.edit_balance', name: 'Ajustar saldo cuenta corriente proveedor', description: 'Permite cargar saldos o pagos manuales a proveedores', module: 'Proveedores', type: 'CRITICAL', technicalPermission: 'suppliers:update' },
  { id: 'suppliers.update', name: 'Editar proveedores (Obsoleto)', description: 'Permite modificar fichas e información de proveedores', module: 'Proveedores', type: 'OPERATIVE', technicalPermission: 'suppliers:update' },
  { id: 'suppliers.delete', name: 'Eliminar proveedores', description: 'Permite eliminar registros de proveedores', module: 'Proveedores', type: 'CRITICAL', technicalPermission: 'suppliers:delete' },

  // 9. DEPÓSITOS / SUCURSALES
  { id: 'warehouses.view', name: 'Ver depósitos y sucursales', description: 'Permite consultar la red de depósitos y puntos fisicos', module: 'Depósitos', type: 'VIEW', technicalPermission: 'warehouses:read' },
  { id: 'warehouses.create', name: 'Crear depósitos', description: 'Permite dar de alta nuevas sucursales o depósitos', module: 'Depósitos', type: 'OPERATIVE', technicalPermission: 'warehouses:create' },
  { id: 'warehouses.edit', name: 'Editar parámetros de depósito', description: 'Permite cambiar nombre, dirección y código de sucursal', module: 'Depósitos', type: 'OPERATIVE', technicalPermission: 'warehouses:update' },
  { id: 'warehouses.update', name: 'Editar depósitos (Obsoleto)', description: 'Permite modificar parámetros de depósitos', module: 'Depósitos', type: 'OPERATIVE', technicalPermission: 'warehouses:update' },
  { id: 'warehouses.delete', name: 'Eliminar depósitos', description: 'Permite desactivar o eliminar depósitos', module: 'Depósitos', type: 'CRITICAL', technicalPermission: 'warehouses:delete' },

  // 10. INVENTARIO Y STOCK
  { id: 'stocks.view', name: 'Ver stock', description: 'Permite consultar saldos físicos de stock por depósito', module: 'Inventario', type: 'VIEW', technicalPermission: 'stocks:read' },
  { id: 'stocks.adjust', name: 'Ajustar stock', description: 'Permite modificar directamente el saldo físico de inventario', module: 'Inventario', type: 'CRITICAL', technicalPermission: 'stocks:update' },
  { id: 'stocks.inventory', name: 'Carga de toma de inventario', description: 'Permite registrar inventario físico por auditoría', module: 'Inventario', type: 'CRITICAL', technicalPermission: 'stocks:update' },
  { id: 'stocks.cost', name: 'Ver y editar costos en stock', description: 'Permite alterar la valuación del inventario cargado', module: 'Inventario', type: 'CRITICAL', technicalPermission: 'stocks:update' },
  { id: 'stocks.costs', name: 'Ver costos de inventario', description: 'Permite visualizar costos de reposición y márgenes', module: 'Inventario', type: 'VIEW', technicalPermission: 'stocks:update' },
  { id: 'stocks.export', name: 'Exportar inventario', description: 'Permite descargar el saldo físico en Excel', module: 'Inventario', type: 'OPERATIVE', technicalPermission: 'stocks:read' },
  { id: 'stocks.import', name: 'Importar ajustes masivos', description: 'Permite actualizar saldos físicos masivos por planilla', module: 'Inventario', type: 'CRITICAL', technicalPermission: 'stocks:update' },
  { id: 'stocks.transfer', name: 'Traspaso rápido entre depósitos', description: 'Permite mover stock entre depósitos directos', module: 'Inventario', type: 'OPERATIVE', technicalPermission: 'stocks:update' },

  // 11. KARDEX
  { id: 'kardex.view', name: 'Ver kardex de movimientos', description: 'Permite consultar el libro diario de entradas y salidas de stock', module: 'Kardex', type: 'VIEW', technicalPermission: 'kardex:read' },
  { id: 'kardex.export', name: 'Exportar kardex', description: 'Permite descargar el historial de Kardex en PDF, Excel o CSV', module: 'Kardex', type: 'OPERATIVE', technicalPermission: 'kardex:export' },

  // 12. COMPRAS
  { id: 'purchases.view', name: 'Ver órdenes de compra', description: 'Permite consultar compras a proveedores', module: 'Compras', type: 'VIEW', technicalPermission: 'purchases:read' },
  { id: 'purchases.create', name: 'Crear compras', description: 'Permite ingresar órdenes de compra a proveedores', module: 'Compras', type: 'OPERATIVE', technicalPermission: 'purchases:create' },
  { id: 'purchases.edit_supplier', name: 'Editar proveedor en compra', description: 'Permite modificar el proveedor emisor de la orden', module: 'Compras', type: 'OPERATIVE', technicalPermission: 'purchases:update' },
  { id: 'purchases.edit_items', name: 'Editar ítems en compra', description: 'Permite modificar las líneas o cantidades compradas', module: 'Compras', type: 'OPERATIVE', technicalPermission: 'purchases:update' },
  { id: 'purchases.edit_prices', name: 'Editar costos de compra', description: 'Permite cambiar los costos pactados con el proveedor', module: 'Compras', type: 'CRITICAL', technicalPermission: 'purchases:update' },
  { id: 'purchases.edit_discount', name: 'Editar bonificación de compra', description: 'Permite modificar descuentos aplicados al total', module: 'Compras', type: 'OPERATIVE', technicalPermission: 'purchases:update' },
  { id: 'purchases.edit_observations', name: 'Editar observaciones compra', description: 'Permite modificar las notas de la compra', module: 'Compras', type: 'OPERATIVE', technicalPermission: 'purchases:update' },
  { id: 'purchases.update', name: 'Editar borrador de compras (Obsoleto)', description: 'Permite modificar órdenes de compra pendientes', module: 'Compras', type: 'OPERATIVE', technicalPermission: 'purchases:update' },
  { id: 'purchases.approve', name: 'Aprobar compras', description: 'Permite confirmar la recepción e ingresar stock', module: 'Compras', type: 'CRITICAL', technicalPermission: 'purchases:approve' },
  { id: 'purchases.cancel', name: 'Cancelar compras', description: 'Permite anular órdenes de compra y revertir stock', module: 'Compras', type: 'CRITICAL', technicalPermission: 'purchases:cancel' },
  { id: 'purchases.delete', name: 'Eliminar borrador de compra', description: 'Permite borrar registros de órdenes de compra borrador', module: 'Compras', type: 'CRITICAL', technicalPermission: 'purchases:cancel' },
  { id: 'purchases.receive', name: 'Marcar recepción parcial', description: 'Permite recepcionar parciales de mercadería', module: 'Compras', type: 'OPERATIVE', technicalPermission: 'purchases:update' },
  { id: 'purchases.export', name: 'Exportar órdenes de compra', description: 'Permite descargar compras a PDF/Excel', module: 'Compras', type: 'OPERATIVE', technicalPermission: 'purchases:read' },

  // 13. LOGÍSTICA Y TRASPASOS
  { id: 'logistics.dashboard.view', name: 'Ver dashboard de logística', description: 'Permite ver resumen ejecutivo de solicitudes y tránsito', module: 'Logística', type: 'VIEW', technicalPermission: 'stocks:read' },
  { id: 'logistics.request.view', name: 'Ver pedidos internos', description: 'Permite consultar solicitudes de abastecimiento', module: 'Logística', type: 'VIEW', technicalPermission: 'transfer_requests:read' },
  { id: 'logistics.request.create', name: 'Crear pedidos internos', description: 'Permite generar solicitudes de stock entre depósitos', module: 'Logística', type: 'OPERATIVE', technicalPermission: 'transfer_requests:create' },
  { id: 'logistics.request.edit', name: 'Editar pedidos internos', description: 'Permite cambiar ítems y cantidades en solicitudes borrador', module: 'Logística', type: 'OPERATIVE', technicalPermission: 'transfer_requests:update' },
  { id: 'logistics.request.update', name: 'Editar pedidos propios (Obsoleto)', description: 'Permite modificar solicitudes en borrador (DRAFT)', module: 'Logística', type: 'OPERATIVE', technicalPermission: 'transfer_requests:update' },
  { id: 'logistics.request.send', name: 'Enviar pedidos a aprobación', description: 'Permite enviar solicitudes borrador a estado PENDING', module: 'Logística', type: 'OPERATIVE', technicalPermission: 'transfer_requests:send' },
  { id: 'logistics.request.approve', name: 'Aprobar solicitudes', description: 'Permite autorizar pedidos de abastecimiento recibidos', module: 'Logística', type: 'CRITICAL', technicalPermission: 'transfer_requests:approve' },
  { id: 'logistics.request.reject', name: 'Rechazar solicitudes', description: 'Permite denegar pedidos de abastecimiento', module: 'Logística', type: 'CRITICAL', technicalPermission: 'transfer_requests:reject' },
  { id: 'logistics.request.cancel', name: 'Cancelar solicitudes', description: 'Permite anular pedidos de abastecimiento activos', module: 'Logística', type: 'CRITICAL', technicalPermission: 'transfer_requests:update' },
  { id: 'logistics.transfer.view', name: 'Ver traspasos de stock', description: 'Permite consultar los documentos de despacho y transporte', module: 'Logística', type: 'VIEW', technicalPermission: 'transfers:read' },
  { id: 'logistics.transfer.create', name: 'Crear traspasos', description: 'Permite generar documentos de movimiento entre depósitos', module: 'Logística', type: 'OPERATIVE', technicalPermission: 'transfers:create' },
  { id: 'logistics.transfer.prepare', name: 'Preparar mercadería', description: 'Permite marcar ítems listos para embalar en origen', module: 'Logística', type: 'OPERATIVE', technicalPermission: 'transfers:prepare' },
  { id: 'logistics.transfer.dispatch', name: 'Despachar mercadería', description: 'Permite autorizar salida física e impactar Kardex origen', module: 'Logística', type: 'CRITICAL', technicalPermission: 'transfers:dispatch' },
  { id: 'logistics.transfer.receive', name: 'Recibir mercadería', description: 'Permite registrar recepción física e ingresar al Kardex destino', module: 'Logística', type: 'OPERATIVE', technicalPermission: 'transfers:receive' },
  { id: 'logistics.transfer.cancel', name: 'Cancelar traspasos', description: 'Permite anular traspasos antes o durante el despacho', module: 'Logística', type: 'CRITICAL', technicalPermission: 'transfers:create' },

  // 14. USUARIOS Y SEGURIDAD
  { id: 'users.view', name: 'Ver usuarios', description: 'Permite consultar el listado de usuarios de la empresa', module: 'Usuarios y Seguridad', type: 'VIEW', technicalPermission: 'users:read' },
  { id: 'users.create', name: 'Crear usuarios', description: 'Permite dar de alta nuevos usuarios y asignar roles', module: 'Usuarios y Seguridad', type: 'OPERATIVE', technicalPermission: 'users:write' },
  { id: 'users.update', name: 'Editar usuarios', description: 'Permite modificar datos, contraseñas y roles de usuarios', module: 'Usuarios y Seguridad', type: 'OPERATIVE', technicalPermission: 'users:write' },
  { id: 'users.delete', name: 'Eliminar usuarios', description: 'Permite dar de baja usuarios de la empresa', module: 'Usuarios y Seguridad', type: 'CRITICAL', technicalPermission: 'users:delete' },
  { id: 'roles.manage', name: 'Gestionar roles y capacidades', description: 'Permite configurar la matriz de capacidades de cada rol', module: 'Usuarios y Seguridad', type: 'CRITICAL', technicalPermission: 'users:write' },

  // 15. CONFIGURACIÓN GRANULAR
  { id: 'settings.view', name: 'Ver menú configuración', description: 'Permite acceder al panel general de ajustes', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.general.view', name: 'Ver datos generales de empresa', description: 'Consulta razón social y CUIT de la empresa', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.general.update', name: 'Modificar datos generales', description: 'Edita razón social y datos fiscales básicos', module: 'Configuración', type: 'CRITICAL', technicalPermission: 'settings:write' },
  { id: 'settings.preferences.view', name: 'Ver preferencias generales', description: 'Consulta zona horaria y moneda principal', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.preferences.update', name: 'Modificar preferencias', description: 'Edita preferencias regionales y comportamiento global', module: 'Configuración', type: 'OPERATIVE', technicalPermission: 'settings:write' },
  { id: 'settings.fiscal.view', name: 'Ver configuración AFIP / Fiscal', description: 'Consulta certificados y condición IVA', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.fiscal.update', name: 'Modificar configuración fiscal', description: 'Edita certificados AFIP y parámetros de facturación', module: 'Configuración', type: 'CRITICAL', technicalPermission: 'settings:write' },
  { id: 'settings.operation.view', name: 'Ver parámetros operativos', description: 'Consulta políticas de venta y stock', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.operation.update', name: 'Modificar parámetros operativos', description: 'Edita reglas de stock negativo y límites de crédito', module: 'Configuración', type: 'OPERATIVE', technicalPermission: 'settings:write' },
  { id: 'settings.print.view', name: 'Ver formatos de impresión', description: 'Consulta plantillas de comprobantes y tickets', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.print.update', name: 'Modificar formatos de impresión', description: 'Edita diseñadores y plantillas de impresión', module: 'Configuración', type: 'OPERATIVE', technicalPermission: 'settings:write' },
  { id: 'settings.email.view', name: 'Ver configuración de correo SMTP', description: 'Consulta servidores de salida de email', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.email.update', name: 'Modificar credenciales SMTP', description: 'Edita servidor y claves de correo corporativo', module: 'Configuración', type: 'CRITICAL', technicalPermission: 'settings:write' },
  { id: 'settings.numbering.view', name: 'Ver talonarios y numeración', description: 'Consulta puntos de venta y secuenciadores', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.numbering.update', name: 'Modificar talonarios y correlativos', description: 'Edita secuencias numéricas de comprobantes', module: 'Configuración', type: 'CRITICAL', technicalPermission: 'settings:write' },
  { id: 'settings.inventory.view', name: 'Ver parámetros de inventario', description: 'Consulta alertas de rotación y reglas de deposito', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.inventory.update', name: 'Modificar reglas de inventario', description: 'Edita criterios de costeo y alertas stock', module: 'Configuración', type: 'OPERATIVE', technicalPermission: 'settings:write' },
  { id: 'settings.system.view', name: 'Ver datos de versión y sistema', description: 'Consulta versión del motor ERP', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.system.update', name: 'Modificar mantenimiento del sistema', description: 'Ejecuta limpieza de cachés y tareas de mantenimiento', module: 'Configuración', type: 'CRITICAL', technicalPermission: 'settings:write' },
  { id: 'settings.appearance.view', name: 'Ver temas y apariencia', description: 'Consulta paleta de colores y logos corporativos', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.appearance.update', name: 'Modificar temas y marca', description: 'Edita logos, membretes y esquemas visuales', module: 'Configuración', type: 'OPERATIVE', technicalPermission: 'settings:write' },
  { id: 'settings.security.view', name: 'Ver políticas de seguridad', description: 'Consulta vencimiento de claves y requisitos 2FA', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.security.update', name: 'Modificar políticas de seguridad', description: 'Edita expiración de sesiones y restricciones IP', module: 'Configuración', type: 'CRITICAL', technicalPermission: 'settings:write' },
  { id: 'settings.integrations.view', name: 'Ver llaves de API e integraciones', description: 'Consulta webhooks e integraciones activas', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.integrations.update', name: 'Modificar tokens y webhooks', description: 'Genera credenciales de API y webhooks', module: 'Configuración', type: 'CRITICAL', technicalPermission: 'settings:write' },
  { id: 'settings.admin.view', name: 'Ver consola de administración', description: 'Consulta logs de configuración', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:read' },
  { id: 'settings.admin.update', name: 'Modificar parámetros avanzados', description: 'Edita flags globales de empresa', module: 'Configuración', type: 'CRITICAL', technicalPermission: 'settings:write' },
  { id: 'settings.pos.view', name: 'Ver configuración de POS', description: 'Consulta parámetros del punto de venta', module: 'Configuración', type: 'VIEW', technicalPermission: 'settings:pos:read' },
  { id: 'settings.pos.update', name: 'Configurar POS', description: 'Permite modificar comportamiento del punto de venta', module: 'Configuración', type: 'OPERATIVE', technicalPermission: 'settings:pos:write' },
  { id: 'settings.pos.discounts', name: 'Configurar regla de descuentos POS', description: 'Permite definir topes de descuento en POS', module: 'Configuración', type: 'OPERATIVE', technicalPermission: 'settings:pos:write' },
  { id: 'settings.pos.points', name: 'Configurar programa de puntos', description: 'Permite definir relación de canje de puntos', module: 'Configuración', type: 'OPERATIVE', technicalPermission: 'settings:pos:write' },
  { id: 'settings.pos.payments', name: 'Configurar medios de pago POS', description: 'Habilita o deshabilita tarjetas y QR en POS', module: 'Configuración', type: 'OPERATIVE', technicalPermission: 'settings:pos:write' },

  // 16. REPORTES GRANULARES
  { id: 'reports.view', name: 'Ver reportes generales', description: 'Permite consultar estadísticas ejecutivas generales', module: 'Reportes', type: 'VIEW', technicalPermission: 'reports:read' },
  { id: 'reports.export', name: 'Exportar reportes generales', description: 'Permite descargar informes generales en PDF/Excel', module: 'Reportes', type: 'OPERATIVE', technicalPermission: 'reports:read' },
  { id: 'reports.sales.view', name: 'Ver reportes de ventas', description: 'Permite ver estadísticas y facturación', module: 'Reportes', type: 'VIEW', technicalPermission: 'reports:read' },
  { id: 'reports.sales.export', name: 'Exportar reportes de ventas', description: 'Permite descargar informes de ventas', module: 'Reportes', type: 'OPERATIVE', technicalPermission: 'reports:read' },
  { id: 'reports.cash.view', name: 'Ver reportes de caja', description: 'Permite ver arqueos consolidados', module: 'Reportes', type: 'VIEW', technicalPermission: 'reports:read' },
  { id: 'reports.cash.export', name: 'Exportar reportes de caja', description: 'Permite exportar informes de tesorería', module: 'Reportes', type: 'OPERATIVE', technicalPermission: 'reports:read' },
  { id: 'reports.stock.view', name: 'Ver reportes de stock', description: 'Permite ver rotación y valor de inventario', module: 'Reportes', type: 'VIEW', technicalPermission: 'reports:read' },
  { id: 'reports.stock.export', name: 'Exportar reportes de stock', description: 'Permite descargar valor de inventario', module: 'Reportes', type: 'OPERATIVE', technicalPermission: 'reports:read' },
  { id: 'reports.customers.view', name: 'Ver reportes de clientes', description: 'Permite ver saldos y ranking de clientes', module: 'Reportes', type: 'VIEW', technicalPermission: 'reports:read' },
  { id: 'reports.customers.export', name: 'Exportar reportes de clientes', description: 'Permite exportar saldos de clientes', module: 'Reportes', type: 'OPERATIVE', technicalPermission: 'reports:read' },
  { id: 'reports.finances.view', name: 'Ver reportes financieros', description: 'Permite ver rentabilidad y márgenes globales', module: 'Reportes', type: 'CRITICAL', technicalPermission: 'reports:read' },
  { id: 'reports.finances.export', name: 'Exportar reportes financieros', description: 'Permite exportar balances de rentabilidad', module: 'Reportes', type: 'CRITICAL', technicalPermission: 'reports:read' },

  // 17. AUDITORÍA
  { id: 'audit.view', name: 'Ver auditoría del sistema', description: 'Permite consultar el registro histórico de acciones del ERP', module: 'Auditoría', type: 'CRITICAL', technicalPermission: 'AUDIT_VIEW' },
];

