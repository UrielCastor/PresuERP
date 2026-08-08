import Swal, { SweetAlertOptions } from 'sweetalert2';

// Standard PresuERP Swal Configuration Template
const baseConfig: SweetAlertOptions = {
  customClass: {
    popup: 'rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl font-sans',
    title: 'text-lg font-bold text-slate-900 dark:text-white',
    htmlContainer: 'text-sm text-slate-600 dark:text-slate-300 font-medium',
    confirmButton: 'px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 mx-1.5',
    cancelButton: 'px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 mx-1.5',
    denyButton: 'px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 mx-1.5',
    input: 'px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-sans',
  },
  buttonsStyling: false,
};

export const swalSuccess = (title: string, text?: string) => {
  return Swal.fire({
    ...baseConfig,
    icon: 'success',
    title,
    text,
    timer: 3000,
    timerProgressBar: true,
    showConfirmButton: false,
  });
};

export interface SaleSuccessSwalOptions {
  documentNumber: string;
  pointsEarned?: number;
  pointsRedeemed?: number;
  newBalance?: number;
}

export const swalSaleSuccess = (options: SaleSuccessSwalOptions) => {
  const { documentNumber, pointsEarned = 0, pointsRedeemed = 0, newBalance } = options;
  const hasLoyalty = (pointsEarned > 0 || pointsRedeemed > 0) && newBalance !== undefined;

  let htmlContent = `
    <div class="space-y-3 font-sans">
      <p class="text-slate-600 dark:text-slate-300 font-medium text-xs sm:text-sm">
        La venta se registró correctamente.
      </p>
      <div class="inline-block px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
        Comprobante #${documentNumber}
      </div>
  `;

  if (hasLoyalty) {
    htmlContent += `
      <div class="mt-3 p-3.5 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs space-y-1 text-center">
        <div class="flex items-center justify-center gap-1.5 font-black text-amber-800 dark:text-amber-300 text-xs">
          ⭐ Fidelización
        </div>
        ${
          pointsEarned > 0
            ? `<div class="font-mono font-black text-emerald-600 dark:text-emerald-400 text-base">+${pointsEarned} pts</div>`
            : ''
        }
        ${
          pointsRedeemed > 0
            ? `<div class="font-mono font-bold text-rose-600 text-xs">Canjeados: ${pointsRedeemed} pts</div>`
            : ''
        }
        <div class="text-[11px] text-amber-900 dark:text-amber-200 font-semibold pt-1 border-t border-amber-200/60 dark:border-amber-800/60 mt-1">
          Nuevo saldo: <span class="font-mono font-bold">${newBalance} pts</span>
        </div>
      </div>
    `;
  }

  htmlContent += `</div>`;

  return Swal.fire({
    ...baseConfig,
    icon: 'success',
    title: '✓ Venta Registrada',
    html: htmlContent,
    showConfirmButton: true,
    confirmButtonText: 'Aceptar',
  });
};

export interface RefundSuccessSwalOptions {
  refundCode: string;
  refundTotal: number;
  paymentMethod?: string;
  pointsReversed?: number;
  newPointsBalance?: number;
  isCreditAccount?: boolean;
}

export const swalRefundSuccess = (options: RefundSuccessSwalOptions) => {
  const {
    refundCode,
    refundTotal,
    paymentMethod,
    pointsReversed = 0,
    newPointsBalance,
    isCreditAccount = false,
  } = options;

  const hasPoints = pointsReversed > 0 && newPointsBalance !== undefined;

  const paymentLabel = isCreditAccount
    ? 'Cuenta Corriente (Deuda descontada)'
    : paymentMethod === 'CASH' ? 'Efectivo'
    : paymentMethod === 'MERCADO_PAGO' ? 'Mercado Pago'
    : paymentMethod === 'TRANSFER' ? 'Transferencia'
    : paymentMethod === 'CARD' ? 'Tarjeta'
    : paymentMethod || 'Efectivo';

  let html = `
    <div class="space-y-3 font-sans text-left">
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Comprobante</div>
          <div class="font-mono font-black text-slate-800 dark:text-slate-200 text-sm">${refundCode}</div>
        </div>
        <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
          <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Importe Reintegrado</div>
          <div class="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">$ ${refundTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>
      <div class="text-xs text-center text-slate-500 dark:text-slate-400 font-medium">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
          💳 ${paymentLabel}
        </span>
      </div>
  `;

  if (hasPoints) {
    html += `
      <div class="p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs text-center space-y-1">
        <div class="font-black text-amber-800 dark:text-amber-300 text-xs">⭐ Fidelización</div>
        <div class="font-mono font-black text-rose-600 dark:text-rose-400 text-base">-${pointsReversed} pts revertidos</div>
        <div class="text-[11px] text-amber-900 dark:text-amber-200 font-semibold pt-1 border-t border-amber-200/60 dark:border-amber-800/60 mt-1">
          Saldo actual: <span class="font-mono font-bold">${newPointsBalance} pts</span>
        </div>
      </div>
    `;
  }

  html += `</div>`;

  return Swal.fire({
    ...baseConfig,
    icon: 'success',
    title: '✓ Devolución Procesada',
    html,
    showConfirmButton: true,
    confirmButtonText: 'Aceptar',
  });
};

export const swalError = (title: string, text?: string) => {
  return Swal.fire({
    ...baseConfig,
    icon: 'error',
    title,
    text: text || 'Ha ocurrido un error insospechado al procesar la operación.',
    confirmButtonText: 'Entendido',
  });
};

export const swalWarning = (title: string, text?: string) => {
  return Swal.fire({
    ...baseConfig,
    icon: 'warning',
    title,
    text,
    confirmButtonText: 'Entendido',
  });
};

export const swalInfo = (title: string, text?: string) => {
  return Swal.fire({
    ...baseConfig,
    icon: 'info',
    title,
    text,
    confirmButtonText: 'Aceptar',
  });
};

export const swalConfirm = async (
  title: string,
  text?: string,
  confirmText: string = 'Sí, confirmar',
  cancelText: string = 'Cancelar',
  icon: 'warning' | 'question' | 'error' | 'info' = 'warning'
): Promise<boolean> => {
  const result = await Swal.fire({
    ...baseConfig,
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
  });
  return result.isConfirmed;
};

export const swalPrompt = async (
  title: string,
  text?: string,
  placeholder: string = '',
  defaultValue: string = ''
): Promise<string | null> => {
  const result = await Swal.fire({
    ...baseConfig,
    title,
    text,
    input: 'text',
    inputValue: defaultValue,
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: 'Aceptar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    inputValidator: (value) => {
      if (!value || !value.trim()) {
        return 'Este campo es requerido';
      }
      return null;
    },
  });
  return result.isConfirmed && result.value ? result.value.trim() : null;
};

export const swalLoading = (title: string = 'Procesando...', text?: string) => {
  Swal.fire({
    ...baseConfig,
    title,
    text: text || 'Por favor espere un momento mientras se completa la operación.',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });
};

export const swalClose = () => {
  Swal.close();
};

export const handleApiError = (error: any, fallbackTitle: string = 'Error de Operación') => {
  console.error('[API_ERROR_HANDLED]', error);
  const message =
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message ||
    'Ha ocurrido un problema al comunicarse con el servidor.';
  
  return swalError(fallbackTitle, message);
};
