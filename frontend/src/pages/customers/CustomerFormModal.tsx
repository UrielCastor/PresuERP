import React, { useState, useEffect } from 'react';
import { X, User, Building, CreditCard, Phone, Mail, MapPin, FileText, CheckCircle } from 'lucide-react';
import { Customer, createCustomer, updateCustomer } from '../../services/customer.service';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer?: Customer | null;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customer,
}) => {
  const [formData, setFormData] = useState({
    type: 'PERSON' as 'PERSON' | 'COMPANY',
    name: '',
    document: '',
    taxCondition: 'Consumidor Final',
    phone: '',
    email: '',
    address: '',
    city: '',
    province: '',
    notes: '',
    allowCreditAccount: false,
    creditLimit: '' as number | string,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("Customer recibido:", customer);
    if (customer) {
      console.log("Reset values:", {
        allowCreditAccount: customer.allowCreditAccount,
        creditLimit: customer.creditLimit
      });
      setFormData({
        type: customer.type || 'PERSON',
        name: customer.name || '',
        document: customer.document || '',
        taxCondition: customer.taxCondition || 'Consumidor Final',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        city: customer.city || '',
        province: customer.province || '',
        notes: customer.notes || '',
        allowCreditAccount: Boolean(customer.allowCreditAccount),
        creditLimit: Number(customer.creditLimit || 0),
      });
    } else {
      setFormData({
        type: 'PERSON',
        name: '',
        document: '',
        taxCondition: 'Consumidor Final',
        phone: '',
        email: '',
        address: '',
        city: '',
        province: '',
        notes: '',
        allowCreditAccount: false,
        creditLimit: 0,
      });
    }
    setError(null);
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('El nombre o razón social es obligatorio');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      ...formData,
      creditLimit: Number(formData.creditLimit) || 0,
    };

    try {
      if (customer) {
        await updateCustomer(customer.id, payload);
      } else {
        await createCustomer(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error al guardar el cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              {formData.type === 'COMPANY' ? <Building className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <p className="text-xs text-slate-500">
                {customer ? 'Modificar datos del cliente seleccionado' : 'Ingresa los datos para registrar un cliente'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50">
              {error}
            </div>
          )}

          {/* Type Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Tipo de Cliente
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'PERSON' })}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-semibold text-sm transition-all ${
                  formData.type === 'PERSON'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-500 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <User className="w-4 h-4" /> Persona Física
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'COMPANY' })}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-semibold text-sm transition-all ${
                  formData.type === 'COMPANY'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-500 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <Building className="w-4 h-4" /> Empresa / Razón Social
              </button>
            </div>
          </div>

          {/* Basic Data Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nombre / Razón Social <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={formData.type === 'COMPANY' ? 'Ej. Logística Sur S.A.' : 'Ej. Juan Pérez'}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Documento / CUIT / DNI
              </label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.document}
                  onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                  placeholder="20-30405060-7"
                  className="w-full text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Condición IVA
              </label>
              <select
                value={formData.taxCondition}
                onChange={(e) => setFormData({ ...formData, taxCondition: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Consumidor Final">Consumidor Final</option>
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Monotributo">Monotributo</option>
                <option value="Exento">Exento</option>
                <option value="Cliente Exterior">Cliente Exterior</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Teléfono / WhatsApp
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+54 9 11 1234-5678"
                  className="w-full text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@ejemplo.com"
                  className="w-full text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Location Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Dirección
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Av. Corrientes 1234"
                  className="w-full text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Localidad
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="CABA / Rosario / Córdoba"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Provincia
              </label>
              <input
                type="text"
                value={formData.province}
                onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                placeholder="Buenos Aires"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Configuración de Cuenta Corriente */}
          <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Cuenta Corriente</h4>
                <p className="text-xs text-slate-500">Habilita compras a crédito con saldo adeudado para este cliente.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.allowCreditAccount}
                  onChange={(e) => setFormData({ ...formData, allowCreditAccount: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {formData.allowCreditAccount && (
              <div className="pt-2 animate-in fade-in duration-200">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Límite Máximo de Crédito ($ ARS)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.creditLimit === 0 ? '' : formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                  placeholder="0.00"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">Límite mensual permitido para ventas a crédito en POS.</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notas Internas
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Horarios de entrega, preferencias, observaciones..."
                className="w-full text-sm pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {loading ? 'Guardando...' : customer ? 'Guardar Cambios' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
