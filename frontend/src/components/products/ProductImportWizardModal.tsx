import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Settings,
  Warehouse,
  Check,
  Package,
  Layers,
  HelpCircle,
  Loader2,
  FileDown,
} from 'lucide-react';

interface WarehouseOption {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  warehouses: WarehouseOption[];
  onClose: () => void;
  onSuccess: () => void;
}

type WizardStep = 'FILE_UPLOAD' | 'MAPPING' | 'OPTIONS' | 'PREVIEW';

export const ProductImportWizardModal: React.FC<Props> = ({
  isOpen,
  warehouses,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('FILE_UPLOAD');

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);

  // Mapping state: ERP Attribute -> File Header Name
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    barcode: '',
    sku: '',
    name: '',
    description: '',
    categoryName: '',
    supplierName: '',
    costPrice: '',
    salePrice: '',
    tax: '',
    initialStock: '',
  });

  // Options state
  const [duplicateStrategy, setDuplicateStrategy] = useState<'UPDATE_EXISTING' | 'CREATE_ONLY' | 'SKIP_DUPLICATES'>('UPDATE_EXISTING');
  const [updateFields, setUpdateFields] = useState({
    name: true,
    barcode: true,
    salePrice: true,
    costPrice: true,
    category: true,
    supplier: true,
  });
  const [importStock, setImportStock] = useState(true);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

  // Processing state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (warehouses.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses]);

  if (!isOpen) return null;

  // Step 1: Handle File Selection & Auto Column Detection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = e.target.files?.[0];
    if (!selected) return;

    const nameLower = selected.name.toLowerCase();
    if (!nameLower.endsWith('.xlsx') && !nameLower.endsWith('.xls') && !nameLower.endsWith('.csv')) {
      setError('Formato no válido. Debe seleccionar un archivo .xlsx, .xls o .csv.');
      return;
    }

    setFile(selected);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (json.length === 0) {
          setError('El archivo seleccionado está vacío o no contiene filas de datos.');
          return;
        }

        const headers = Object.keys(json[0]);
        setRawHeaders(headers);
        setRawRows(json);

        // Auto-match headers based on smart aliases
        const initialMap: Record<string, string> = { ...columnMapping };
        headers.forEach((h) => {
          const hClean = h.trim().toLowerCase();
          if (['codigo', 'código', 'barcode', 'codigo barra', 'ean'].includes(hClean)) {
            initialMap.barcode = h;
          } else if (['sku', 'codigo interno', 'código interno'].includes(hClean)) {
            initialMap.sku = h;
          } else if (['producto', 'nombre', 'name', 'articulo', 'artículo'].includes(hClean)) {
            initialMap.name = h;
          } else if (['descripcion', 'descripción', 'description'].includes(hClean)) {
            initialMap.description = h;
          } else if (['categoria', 'categoría', 'category'].includes(hClean)) {
            initialMap.categoryName = h;
          } else if (['proveedor', 'supplier'].includes(hClean)) {
            initialMap.supplierName = h;
          } else if (['costo', 'costo compra', 'cost', 'precio costo'].includes(hClean)) {
            initialMap.costPrice = h;
          } else if (['precio', 'precio venta', 'sale price', 'p.venta', 'venta'].includes(hClean)) {
            initialMap.salePrice = h;
          } else if (['iva', 'tax', 'alicuota'].includes(hClean)) {
            initialMap.tax = h;
          } else if (['stock', 'cantidad', 'stock inicial'].includes(hClean)) {
            initialMap.initialStock = h;
          }
        });

        setColumnMapping(initialMap);
      } catch (err) {
        console.error(err);
        setError('Error al leer el archivo Excel/CSV. Verifique el formato.');
      }
    };
    reader.readAsBinaryString(selected);
  };

  // Download official Excel template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        CODIGO: '7790012345678',
        PRODUCTO: 'Gaseosa Cola 2.25L',
        DESCRIPCION: 'Bebida gaseosa sabor cola',
        CATEGORIA: 'Bebidas',
        PROVEEDOR: 'Distribuidora Central',
        COSTO: 1200,
        PRECIO: 1800,
        IVA: 21,
        STOCK: 50,
      },
      {
        CODIGO: '7790087654321',
        PRODUCTO: 'Agua Mineral 1.5L',
        DESCRIPCION: 'Agua mineral sin gas',
        CATEGORIA: 'Bebidas',
        PROVEEDOR: 'Distribuidora Central',
        COSTO: 600,
        PRECIO: 950,
        IVA: 21,
        STOCK: 100,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'plantilla_importacion_productos.xlsx');
  };

  // Step 2 & 3: Transform raw rows to normalized import rows
  const getMappedRows = () => {
    return rawRows.map((r) => ({
      barcode: columnMapping.barcode ? String(r[columnMapping.barcode] || '').trim() : undefined,
      sku: columnMapping.sku ? String(r[columnMapping.sku] || '').trim() : undefined,
      name: columnMapping.name ? String(r[columnMapping.name] || '').trim() : '',
      description: columnMapping.description ? String(r[columnMapping.description] || '').trim() : '',
      categoryName: columnMapping.categoryName ? String(r[columnMapping.categoryName] || '').trim() : 'General',
      supplierName: columnMapping.supplierName ? String(r[columnMapping.supplierName] || '').trim() : undefined,
      costPrice: columnMapping.costPrice ? Number(r[columnMapping.costPrice]) || 0 : 0,
      salePrice: columnMapping.salePrice ? Number(r[columnMapping.salePrice]) || 0 : 0,
      tax: columnMapping.tax ? Number(r[columnMapping.tax]) || 21 : 21,
      initialStock: columnMapping.initialStock ? Number(r[columnMapping.initialStock]) || 0 : 0,
    }));
  };

  // Submit Final Import Payload to Backend
  const handleConfirmImport = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const mappedRows = getMappedRows();
      const payload = {
        fileName: file?.name || 'importacion.xlsx',
        rows: mappedRows,
        duplicateStrategy,
        updateFields,
        importStock,
        warehouseId: selectedWarehouseId,
      };

      const res = await api.post('/products/import', payload);
      alert(
        `Importación completada con éxito:\n\n• Creados: ${res.data.data.createdCount}\n• Actualizados: ${res.data.data.updatedCount}\n• Errores: ${res.data.data.errorCount}`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.message || 'Error al procesar la importación masiva de productos.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const mappedRowsPreview = getMappedRows();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 font-sans animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 max-w-4xl w-full rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="p-5 bg-indigo-600 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-md">
              <FileSpreadsheet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Importador Masivo de Productos</h2>
              <p className="text-xs text-white/80">Migración veloz de catálogo desde Excel / CSV hacia PresuERP</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Wizard Steps Breadcrumb */}
        <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 px-6 py-3 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
          <div className={`flex items-center gap-2 ${currentStep === 'FILE_UPLOAD' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-current flex items-center justify-center text-white text-[10px]">1</span>
            <span>Carga de Archivo</span>
          </div>

          <div className={`flex items-center gap-2 ${currentStep === 'MAPPING' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-current flex items-center justify-center text-white text-[10px]">2</span>
            <span>Relacionar Columnas</span>
          </div>

          <div className={`flex items-center gap-2 ${currentStep === 'OPTIONS' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-current flex items-center justify-center text-white text-[10px]">3</span>
            <span>Configuración & Stock</span>
          </div>

          <div className={`flex items-center gap-2 ${currentStep === 'PREVIEW' ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-current flex items-center justify-center text-white text-[10px]">4</span>
            <span>Vista Previa & Confirmar</span>
          </div>
        </div>

        {/* Modal Scroll Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 max-h-[60vh]">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: FILE UPLOAD */}
          {currentStep === 'FILE_UPLOAD' && (
            <div className="space-y-6">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-4">
                <FileSpreadsheet className="h-12 w-12 text-indigo-500 mx-auto" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Seleccione su archivo de catálogo (.xlsx o .csv)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Formatos soportados: Microsoft Excel (.xlsx, .xls) y valores separados por comas (.csv)
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md inline-flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" /> Buscar Archivo
                </button>
              </div>

              {file && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                    <div>
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                        {file.name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {rawRows.length} filas detectadas • {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Template Download Option */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">¿Necesita la plantilla de importación?</h4>
                  <p className="text-[11px] text-slate-400">Descargue el modelo con las columnas preconfiguradas para PresuERP</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs"
                >
                  <FileDown className="h-4 w-4" /> Descargar Plantilla
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {currentStep === 'MAPPING' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 space-y-1">
                <h3 className="font-black text-slate-900 dark:text-white text-sm">Relacionar Columnas de Excel</h3>
                <p>Verifique la equivalencia entre las columnas de su archivo y los campos requeridos en PresuERP.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { key: 'name', label: 'Nombre del Producto *', required: true },
                  { key: 'barcode', label: 'Código de Barras (EAN/GTIN)', required: false },
                  { key: 'sku', label: 'Código Interno / SKU', required: false },
                  { key: 'costPrice', label: 'Precio Costo ($)', required: false },
                  { key: 'salePrice', label: 'Precio Venta ($)', required: false },
                  { key: 'categoryName', label: 'Categoría', required: false },
                  { key: 'supplierName', label: 'Proveedor', required: false },
                  { key: 'initialStock', label: 'Stock Inicial', required: false },
                  { key: 'description', label: 'Descripción', required: false },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
                  >
                    <label className="text-xs font-bold text-slate-900 dark:text-white flex-1">
                      {item.label}
                    </label>

                    <select
                      value={columnMapping[item.key] || ''}
                      onChange={(e) =>
                        setColumnMapping({ ...columnMapping, [item.key]: e.target.value })
                      }
                      className="w-48 p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                    >
                      <option value="">-- No asignar --</option>
                      {rawHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: IMPORT OPTIONS */}
          {currentStep === 'OPTIONS' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <h3 className="font-black text-slate-900 dark:text-white text-sm">
                  Tratamiento de Productos Existentes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1 ${
                      duplicateStrategy === 'UPDATE_EXISTING'
                        ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="strategy"
                        checked={duplicateStrategy === 'UPDATE_EXISTING'}
                        onChange={() => setDuplicateStrategy('UPDATE_EXISTING')}
                        className="h-4 w-4 text-indigo-600"
                      />
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">Actualizar Existentes</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Actualiza precios y datos si el código ya existe
                    </p>
                  </label>

                  <label
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1 ${
                      duplicateStrategy === 'CREATE_ONLY'
                        ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="strategy"
                        checked={duplicateStrategy === 'CREATE_ONLY'}
                        onChange={() => setDuplicateStrategy('CREATE_ONLY')}
                        className="h-4 w-4 text-indigo-600"
                      />
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">Crear Solo Nuevos</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Ignora productos que ya estén registrados
                    </p>
                  </label>

                  <label
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1 ${
                      duplicateStrategy === 'SKIP_DUPLICATES'
                        ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="strategy"
                        checked={duplicateStrategy === 'SKIP_DUPLICATES'}
                        onChange={() => setDuplicateStrategy('SKIP_DUPLICATES')}
                        className="h-4 w-4 text-indigo-600"
                      />
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">Omitir Duplicados</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      No altera productos existentes en catálogo
                    </p>
                  </label>
                </div>
              </div>

              {/* Stock Configuration */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importStock}
                    onChange={(e) => setImportStock(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 rounded"
                  />
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                    Importar Existencias de Stock Inicial
                  </span>
                </label>

                {importStock && (
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Depósito Destino para el Stock Inicial *
                    </label>
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: PREVIEW */}
          {currentStep === 'PREVIEW' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-black">Total Filas</span>
                  <span className="text-base font-black text-slate-900 dark:text-white block">
                    {mappedRowsPreview.length}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                  <span className="text-[10px] text-emerald-600 uppercase font-black">Con Código</span>
                  <span className="text-base font-black text-emerald-600 block">
                    {mappedRowsPreview.filter((r) => r.barcode || r.sku).length}
                  </span>
                </div>

                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 text-center">
                  <span className="text-[10px] text-indigo-600 uppercase font-black">Con Stock Inicial</span>
                  <span className="text-base font-black text-indigo-600 block">
                    {mappedRowsPreview.filter((r) => r.initialStock > 0).length}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Código</th>
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5">Categoría</th>
                      <th className="p-2.5 text-right">Costo</th>
                      <th className="p-2.5 text-right">Precio Venta</th>
                      <th className="p-2.5 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {mappedRowsPreview.slice(0, 50).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-mono text-slate-500">{r.barcode || r.sku || '-'}</td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">{r.name}</td>
                        <td className="p-2.5 text-slate-500">{r.categoryName}</td>
                        <td className="p-2.5 text-right font-mono text-slate-600">${r.costPrice}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-600">${r.salePrice}</td>
                        <td className="p-2.5 text-right font-mono text-indigo-600 font-bold">{r.initialStock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            {currentStep !== 'FILE_UPLOAD' && (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 'MAPPING') setCurrentStep('FILE_UPLOAD');
                  if (currentStep === 'OPTIONS') setCurrentStep('MAPPING');
                  if (currentStep === 'PREVIEW') setCurrentStep('OPTIONS');
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Anterior
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-100"
            >
              Cancelar
            </button>

            {currentStep === 'FILE_UPLOAD' && (
              <button
                type="button"
                disabled={!file}
                onClick={() => setCurrentStep('MAPPING')}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                Siguiente <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {currentStep === 'MAPPING' && (
              <button
                type="button"
                disabled={!columnMapping.name}
                onClick={() => setCurrentStep('OPTIONS')}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                Siguiente <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {currentStep === 'OPTIONS' && (
              <button
                type="button"
                onClick={() => setCurrentStep('PREVIEW')}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-1.5"
              >
                Ver Vista Previa <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {currentStep === 'PREVIEW' && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmImport}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Procesando Importación...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Confirmar e Importar Productos
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
