import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { History, X, Calendar, User, FileText, CheckCircle2, AlertTriangle, RefreshCw, Warehouse } from 'lucide-react';

interface ImportHistoryItem {
  id: string;
  fileName: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
  createdAt: string;
  user?: { name: string; email: string };
  warehouse?: { name: string };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ProductImportHistoryModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState<ImportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products/import/history');
      setHistory(res.data.data || []);
    } catch (err) {
      console.error('Error al cargar historial de importaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 max-w-4xl w-full rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 rounded-xl text-indigo-400">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Historial de Importaciones Masivas</h2>
              <p className="text-xs text-slate-400">Bitácora auditable de procesos de importación de catálogo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              className="p-2 hover:bg-white/10 rounded-xl text-slate-300 transition-colors"
              title="Actualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-slate-300 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
              Cargando historial de importaciones...
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              No se registran importaciones masivas previas en esta empresa.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-indigo-600" />
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                        {item.fileName}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-400" /> {item.user?.name || 'Sistema'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />{' '}
                        {new Date(item.createdAt).toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 uppercase block font-black">Filas Procesadas</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">{item.totalRows}</span>
                    </div>

                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                      <span className="text-[10px] text-emerald-600 uppercase block font-black">Creados</span>
                      <span className="text-sm font-black text-emerald-600">{item.createdCount}</span>
                    </div>

                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 text-center">
                      <span className="text-[10px] text-indigo-600 uppercase block font-black">Actualizados</span>
                      <span className="text-sm font-black text-indigo-600">{item.updatedCount}</span>
                    </div>

                    <div className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
                      <span className="text-[10px] text-rose-600 uppercase block font-black">Errores</span>
                      <span className="text-sm font-black text-rose-600">{item.errorCount}</span>
                    </div>
                  </div>

                  {item.warehouse && (
                    <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 pt-1">
                      <Warehouse className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Depósito Destino Stock: <strong>{item.warehouse.name}</strong></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
