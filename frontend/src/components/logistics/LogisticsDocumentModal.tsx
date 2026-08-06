import React from 'react';
import { Printer, FileText, X, CheckCircle2, Truck, Boxes, Building2 } from 'lucide-react';

export type LogisticsDocType = 'PED' | 'TRA' | 'REC';

export interface LogisticsDocumentData {
  type: LogisticsDocType;
  documentNumber: string; // e.g. PED-000001, TRA-000001, REC-000001
  date: string;
  status: string;
  companyName?: string;
  originWarehouse: { name: string; code?: string };
  destinationWarehouse: { name: string; code?: string };
  requestedBy?: { name: string; email?: string };
  preparedBy?: { name: string; email?: string };
  dispatchedBy?: { name: string; email?: string };
  receivedBy?: { name: string; email?: string };
  relatedTransferNumber?: string; // For REC
  items: Array<{
    productName: string;
    sku: string;
    requestedQty?: number;
    approvedQty?: number;
    sentQty?: number;
    receivedQty?: number;
    differenceQty?: number;
    itemStatus?: string;
    notes?: string;
  }>;
  notes?: string;
}

interface LogisticsDocumentModalProps {
  data: LogisticsDocumentData | null;
  onClose: () => void;
}

export const LogisticsDocumentModal: React.FC<LogisticsDocumentModalProps> = ({
  data,
  onClose,
}) => {
  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  const getDocTitle = () => {
    switch (data.type) {
      case 'PED':
        return 'PEDIDO INTERNO DE STOCK';
      case 'TRA':
        return 'DOCUMENTO DE TRASPASO DE MERCADERÍA';
      case 'REC':
        return 'COMPROBANTE DE RECEPCIÓN DE MERCADERÍA';
      default:
        return 'DOCUMENTO OPERATIVO DE LOGÍSTICA';
    }
  };

  const getDocBadgeColor = () => {
    switch (data.type) {
      case 'PED':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'TRA':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'REC':
        return 'bg-teal-100 text-teal-900 border-teal-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      {/* Print Styles injection */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #logistics-print-document, #logistics-print-document * {
            visibility: visible !important;
          }
          #logistics-print-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh]">
        {/* Modal Toolbar (Screen only) */}
        <div className="no-print p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Vista previa del documento operativo
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            >
              <Printer className="h-4 w-4" /> Imprimir Documento
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              title="Guardar como PDF utilizando el diálogo de impresión"
            >
              <FileText className="h-4 w-4" /> Exportar PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOCUMENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-200/50 dark:bg-slate-950 flex justify-center">
          <div
            id="logistics-print-document"
            className="bg-white text-slate-900 p-8 rounded-xl shadow-lg border border-slate-200 w-full space-y-6 text-sm font-sans"
          >
            {/* Header: Company & Document Info */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary-700">
                  <Building2 className="h-7 w-7 text-indigo-700" />
                  <span className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    {data.companyName || 'PRESUERP COMERCIAL'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Módulo de Gestión Logística & Traspasos de Stock
                </p>
                <p className="text-[11px] text-slate-400">Documento Interno Operativo</p>
              </div>

              <div className="text-right space-y-1">
                <span
                  className={`inline-block px-3 py-1 text-xs font-black rounded-lg border uppercase tracking-wider ${getDocBadgeColor()}`}
                >
                  {getDocTitle()}
                </span>
                <div className="text-2xl font-black font-mono text-slate-900">
                  {data.documentNumber}
                </div>
                <div className="text-xs text-slate-500 font-semibold">
                  Fecha: {new Date(data.date).toLocaleDateString('es-AR')}
                </div>
                <div className="text-xs text-slate-500">
                  Estado: <strong className="uppercase text-slate-800">{data.status}</strong>
                </div>
              </div>
            </div>

            {/* General Info Grid */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Depósito Origen (Abastecedor / Salida)
                </span>
                <span className="font-bold text-slate-900 text-sm block">
                  {data.originWarehouse.name}{' '}
                  {data.originWarehouse.code && `(${data.originWarehouse.code})`}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Depósito Destino (Solicitante / Ingreso)
                </span>
                <span className="font-bold text-slate-900 text-sm block">
                  {data.destinationWarehouse.name}{' '}
                  {data.destinationWarehouse.code && `(${data.destinationWarehouse.code})`}
                </span>
              </div>

              {data.requestedBy && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Solicitante
                  </span>
                  <span className="font-semibold text-slate-800">{data.requestedBy.name}</span>
                </div>
              )}

              {data.preparedBy && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Preparó Mercadería
                  </span>
                  <span className="font-semibold text-slate-800">{data.preparedBy.name}</span>
                </div>
              )}

              {data.dispatchedBy && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Despachó Mercadería
                  </span>
                  <span className="font-semibold text-slate-800">{data.dispatchedBy.name}</span>
                </div>
              )}

              {data.receivedBy && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Usuario Receptor
                  </span>
                  <span className="font-semibold text-slate-800">{data.receivedBy.name}</span>
                </div>
              )}

              {data.relatedTransferNumber && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Traspaso Relacionado
                  </span>
                  <span className="font-mono font-bold text-indigo-700">
                    {data.relatedTransferNumber}
                  </span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Detalle de Productos ({data.items.length})
              </h4>

              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3">SKU</th>
                    {data.type === 'PED' && <th className="p-3 text-center">Solicitado</th>}
                    {data.type === 'PED' && <th className="p-3 text-center">Aprobado</th>}
                    {data.type === 'TRA' && <th className="p-3 text-center">Cantidad Enviada</th>}
                    {data.type === 'REC' && <th className="p-3 text-center">Enviado</th>}
                    {data.type === 'REC' && <th className="p-3 text-center">Recibido</th>}
                    {data.type === 'REC' && <th className="p-3 text-center">Diferencia</th>}
                    {data.type === 'REC' && <th className="p-3">Observaciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((item, idx) => {
                    const req = item.requestedQty ?? 0;
                    const app = item.approvedQty ?? 0;
                    const sent = item.sentQty ?? 0;
                    const rec = item.receivedQty ?? 0;
                    const diff = item.differenceQty ?? rec - sent;

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{item.productName}</td>
                        <td className="p-3 font-mono text-slate-500">{item.sku}</td>

                        {data.type === 'PED' && (
                          <td className="p-3 text-center font-bold text-slate-800">{req} u.</td>
                        )}
                        {data.type === 'PED' && (
                          <td className="p-3 text-center font-bold text-emerald-700">
                            {app} u.
                          </td>
                        )}

                        {data.type === 'TRA' && (
                          <td className="p-3 text-center font-black text-purple-700 text-sm">
                            {sent} u.
                          </td>
                        )}

                        {data.type === 'REC' && (
                          <td className="p-3 text-center font-semibold text-slate-700">{sent} u.</td>
                        )}
                        {data.type === 'REC' && (
                          <td className="p-3 text-center font-black text-teal-700 text-sm">
                            {rec} u.
                          </td>
                        )}
                        {data.type === 'REC' && (
                          <td
                            className={`p-3 text-center font-black ${
                              diff < 0 ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {diff === 0 ? '0 u.' : `${diff} u.`}
                          </td>
                        )}
                        {data.type === 'REC' && (
                          <td className="p-3 text-[11px] text-slate-600 font-medium">
                            {item.notes || '-'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Observaciones */}
            {data.notes && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-slate-700 uppercase text-[10px] block">
                  Observaciones Generales:
                </span>
                <p className="text-slate-800">{data.notes}</p>
              </div>
            )}

            {/* Signature Blocks for TRA and REC */}
            {(data.type === 'TRA' || data.type === 'REC') && (
              <div className="pt-10 grid grid-cols-2 gap-12 text-xs text-center border-t border-slate-200">
                <div className="space-y-8">
                  <div className="border-b-2 border-slate-400 pb-1" />
                  <div>
                    <p className="font-bold text-slate-900">Firma & Aclaración</p>
                    <p className="text-[11px] text-slate-500">
                      Entregó / Despachó Mercadería ({data.originWarehouse.name})
                    </p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="border-b-2 border-slate-400 pb-1" />
                  <div>
                    <p className="font-bold text-slate-900">Firma & Aclaración</p>
                    <p className="text-[11px] text-slate-500">
                      Conforme Recibió Mercadería ({data.destinationWarehouse.name})
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Fecha Recepción: _____ / _____ / ________
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Notice */}
            <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 space-y-0.5">
              <p className="font-semibold text-slate-500">
                Comprobante interno operativo emitido por PresuERP Módulo Logística.
              </p>
              <p>
                Documento de control físico exclusivo para depósitos. No posee valor fiscal ni
                información de costos o precios.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
