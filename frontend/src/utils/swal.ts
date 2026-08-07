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
