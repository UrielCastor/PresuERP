export interface GuideStep {
  label: string;
  description?: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface HelpInfo {
  moduleName: string;
  title: string;
  description: string;
  quickTips: string[];
  faqs: FAQ[];
  guideSteps: GuideStep[];
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  emptyStateActionText?: string;
}

export const helpRegistry: Record<string, HelpInfo> = {
  '/dashboard': {
    moduleName: 'Dashboard',
    title: 'Dashboard ERP',
    description: 'Vista consolidada del rendimiento comercial del negocio, facturación de ventas y resumen analítico.',
    quickTips: [
      'Los indicadores reflejan los movimientos ingresados de forma inmediata.',
      'Utiliza los accesos rápidos para ir directo a vender o realizar compras.'
    ],
    faqs: [
      {
        question: '¿Con qué frecuencia se recalculan los gráficos?',
        answer: 'Todas las tarjetas y gráficas de venta se refrescan en tiempo real con cada movimiento financiero y arqueo de caja registrado.'
      },
      {
        question: '¿Por qué no veo datos de facturación?',
        answer: 'Verifica los filtros de fecha del extremo superior o asegúrate de que se hayan registrado cobros válidos.'
      }
    ],
    guideSteps: [
      { label: 'Movimientos del día', description: 'Revisa las métricas claves del negocio (ventas, compras, caja).' },
      { label: 'Control diario de caja', description: 'Monitorea las sesiones de caja abiertas y su saldo disponible.' },
      { label: 'Evolución financiera', description: 'Analiza el histórico diario de facturación en el gráfico de barras.' }
    ],
    emptyStateTitle: 'Sin datos registrados',
    emptyStateDescription: 'Comienza realizando ventas en el POS o registrando compras en inventario para poblar el Dashboard.',
    emptyStateActionText: 'Ir a POS'
  },
  '/products': {
    moduleName: 'Productos',
    title: 'Catálogo de Productos',
    description: 'Administra la base de artículos disponibles para el POS, transferencias y control de stock.',
    quickTips: [
      'Para facturar un producto en el POS de manera normal, primero debes contar con stock disponible.',
      'Puedes configurar alertas de stock mínimo para recibir avisos de reposición.'
    ],
    faqs: [
      {
        question: '¿Es obligatorio cargar el precio de costo?',
        answer: 'No es estrictamente obligatorio, pero es altamente recomendado para calcular el costo promedio ponderado en el Kardex y conocer tu margen real de ganancia.'
      },
      {
        question: '¿Puedo importar artículos de forma masiva?',
        answer: 'Sí, la arquitectura admite la carga desde planillas Excel/CSV desde el panel de integraciones del catálogo comercial.'
      }
    ],
    guideSteps: [
      { label: 'Crear categoría', description: 'Agrupa tus artículos para dinamizar las búsquedas rápidas.' },
      { label: 'Nuevo Producto', description: 'Especifica código, costo, porcentaje de ganancia e IVA correspondiente.' },
      { label: 'Validar stock', description: 'Asegúrate de inicializar las existencias físicas en el módulo de Inventario.' }
    ],
    emptyStateTitle: 'No tienes productos registrados',
    emptyStateDescription: 'El catálogo de productos alimenta tanto las ventas en POS como la recepción de stock.',
    emptyStateActionText: 'Nuevo Producto'
  },
  '/categories': {
    moduleName: 'Categorías',
    title: 'Categorías de Productos',
    description: 'Administra agrupaciones de productos para segmentar búsquedas rápidas y optimizar reportes analíticos.',
    quickTips: [
      'Las categorías estructuran el menú táctil de selección del Punto de Venta (POS).',
      'Un producto puede configurarse sólo en una categoría principal.'
    ],
    faqs: [
      {
        question: '¿Puedo borrar categorías activas?',
        answer: 'Sólo si no poseen productos asociados en el stock global.'
      }
    ],
    guideSteps: [
      { label: 'Registrar categoría', description: 'Asigna un nombre distintivo y descripción del rubro.' },
      { label: 'Vincular catálogo', description: 'Asigna la categoría en la ficha de creación de tus productos.' }
    ],
    emptyStateTitle: 'No hay categorías cargadas',
    emptyStateDescription: 'Facilita la organización de tus artículos agrupándolos por familias de rubros.',
    emptyStateActionText: 'Nueva Categoría'
  },
  '/brands': {
    moduleName: 'Marcas',
    title: 'Marcas de Productos',
    description: 'Clasifica tus artículos por fabricante o proveedor oficial para agilizar búsquedas e informes de rendimiento.',
    quickTips: [
      'Las marcas facilitan los filtros dentro del catálogo y los reportes de ventas.'
    ],
    faqs: [
      {
        question: '¿Pueden eliminarse marcas existentes?',
        answer: 'Siempre que no existan artículos en el catálogo haciendo referencia a dicha marca.'
      }
    ],
    guideSteps: [
      { label: 'Crear marca', description: 'Escribe el nombre del fabricante o distribuidor principal.' },
      { label: 'Asignar', description: 'Vincula la marca al dar de alta productos.' }
    ],
    emptyStateTitle: 'No hay marcas creadas',
    emptyStateDescription: 'Administra el listado de fabricantes para un control meticuloso de catálogo.',
    emptyStateActionText: 'Nueva Marca'
  },
  '/suppliers': {
    moduleName: 'Proveedores',
    title: 'Proveedores de Mercadería',
    description: 'Controla el directorio de fabricantes y distribuidores vinculados al ciclo de compras de tu empresa.',
    quickTips: [
      'Registrar información oficial (CUIT/CUIT) te permitirá auditar correctamente compras del mes.'
    ],
    faqs: [
      {
        question: '¿Por qué me pide CUIT obligatorio?',
        answer: 'Para emitir documentos fiscales de compra es mandatorio contar con la identificación fiscal válida de la contraparte.'
      }
    ],
    guideSteps: [
      { label: 'Registrar proveedor', description: 'Ingresa Razón Social, CUIT, Email de pedidos y Dirección.' },
      { label: 'Cargar ordenes', description: 'Utiliza el proveedor al generar presupuestos y recepciones de stock.' }
    ],
    emptyStateTitle: 'Lista de proveedores vacía',
    emptyStateDescription: 'Vincula las compras a tus distribuidores para controlar saldos y remitos de stock.',
    emptyStateActionText: 'Nuevo Proveedor'
  },
  '/warehouses': {
    moduleName: 'Depósitos',
    title: 'Depósitos y Sucursales',
    description: 'Administra los puntos físicos de almacenamiento (bodegas, sucursales o tiendas de venta).',
    quickTips: [
      'El sistema calcula los balances de stock de manera independiente para cada depósito.',
      'Puedes restringir las cajas POS para deducir únicamente de un depósito específico.'
    ],
    faqs: [
      {
        question: '¿Puedo tener un stock compartido entre depósitos?',
        answer: 'No, el control de stock es exclusivo a nivel físico para saber exactamente dónde reside cada producto.'
      }
    ],
    guideSteps: [
      { label: 'Configurar ubicación', description: 'Registra un nombre del depósito (ej: Local Central o Depósito 2) y su dirección.' },
      { label: 'Asociar stock', description: 'Inicializa las cantidades del inventario específicamente para esa zona.' }
    ],
    emptyStateTitle: 'Sin depósitos creados',
    emptyStateDescription: 'Crea tu primer depósito físico para comenzar a operar el control de inventario.',
    emptyStateActionText: 'Nuevo Depósito'
  },
  '/stocks': {
    moduleName: 'Stock',
    title: 'Administración de Stock',
    description: 'Monitorea existencias físicas de productos por depósito y gestiona regularizaciones de inventario.',
    quickTips: [
      'Cualquier cambio manual de stock dejará registrado un movimiento y su motivo en la base de datos.',
      'Utiliza transferencias para mover productos físicamente entre locales sin perder trazabilidad.'
    ],
    faqs: [
      {
        question: '¿Puedo regularizar stock de varios artículos al mismo tiempo?',
        answer: 'Sí, mediante los ajustes de inventario o cargando remitos de entrada correspondientes.'
      }
    ],
    guideSteps: [
      { label: 'Filtrar ubicación', description: 'Selecciona el depósito para visualizar la mercadería disponible.' },
      { label: 'Ajuste de inventario', description: 'Modifica unidades y provee una justificación física (rotura, extravío, etc.).' },
      { label: 'Transferencia', description: 'Configura orígenes, destinos e ítems para mover stock de manera segura.' }
    ],
    emptyStateTitle: 'Inventario físico sin movimientos',
    emptyStateDescription: 'Administra y ajusta el inventario de artículos por depósito y local.',
    emptyStateActionText: 'Realizar Ajuste'
  },
  '/purchases': {
    moduleName: 'Compras',
    title: 'Órdenes de Compra',
    description: 'Gestión profesional del ciclo de adquisición de mercadería, desde borradores hasta el ingreso al stock.',
    quickTips: [
      'Una compra en estado Recibida ya no puede modificarse.',
      'Confirmar la recepción incrementa de forma directa las existencias del depósito destino.'
    ],
    faqs: [
      {
        question: '¿Cómo cambia el estado a Aprobada?',
        answer: 'Un usuario administrador con permiso de aprobación debe presionar el botón "Aprobar" tras validar los costos ingresados.'
      },
      {
        question: '¿Qué sucede si hay diferencia en el total facturado?',
        answer: 'El sistema advertirá discrepancias y te solicitará una aprobación expresa de diferencia de totales.'
      }
    ],
    guideSteps: [
      { label: 'Cargar Borrador', description: 'Elige proveedor y depósito, y añade los costos unitarios de los productos.' },
      { label: 'Enviar a aprobación', description: 'Valida los totales y solicita verificación interna.' },
      { label: 'Aprobar orden', description: 'Inicia el estado formal de compra lista para recibir.' },
      { label: 'Recibir stock', description: 'Declara la entrega de mercadería para impactar en Kardex y stock.' }
    ],
    emptyStateTitle: 'Historial de compras vacío',
    emptyStateDescription: 'Registra tus compras a proveedores para actualizar existencias y auditar costos de adquisición.',
    emptyStateActionText: 'Nueva Compra'
  },
  '/sales': {
    moduleName: 'Ventas',
    title: 'Historial de Ventas',
    description: 'Administra la facturación del negocio, reimprime tickets y reembolsa cobros emitidos en la terminal.',
    quickTips: [
      'Las facturas ya conformadas solo pueden modificarse emitiendo notas de crédito compensatorias.',
      'Puedes filtrar las ventas por medio de pago o depósito emisor.'
    ],
    faqs: [
      {
        question: '¿Cómo anulo una factura de venta?',
        answer: 'Ingresa al detalle de la venta, valida los permisos y presiona "Anular" para reintegrar el stock y registrar el reverso en caja.'
      }
    ],
    guideSteps: [
      { label: 'Operar POS', description: 'Registra ventas ágilmente usando el listado táctil o lector de barras.' },
      { label: 'Revisar Historial', description: 'Monitorea el estado de cobro, CUIT del cliente y facturas impresas.' },
      { label: 'Auditar caja', description: 'Concilia las ventas con los arqueos diarios de caja chica.' }
    ],
    emptyStateTitle: 'Sin ventas facturadas',
    emptyStateDescription: 'No quedan registros coincidentes con los filtros seleccionados. Genera cobros desde el POS.',
    emptyStateActionText: 'Ir a POS'
  },
  '/pos': {
    moduleName: 'POS',
    title: 'Punto de Venta (POS)',
    description: 'Terminal interactivo para el registro rápido de ventas, selección de productos, cobros combinados y ticketera.',
    quickTips: [
      'Establece un cliente predeterminado (Consumidor Final) para dinamizar las transacciones rápidas.',
      'Es requisito obligatorio que el cajero tenga una sesión de caja activa abierta.'
    ],
    faqs: [
      {
        question: '¿Puedo cobrar con dos métodos de pago?',
        answer: 'Sí, la terminal admite pagos mixtos (efectivo y transferencia, etc.) cargando los montos parciales en caja.'
      }
    ],
    guideSteps: [
      { label: 'Verificar caja', description: 'Inicia sesión de caja chica especificando el monto inicial de cambio.' },
      { label: 'Seleccionar productos', description: 'Agrega artículos mediante el lector de código de barras o del buscador táctil.' },
      { label: 'Efectuar cobro', description: 'Declara la forma de pago, calcula el cambio a entregar e imprime el comprobante final.' }
    ],
    emptyStateTitle: 'Caja cerrada o inactiva',
    emptyStateDescription: 'Abre la caja diaria desde el módulo de Caja Chica para habilitar la terminal de punto de venta (POS).',
    emptyStateActionText: 'Abrir Caja'
  },
  '/cash': {
    moduleName: 'Caja',
    title: 'Caja Chica y Turnos',
    description: 'Administración de flujos de dinero físico, arqueos diarios, egresos imprevistos y conciliación del Punto de Venta.',
    quickTips: [
      'Registrar los egresos de caja por gastos chicos asegura el cuadre perfecto del arqueo al cierre.',
      'No cierres la caja si tienes ventas concurrentes sin registrar en el POS.'
    ],
    faqs: [
      {
        question: '¿Qué es una diferencia de arqueo?',
        answer: 'Es la discrepancia matemática entre el efectivo que calcula el sistema (ventas + ingresos - egresos) y el efectivo real declarado al contar el dinero físico al final del turno.'
      }
    ],
    guideSteps: [
      { label: 'Apertura', description: 'Abre caja declarando el efectivo base (p. ej. cambio del día previo).' },
      { label: 'Movimientos', description: 'Ingresa retiros parciales para depósitos bancarios o pagos de insumos de caja.' },
      { label: 'Arqueo de cierre', description: 'Cuenta la caja física, carga el número final y clausura el turno para congelar reportes.' }
    ],
    emptyStateTitle: 'No hay sesiones de caja registradas',
    emptyStateDescription: 'Las sesiones de caja registran cronológicamente las aperturas y los arqueos de cierre de cada terminal.',
    emptyStateActionText: 'Abrir Caja Chica'
  },
  '/reports': {
    moduleName: 'Reportes',
    title: 'Analíticas & Kardex',
    description: 'Inteligencia de negocios e informes contables de compras, ventas y trazabilidad total del inventario.',
    quickTips: [
      'Los informes muestran tendencias de rentabilidad por producto e histórico consolidado.',
      'El Kardex es tu registro auditable de stock bajo método transaccional de costos.'
    ],
    faqs: [
      {
        question: '¿Qué diferencia hay entre reporte de stock y Kardex?',
        answer: 'El reporte de stock muestra la foto del stock en este instante; el Kardex detalla la película de cómo se llegó a esa mercadería de manera histórica.'
      }
    ],
    guideSteps: [
      { label: 'Elegir informe', description: 'Ventas, compras, stock valorizado o Kardex de movimientos.' },
      { label: 'Filtros avanzados', description: 'Delimita búsquedas por depósitos, productos o fechas específicas.' },
      { label: 'Decisiones inteligentes', description: 'Utiliza las analíticas de margen bruto para fijar políticas de precios comerciales.' }
    ],
    emptyStateTitle: 'Sin datos disponibles para el reporte',
    emptyStateDescription: 'Prueba extendiendo el rango de fechas seleccionado en la barra superior o cambiando de pestaña.',
    emptyStateActionText: 'Limpiar Filtros'
  },
  '/users': {
    moduleName: 'Usuarios',
    title: 'Personal y Cuentas',
    description: 'Administra los usuarios del sistema, sus roles de seguridad y accesos al ERP.',
    quickTips: [
      'Controla los accesos del personal asignando perfiles con privilegios determinados.',
      'Fomentar las claves individuales previene incidentes involuntarios de stock.'
    ],
    faqs: [
      {
        question: '¿Puedo establecer restricciones horarias?',
        answer: 'La administración de accesos del usuario se rige por su rol, pero la sesión activa expira según políticas de inactividad.'
      }
    ],
    guideSteps: [
      { label: 'Crear rol', description: 'Especifica qué módulos (ej. POS, Compras) puede leer u operar.' },
      { label: 'Crear usuario', description: 'Completa nombre, email, contraseña y asígnale el perfil de rol guardado.' }
    ],
    emptyStateTitle: 'Sin usuarios registrados',
    emptyStateDescription: 'Da de alta colaboradores para que puedan operar el POS o registrar órdenes de compra.',
    emptyStateActionText: 'Nuevo Usuario'
  },
  '/settings/company': {
    moduleName: 'Empresa',
    title: 'Perfil Corporativo',
    description: 'Configura información legal, Razón Social, CUIT, teléfonos, direcciones e identidad de marca del tenant.',
    quickTips: [
      'El logo configurado en esta sección se incluirá en los tickets térmicos y facturas PDF.'
    ],
    faqs: [
      {
        question: '¿Puedo cambiar la razón social en cualquier momento?',
        answer: 'Sí, pero ten en cuenta que afectará directamente el encabezado impreso de tus futuros comprobantes.'
      }
    ],
    guideSteps: [
      { label: 'Detalles legales', description: 'Completa CUIT, Razón Social e IIBB.' },
      { label: 'Contacto y Logo', description: 'Actualiza el email comercial y carga el isotipo de la empresa.' }
    ],
    emptyStateTitle: 'Sin información corporativa',
    emptyStateDescription: 'Debes completar el perfil de la organización antes de habilitar la emisión de tickets fiscales.',
    emptyStateActionText: 'Completar Perfil'
  },
  '/settings': {
    moduleName: 'Configuración',
    title: 'Parámetros Globales',
    description: 'Configura parámetros regionales de moneda, impuestos, políticas de stock y pasarelas de correo del sistema.',
    quickTips: [
      'Los numeradores permiten sincronizar tus correlativos de facturación con talonarios físicos manuales.',
      'Testea las credenciales SMTP enviando un correo de prueba antes de guardarlas.'
    ],
    faqs: [
      {
        question: '¿Qué es el costeo LIFO/FIFO?',
        answer: 'Define si el inventario se valoriza considerando que lo primero que entra es lo primero que sale (FIFO) o lo último ingresado (LIFO). El método por defecto es Precio Promedio Ponderado.'
      }
    ],
    guideSteps: [
      { label: 'Establecer regional', description: 'Huso horario local, separador de miles/decimales y símbolo de moneda ($).' },
      { label: 'Políticas de stock', description: 'Decide si el sistema prohibirá las ventas sin stock disponible.' },
      { label: 'Comprobantes', description: 'Define los prefijos y correlativos del sistema para facturas y remitos.' }
    ],
    emptyStateTitle: 'Ajustes no inicializados',
    emptyStateDescription: 'Crea la estructura de bases del sistema regional o fiscal.',
    emptyStateActionText: 'Cargar Valores Default'
  }
};
