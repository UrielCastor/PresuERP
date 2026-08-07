import React, { useState, useEffect } from 'react';
import { swalConfirm } from '../../utils/swal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { DataGrid } from '../../components/ui/DataGrid';
import { SystemService } from '../services/system.service';
import {
  Tag,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Calendar,
  Percent,
  Sparkles,
  Search,
  X,
  Save,
} from 'lucide-react';

export interface CouponItem {
  id?: string;
  code: string;
  discountPercent: number;
  startDate?: string;
  endDate?: string;
  applicablePlans?: string;
  maxUses: number;
  usedCount: number;
  active: boolean;
}

export const SystemCoupons: React.FC = () => {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('20');
  const [endDate, setEndDate] = useState('');
  const [maxUses, setMaxUses] = useState('100');
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const data = await SystemService.getCoupons();
      setCoupons(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewModal = () => {
    setEditingId(null);
    setCode('');
    setDiscountPercent('20');
    setEndDate('');
    setMaxUses('100');
    setActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: CouponItem) => {
    setEditingId(c.id || null);
    setCode(c.code);
    setDiscountPercent(String(c.discountPercent));
    setEndDate(c.endDate ? c.endDate.split('T')[0] : '');
    setMaxUses(String(c.maxUses));
    setActive(c.active);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await swalConfirm(
      '¿Eliminar Cupón?',
      '¿Confirma que desea eliminar este cupón promocional?',
      'Sí, eliminar',
      'Cancelar'
    );
    if (!confirmed) return;
    try {
      await SystemService.deleteCoupon(id);
      setNotification({ type: 'success', message: 'Cupón eliminado correctamente.' });
      fetchCoupons();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.message || 'Error al eliminar cupón.' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        discountPercent: Number(discountPercent) || 0,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        maxUses: Number(maxUses) || 100,
        active,
      };

      if (editingId) {
        await SystemService.updateCoupon(editingId, payload);
        setNotification({ type: 'success', message: 'Cupón actualizado correctamente.' });
      } else {
        await SystemService.createCoupon(payload);
        setNotification({ type: 'success', message: `Cupón "${code}" creado exitosamente.` });
      }
      setIsModalOpen(false);
      fetchCoupons();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.response?.data?.message || 'Error al guardar cupón.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Código Promocional',
      cell: (row: CouponItem) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-xl">
            <Tag className="h-4 w-4" />
          </div>
          <div>
            <span className="font-mono font-black text-sm text-slate-900 dark:text-white uppercase">{row.code}</span>
            <span className="block text-[11px] text-slate-400">Usos: {row.usedCount} / {row.maxUses}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Descuento',
      cell: (row: CouponItem) => (
        <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs rounded-lg">
          -{row.discountPercent}% OFF
        </span>
      ),
    },
    {
      header: 'Vencimiento',
      cell: (row: CouponItem) => (
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          {row.endDate ? new Date(row.endDate).toLocaleDateString() : 'Sin vencimiento'}
        </span>
      ),
    },
    {
      header: 'Estado',
      cell: (row: CouponItem) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
            row.active
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {row.active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      cell: (row: CouponItem) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenEditModal(row)}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id!)}
            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 rounded-lg text-xs font-bold"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1500px] mx-auto pb-16 font-sans animate-in fade-in duration-300">
      <PageHeader
        title="Cupones y Descuentos SaaS"
        subtitle="Gestione códigos promocionales para la contratación y upgrade de planes de suscripción"
        action={
          <button
            onClick={handleOpenNewModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Nuevo Cupón SaaS
          </button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <DataGrid
            columns={columns}
            data={coupons}
            isLoading={loading}
            keyExtractor={(item) => item.id || item.code}
          />
        </CardContent>
      </Card>

      {/* Modal CRUD Cupón */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="h-5 w-5 text-indigo-600" />
                {editingId ? 'Editar Cupón SaaS' : 'Nuevo Cupón Promocional'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Código del Cupón *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ej. LANZAMIENTO2026"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Descuento (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Usos Máximos
                  </label>
                  <input
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fecha Fin (Opcional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <label className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 rounded"
                />
                <span className="font-bold text-xs text-slate-900 dark:text-white">Cupón Activo</span>
              </label>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2"
                >
                  <Save className="h-4 w-4" /> Guardar Cupón
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
