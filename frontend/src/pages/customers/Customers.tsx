import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Building,
  User,
  Phone,
  Mail,
  Eye,
  Edit2,
  Trash2,
  Filter,
  CheckCircle2,
  XCircle,
  Tag,
} from 'lucide-react';
import { Customer, getCustomers, deleteCustomer } from '../../services/customer.service';
import { swalSuccess, swalConfirm, handleApiError } from '../../utils/swal';
import { CustomerFormModal } from './CustomerFormModal';
import { CustomerDetailModal } from './CustomerDetailModal';
import { Input, Select } from '../../components/ui';

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Sorting state
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const loadCustomers = useCallback(async (pageNumber = 1) => {
    setLoading(true);
    try {
      const res = await getCustomers({
        search,
        type: typeFilter || undefined,
        page: pageNumber,
        limit: 50,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
      });
      setCustomers(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Error al cargar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, sortBy, sortOrder]);

  useEffect(() => {
    const handleUpdate = () => {
      loadCustomers(meta.page);
    };
    window.addEventListener('customer-debt-updated', handleUpdate);
    window.addEventListener('customers-updated', handleUpdate);
    return () => {
      window.removeEventListener('customer-debt-updated', handleUpdate);
      window.removeEventListener('customers-updated', handleUpdate);
    };
  }, [loadCustomers, meta.page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, typeFilter, sortBy, sortOrder, loadCustomers]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleCreate = () => {
    setSelectedCustomer(null);
    setIsFormOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsFormOpen(true);
  };

  const handleViewDetail = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setIsDetailOpen(true);
  };

  const handleDelete = async (customer: Customer) => {
    const confirmed = await swalConfirm(
      '¿Desactivar Cliente?',
      `¿Seguro que deseas desactivar al cliente "${customer.name}"?`,
      'Sí, desactivar cliente',
      'Cancelar'
    );
    if (confirmed) {
      try {
        await deleteCustomer(customer.id);
        swalSuccess('Cliente Desactivado', `El cliente "${customer.name}" ha sido desactivado.`);
        loadCustomers(meta.page);
      } catch (err: any) {
        handleApiError(err, 'Error al Desactivar Cliente');
      }
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            Módulo de Clientes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestiona la cartera de clientes de la empresa, datos de contacto y su historial comercial.
          </p>
        </div>

        <button
          onClick={handleCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow-md transition-all shrink-0"
        >
          <Plus className="w-5 h-5" /> Nuevo Cliente
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-96">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, DNI, CUIT o email..."
            leftIcon={Search}
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Filter className="w-4 h-4" /> Tipo:
          </div>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-44"
          >
            <option value="">Todos los tipos</option>
            <option value="PERSON">Persona Física</option>
            <option value="COMPANY">Empresa</option>
          </Select>

          {(search.trim() || typeFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('');
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 px-2 py-1 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Customers Table List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Cargando lista de clientes...</div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-slate-600 dark:text-slate-400 font-medium">No se encontraron clientes registrados.</p>
            <p className="text-xs text-slate-400">Presiona el botón "+ Nuevo Cliente" para agregar el primero.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs uppercase font-bold text-slate-500">
                <tr>
                  <th 
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850/80 transition-colors select-none"
                    onClick={() => handleSort('name')}
                  >
                    Cliente / Razón Social {sortBy === 'name' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Documento / CUIT</th>
                  <th className="px-6 py-4">Contacto</th>
                  <th className="px-6 py-4">Lista de precios</th>
                  <th className="px-6 py-4">Cuenta Corriente</th>
                  <th 
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850/80 transition-colors select-none"
                    onClick={() => handleSort('points')}
                  >
                    Puntos {sortBy === 'points' ? (sortOrder === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((c) => {
                  const currentDebtVal = Math.max(0, Number(c.currentDebt || 0));
                  const hasDebt = currentDebtVal > 0.001;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{c.name}</div>
                            {c.taxCondition && (
                              <div className="text-xs text-slate-400 font-normal">{c.taxCondition}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.type === 'COMPANY' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'}`}>
                          {c.type === 'COMPANY' ? <Building className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {c.type === 'COMPANY' ? 'Empresa' : 'Persona'}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {c.document || c.taxId || '-'}
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1 text-xs">
                          {c.phone && (
                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                              <Phone className="w-3.5 h-3.5 text-slate-400" /> {c.phone}
                            </div>
                          )}
                          {c.email && (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Mail className="w-3.5 h-3.5 text-slate-400" /> {c.email}
                            </div>
                          )}
                          {!c.phone && !c.email && <span className="text-slate-400">-</span>}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {c.defaultPriceList?.name ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm">
                            <Tag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            {c.defaultPriceList.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">
                            Sin asignar
                          </span>
                        )}
                      </td>

                      {/* Nueva Columna: Cuenta Corriente */}
                      <td className="px-6 py-4 font-mono">
                        {c.allowCreditAccount ? (
                          hasDebt ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-2xs whitespace-nowrap">
                              <span>🔴</span>
                              <span>${currentDebtVal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs whitespace-nowrap">
                              <span>🟢</span>
                              <span>$0,00</span>
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                        {c.pointsBalance ?? 0}
                      </td>


                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${c.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-500'}`}>
                        {c.active ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                        {c.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetail(c)}
                          title="Ver detalle e historial"
                          className="p-2 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(c)}
                          title="Editar cliente"
                          className="p-2 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          title="Desactivar cliente"
                          className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        )}

        {/* Footer Pagination */}
        {meta.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>Mostrando {customers.length} de {meta.total} clientes</div>
            <div className="flex gap-2">
              <button
                disabled={meta.page <= 1}
                onClick={() => loadCustomers(meta.page - 1)}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Anterior
              </button>
              <button
                disabled={meta.page >= meta.totalPages}
                onClick={() => loadCustomers(meta.page + 1)}
                className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CustomerFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => loadCustomers(meta.page)}
        customer={selectedCustomer}
      />

      <CustomerDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          loadCustomers(meta.page);
        }}
        customerId={selectedCustomerId}
      />
    </div>
  );
};

export default Customers;
