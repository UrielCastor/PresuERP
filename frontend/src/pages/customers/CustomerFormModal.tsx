import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, User, Building, CreditCard, Phone, Mail, MapPin, FileText, CheckCircle, Tag } from 'lucide-react';
import { Customer, createCustomer, updateCustomer } from '../../services/customer.service';
import { priceListService } from '../../services/priceList.service';
import { useAuth } from '../../contexts/AuthContext';

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
  const { hasCapability } = useAuth();
  const canEditCreditLimit = hasCapability('customers.edit_credit_limit') || hasCapability('customers.update') || !customer;
  const canEditPriceList = hasCapability('customers.edit_price_list') || hasCapability('customers.update') || !customer;
  const { data: priceLists = [] } = useQuery({
    queryKey: ['priceListsAll'],
    queryFn: priceListService.getAll,
  });

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
    defaultPriceListId: '',
    autoApplyPriceList: true,
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
        defaultPriceListId: customer.defaultPriceListId || '',
        autoApplyPriceList: customer.autoApplyPriceList !== false,
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
        defaultPriceListId: '',
        autoApplyPriceList: true,
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
      defaultPriceListId: formData.defaultPriceListId || null,
      autoApplyPriceList: Boolean(formData.autoApplyPriceList),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 flex flex-col max-h-[90vh] transition-all duration-300">
        {/* Header del Modal */}
        <div className="flex-none pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">👤</span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white pr-6">
              {customer ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {customer ? 'Modifica la información comercial y fiscal del cliente.' : 'Registra los datos requeridos para dar de alta a un cliente.'}
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          <form id="customer-form" onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-600 dark:text-red-400 font-medium">
                {error}
              </div>
            )}

            {/* CARD 1: 📦 INFORMACIÓN GENERAL */}
            <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                <span className="text-base leading-none">📦</span>
                <span>Información General</span>
              </div>

              {/* Selector Persona / Empresa */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Tipo de Cliente
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'PERSON' })}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border font-bold text-xs transition-all ${
                      formData.type === 'PERSON'
                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <User className="w-4 h-4" /> Persona Física
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'COMPANY' })}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border font-bold text-xs transition-all ${
                      formData.type === 'COMPANY'
                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Building className="w-4 h-4" /> Empresa / Razón Social
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Nombre / Razón Social <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={formData.type === 'COMPANY' ? 'Ej: Logística Sur S.A.' : 'Ej: Juan Pérez'}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Documento / CUIT / DNI
                  </label>
                  <input
                    type="text"
                    value={formData.document}
                    onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                    placeholder="Ej: 20-30405060-7"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Condición IVA
                </label>
                <select
                  value={formData.taxCondition}
                  onChange={(e) => setFormData({ ...formData, taxCondition: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                >
                  <option value="Consumidor Final">Consumidor Final</option>
                  <option value="Responsable Inscripto">Responsable Inscripto</option>
                  <option value="Monotributo">Monotributo</option>
                  <option value="Exento">Exento</option>
                  <option value="Cliente Exterior">Cliente Exterior</option>
                </select>
              </div>
            </div>

            {/* CARD 2: 📞 CONTACTO & COMUNICACIÓN */}
            <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                <span className="text-base leading-none">📞</span>
                <span>Contacto & Comunicación</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+54 9 11 1234-5678"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="cliente@ejemplo.com"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* CARD 3: 📍 UBICACIÓN & DIRECCIÓN */}
            <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                <span className="text-base leading-none">📍</span>
                <span>Ubicación & Dirección</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Av. Corrientes 1234"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Localidad
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="CABA / Rosario"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Provincia
                  </label>
                  <input
                    type="text"
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    placeholder="Buenos Aires"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* CARD 4: 💲 PRECIOS & CUENTA CORRIENTE */}
            <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                <span className="text-base leading-none">💲</span>
                <span>Tarifas & Cuenta Corriente</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Lista de Precios Comercial
                  </label>
                  <select
                    disabled={!canEditPriceList}
                    value={formData.defaultPriceListId}
                    onChange={(e) => setFormData({ ...formData, defaultPriceListId: e.target.value })}
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold ${!canEditPriceList ? 'opacity-60 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''}`}
                  >
                    <option value="">-- Sin lista asignada (Tarifa General Base) --</option>
                    {priceLists.map((pl: any) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name} {pl.isDefault ? '(Lista Base)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className={`flex items-center gap-2 select-none ${canEditCreditLimit ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                    <input
                      type="checkbox"
                      disabled={!canEditCreditLimit}
                      checked={formData.allowCreditAccount}
                      onChange={(e) => setFormData({ ...formData, allowCreditAccount: e.target.checked })}
                      className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Habilitar Cuenta Corriente (Ventas a Crédito)
                    </span>
                  </label>
                </div>
              </div>

              {formData.allowCreditAccount && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Límite Máximo de Crédito ($ ARS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    disabled={!canEditCreditLimit}
                    value={formData.creditLimit === 0 ? '' : formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                    placeholder="0.00"
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${!canEditCreditLimit ? 'opacity-60 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' : ''}`}
                  />
                </div>
              )}
            </div>

            {/* CARD 5: 📝 DESCRIPCIÓN & NOTAS */}
            <div className="bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                <span className="text-base leading-none">📝</span>
                <span>Notas Internas & Observaciones</span>
              </div>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Horarios de entrega, preferencias comerciales, observaciones..."
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
              />
            </div>
          </form>
        </div>

        {/* Modal Footer - Fixed */}
        <div className="flex-none pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="customer-form"
            disabled={loading}
            className="px-6 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg shadow-md transition-all flex items-center gap-2"
          >
            {loading ? 'Guardando...' : customer ? 'Guardar Cambios' : 'Crear Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
};
