import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Tabs } from '../components/ui/Tabs';
import { Button, Input, Select, Modal } from '../components/ui';
import {
  FiscalService, FiscalConfigData, FiscalPointOfSaleData,
  ElectronicInvoiceData, FiscalErrorLogData,
} from '../services/fiscal.service';
import {
  ShieldCheck, FileText, CheckCircle2, Upload, Plus, Trash2,
  Printer, QrCode, RefreshCw, Eye, Send, AlertTriangle,
  Wifi, WifiOff, Loader2, ChevronRight, Settings2, Key,
  Activity, XCircle, ToggleLeft, ToggleRight,
} from 'lucide-react';

// ─── Tipos Diagnóstico ──────────────────────────────────────────
interface ConnectionDiagnostic {
  connected: boolean;
  tokenValid: boolean;
  isRealAfipToken: boolean;
  hasCertificate: boolean;
  certificateName: string | null;
  certificateExpiration: string | null;
  certStatus: string;
  certDaysUntilExpiration: number | null;
  environment: string;
  expiration?: string;
  error?: string;
  arcaCode?: string;
  diagnosticStatus: string;
}

// ─── Componente Estado ARCA ─────────────────────────────────────
const ArcaStatusBanner: React.FC<{
  config: FiscalConfigData;
  diagnostic: ConnectionDiagnostic | null;
  testing: boolean;
  onTest: () => void;
  onGoToTab: (tab: string) => void;
}> = ({ config, diagnostic, testing, onTest, onGoToTab }) => {
  const hasCert = !!config.certificateName || diagnostic?.hasCertificate;
  const isConnected = diagnostic?.isRealAfipToken;
  const hasError = diagnostic && !diagnostic.connected && diagnostic.error;

  let statusColor = 'from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-950 border-slate-200 dark:border-slate-800';
  let statusDot = '⚪';
  let statusLabel = 'No configurado';
  let statusSub = 'Configure sus datos fiscales y suba el certificado ARCA';

  if (isConnected) {
    statusColor = 'from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 border-emerald-200 dark:border-emerald-800';
    statusDot = '🟢';
    statusLabel = 'Conectado a ARCA';
    statusSub = `Ambiente: ${config.environment} · CUIT: ${config.taxId || '—'}`;
  } else if (hasError) {
    statusColor = 'from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/20 border-rose-200 dark:border-rose-800';
    statusDot = '🔴';
    statusLabel = 'Error de conexión ARCA';
    statusSub = diagnostic?.error || 'Verificar certificado y configuración';
  } else if (hasCert) {
    statusColor = 'from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800';
    statusDot = '🟡';
    statusLabel = 'Certificado cargado';
    statusSub = 'Pruebe la conexión para verificar el estado WSAA';
  } else if (config.taxId) {
    statusColor = 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800';
    statusDot = '🔵';
    statusLabel = 'Datos fiscales cargados';
    statusSub = 'Falta cargar el certificado digital ARCA';
  }

  return (
    <div className={`rounded-2xl border bg-gradient-to-r ${statusColor} p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4`}>
      {/* Icono y estado */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="relative shrink-0">
          <div className="h-12 w-12 bg-slate-800 dark:bg-slate-700 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md">
            ARCA
          </div>
          <span className="absolute -top-1 -right-1 text-base">{statusDot}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">{statusLabel}</h3>
            {config.enabled && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                Facturación Activa
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{statusSub}</p>
          {isConnected && diagnostic?.expiration && (
            <p className="text-[10px] text-emerald-600 mt-0.5 font-medium">
              Token válido hasta {new Date(diagnostic.expiration).toLocaleString('es-AR')}
            </p>
          )}
        </div>
      </div>

      {/* Métricas rápidas */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex flex-col items-center px-3 py-1.5 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-white/80 dark:border-slate-700/50 text-xs">
          <span className="text-slate-400 text-[9px] font-bold uppercase">Ambiente</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
            {config.environment === 'PRODUCCION' ? 'Producción' : config.environment === 'HOMOLOGACION' ? 'Homologación' : 'Inactivo'}
          </span>
        </div>
        <div className="flex flex-col items-center px-3 py-1.5 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-white/80 dark:border-slate-700/50 text-xs">
          <span className="text-slate-400 text-[9px] font-bold uppercase">Certificado</span>
          <span className={`font-bold text-[11px] ${hasCert ? 'text-emerald-600' : 'text-slate-400'}`}>
            {hasCert ? (diagnostic?.certDaysUntilExpiration != null ? `Vence en ${diagnostic.certDaysUntilExpiration}d` : 'Cargado') : 'Sin cert.'}
          </span>
        </div>
        <div className="flex flex-col items-center px-3 py-1.5 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-white/80 dark:border-slate-700/50 text-xs">
          <span className="text-slate-400 text-[9px] font-bold uppercase">CUIT</span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px]">
            {config.taxId ? config.taxId.replace(/(\d{2})(\d{8})(\d)/, '$1-$2-$3') : '—'}
          </span>
        </div>
      </div>

      {/* Botón probar */}
      <button
        onClick={onTest}
        disabled={testing}
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60 shadow-sm"
      >
        {testing
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Wifi className="w-3.5 h-3.5" />
        }
        {testing ? 'Probando...' : 'Probar conexión'}
      </button>
    </div>
  );
};

// ─── Componente Wizard Pasos ────────────────────────────────────
const SetupWizard: React.FC<{
  config: FiscalConfigData;
  hasCert: boolean;
  hasPos: boolean;
  diagnostic: ConnectionDiagnostic | null;
  onGoToTab: (tab: string) => void;
}> = ({ config, hasCert, hasPos, diagnostic, onGoToTab }) => {
  const steps = [
    {
      num: 1, label: 'Datos fiscales', desc: 'CUIT, razón social, condición IVA',
      done: !!(config.taxId && config.businessName),
      tab: 'data',
    },
    {
      num: 2, label: 'Certificados', desc: 'Subir .crt y .key de AFIP',
      done: hasCert,
      tab: 'certificates',
    },
    {
      num: 3, label: 'Punto de venta', desc: 'Configurar PtoVta 00001',
      done: hasPos,
      tab: 'points_of_sale',
    },
    {
      num: 4, label: 'Probar conexión', desc: 'Validar WSAA con AFIP',
      done: !!diagnostic?.isRealAfipToken,
      tab: 'status',
    },
    {
      num: 5, label: 'Activar facturación', desc: 'Habilitar emisión de CAE',
      done: config.enabled && config.invoiceMode !== 'TICKET_INTERNO',
      tab: 'status',
    },
  ];

  const completedCount = steps.filter(s => s.done).length;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            Guía de activación ARCA
          </h3>
          <p className="text-xs text-slate-500">{completedCount} de {steps.length} pasos completados</p>
        </div>
        {/* Progress bar */}
        <div className="w-24 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {steps.map((step, idx) => (
          <React.Fragment key={step.num}>
            <button
              onClick={() => onGoToTab(step.tab)}
              className={`flex flex-col items-center min-w-[90px] p-2 rounded-xl transition-all group hover:bg-white dark:hover:bg-slate-900 ${
                step.done ? 'opacity-100' : 'opacity-70'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold mb-1.5 transition-colors ${
                step.done
                  ? 'bg-emerald-500 text-white shadow-emerald-200 shadow-md'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 group-hover:bg-primary-100 group-hover:text-primary-600'
              }`}>
                {step.done ? <CheckCircle2 className="w-4 h-4" /> : step.num}
              </div>
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 text-center leading-tight">{step.label}</span>
              <span className="text-[10px] text-slate-400 text-center leading-tight mt-0.5">{step.desc}</span>
            </button>
            {idx < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700 mt-3 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ─── Componente Panel de Test Connection ───────────────────────
const ConnectionTestPanel: React.FC<{
  diagnostic: ConnectionDiagnostic | null;
  testing: boolean;
  lastTested: string | null;
  onTest: () => void;
}> = ({ diagnostic, testing, lastTested, onTest }) => {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-950/50 rounded-lg">
            <Activity className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Diagnóstico de Conexión WSAA</h4>
            <p className="text-xs text-slate-500">
              {lastTested ? `Última prueba: ${lastTested}` : 'Sin prueba realizada aún'}
            </p>
          </div>
        </div>
        <Button
          onClick={onTest}
          disabled={testing}
          variant="primary"
          size="sm"
          className="gap-1.5"
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {testing ? 'Probando WSAA...' : 'Probar Conexión ARCA'}
        </Button>
      </div>

      {/* Result */}
      <div className="p-5">
        {!diagnostic && !testing && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <WifiOff className="w-10 h-10 text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-500">Haga click en "Probar Conexión ARCA" para verificar la autenticación WSAA en tiempo real.</p>
          </div>
        )}

        {testing && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Conectando con servidores AFIP WSAA...</p>
            <p className="text-xs text-slate-400">Esto puede tardar hasta 12 segundos</p>
          </div>
        )}

        {diagnostic && !testing && (
          <div className="space-y-4">
            {/* Estado general */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${
              diagnostic.isRealAfipToken
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                : diagnostic.connected
                ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
                : 'bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800'
            }`}>
              {diagnostic.isRealAfipToken
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                : diagnostic.connected
                ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                : <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
              }
              <div>
                <p className={`text-sm font-extrabold ${
                  diagnostic.isRealAfipToken ? 'text-emerald-800 dark:text-emerald-300'
                  : diagnostic.connected ? 'text-amber-800 dark:text-amber-300'
                  : 'text-rose-800 dark:text-rose-300'
                }`}>
                  {diagnostic.diagnosticStatus}
                </p>
                {diagnostic.error && (
                  <p className="text-xs text-rose-600 mt-0.5">{diagnostic.error}</p>
                )}
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Token WSAA', value: diagnostic.tokenValid ? '✅ Válido' : '❌ Inválido', sub: diagnostic.isRealAfipToken ? 'Token real AFIP' : 'Token local' },
                { label: 'Sign WSAA', value: diagnostic.connected ? '✅ Presente' : '❌ Ausente', sub: 'Firma de sesión' },
                { label: 'Ambiente', value: diagnostic.environment === 'PRODUCCION' ? 'Producción' : 'Homologación', sub: diagnostic.environment },
                { label: 'Certificado', value: diagnostic.hasCertificate ? '✅ Cargado' : '❌ Sin cert.', sub: diagnostic.certStatus },
              ].map((m) => (
                <div key={m.label} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{m.label}</p>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white">{m.value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{m.sub}</p>
                </div>
              ))}
            </div>

            {/* Info de expiración */}
            {diagnostic.isRealAfipToken && diagnostic.expiration && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-emerald-700 dark:text-emerald-300">
                  Token expira: <strong>{new Date(diagnostic.expiration).toLocaleString('es-AR')}</strong>
                  {diagnostic.certDaysUntilExpiration != null && ` · Certificado vence en ${diagnostic.certDaysUntilExpiration} días`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Página Principal ───────────────────────────────────────────
export const FiscalSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastTested, setLastTested] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<ConnectionDiagnostic | null>(null);

  // Config State
  const [config, setConfig] = useState<FiscalConfigData>({
    enabled: false,
    environment: 'HOMOLOGACION',
    taxId: '',
    businessName: '',
    tradeName: '',
    ivaCondition: 'RESPONSABLE_INSCRIPTO',
    iibb: '',
    province: '',
    fiscalAddress: '',
    certificateName: '',
    invoiceMode: 'AUTOMATIC',
  });

  // Certificado y clave privada pendiente de subida
  const [pendingCertContent, setPendingCertContent] = useState('');
  const [pendingKeyContent, setPendingKeyContent] = useState('');
  const [pendingCertName, setPendingCertName] = useState('');
  const [uploadingCert, setUploadingCert] = useState(false);

  // Puntos de venta state
  const [pointsOfSale, setPointsOfSale] = useState<FiscalPointOfSaleData[]>([]);
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [newPosNumber, setNewPosNumber] = useState<number>(1);
  const [newPosDescription, setNewPosDescription] = useState('');

  // Comprobantes state
  const [invoices, setInvoices] = useState<ElectronicInvoiceData[]>([]);
  const [errorLogs, setErrorLogs] = useState<FiscalErrorLogData[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<ElectronicInvoiceData | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState(false);
  const [creditNoteReason, setCreditNoteReason] = useState('Anulación de venta');

  useEffect(() => { loadFiscalData(); }, []);

  const loadFiscalData = async () => {
    setLoading(true);
    try {
      const [cfg, pos, invData, repData] = await Promise.all([
        FiscalService.getConfig(),
        FiscalService.getPointsOfSale(),
        FiscalService.getInvoices({ limit: 50 }),
        FiscalService.getFiscalReport(),
      ]);
      if (cfg) setConfig(cfg);
      if (pos) setPointsOfSale(pos);
      if (invData?.items) setInvoices(invData.items);
      if (repData?.errorLogs) setErrorLogs(repData.errorLogs);
    } catch (e) {
      console.error('Error al cargar datos fiscales', e);
    } finally {
      setLoading(false);
    }
  };

  // Test Connection — resultado inline sin alert
  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    try {
      const res = await FiscalService.testConnection();
      setDiagnostic(res);
      setLastTested(new Date().toLocaleString('es-AR'));
    } catch (e: any) {
      setDiagnostic({
        connected: false, tokenValid: false, isRealAfipToken: false,
        hasCertificate: false, certificateName: null, certificateExpiration: null,
        certStatus: 'ERROR', certDaysUntilExpiration: null,
        environment: config.environment, error: e.message,
        diagnosticStatus: `🔴 Error: ${e.message}`,
      });
      setLastTested(new Date().toLocaleString('es-AR'));
    } finally {
      setTesting(false);
    }
  }, [config.environment]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const updated = await FiscalService.updateConfig(config);
      setConfig(prev => ({ ...prev, ...updated }));
    } catch (e: any) {
      alert(`Error al guardar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    const newEnabled = !config.enabled;
    if (newEnabled && !config.certificateName) {
      if (!confirm('Activar facturación sin certificado ARCA registrado. Las facturas quedarán en estado PENDING hasta cargar el certificado. ¿Continuar?')) return;
    }
    const newConfig = { ...config, enabled: newEnabled };
    setConfig(newConfig);
    try {
      await FiscalService.updateConfig({ enabled: newEnabled });
    } catch (e: any) {
      setConfig(config);
      alert(`Error: ${e.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setPendingCertContent(evt.target?.result as string);
      setPendingCertName(file.name);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleKeyUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => setPendingKeyContent(evt.target?.result as string);
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUploadCertificate = async () => {
    if (!pendingCertContent) { alert('Seleccione un archivo de certificado (.crt o .pem).'); return; }
    try {
      setUploadingCert(true);
      const result = await FiscalService.uploadCertificate({
        name: pendingCertName,
        content: pendingCertContent,
        privateKeyContent: pendingKeyContent || undefined,
      });
      const daysMsg = result.daysUntilExpiration != null ? ` — vence en ${result.daysUntilExpiration} días` : '';
      alert(`✅ Certificado "${result.certificateName}" registrado correctamente.${daysMsg}`);
      setPendingCertContent(''); setPendingKeyContent(''); setPendingCertName('');
      loadFiscalData();
      // Limpiar diagnóstico previo para que vuelvan a probar
      setDiagnostic(null);
    } catch (err: any) {
      alert(`❌ Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setUploadingCert(false);
    }
  };

  const handleCreatePos = async () => {
    if (!newPosNumber || newPosNumber < 1) { alert('Ingrese un número de punto de venta válido.'); return; }
    try {
      await FiscalService.createPointOfSale({
        number: Number(newPosNumber),
        description: newPosDescription || `Punto de Venta ${newPosNumber}`,
        active: true,
      });
      setIsPosModalOpen(false); setNewPosDescription('');
      loadFiscalData();
    } catch (e: any) { alert(`Error al crear punto de venta: ${e.message}`); }
  };

  const handleDeletePos = async (id: string) => {
    if (!confirm('¿Desea eliminar este punto de venta fiscal?')) return;
    try { await FiscalService.deletePointOfSale(id); loadFiscalData(); }
    catch (e: any) { alert(`Error al eliminar: ${e.message}`); }
  };

  const handleRequestCaeManual = async (invId: string) => {
    try {
      setSaving(true);
      await FiscalService.requestCaeForPendingInvoice(invId);
      loadFiscalData();
    } catch (e: any) { alert(`Error al solicitar CAE: ${e.message}`); }
    finally { setSaving(false); }
  };

  const handleEmitCreditNote = async () => {
    if (!selectedInvoice) return;
    try {
      setSaving(true);
      await FiscalService.createCreditNote(selectedInvoice.id, creditNoteReason);
      setIsCreditNoteModalOpen(false);
      loadFiscalData();
    } catch (e: any) { alert(`Error al emitir Nota de Crédito: ${e.message}`); }
    finally { setSaving(false); }
  };

  const getVoucherBadge = (type: string) => {
    if (type.includes('FACTURA_A')) return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200">Factura A</span>;
    if (type.includes('FACTURA_B')) return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200">Factura B</span>;
    if (type.includes('FACTURA_C')) return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200">Factura C</span>;
    if (type.includes('NOTA_CREDITO')) return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200">Nota de Crédito</span>;
    return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{type}</span>;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'AUTHORIZED') return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">🟢 Autorizada</span>;
    if (status === 'PENDING') return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">🟡 Pendiente</span>;
    if (status === 'REQUESTED') return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">🔵 Solicitando</span>;
    if (status === 'REJECTED') return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">🔴 Rechazada</span>;
    return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">{status}</span>;
  };

  const hasCert = !!(config.certificateName || diagnostic?.hasCertificate);
  const hasPos = pointsOfSale.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20">
      <PageHeader
        title="Facturación Electrónica Argentina (ARCA / AFIP)"
        subtitle="Integración fiscal multi-tenant · Credenciales cifradas AES-256 · WSFEv1 · QR Oficial AFIP"
      />

      {/* ── BANNER DE ESTADO ── */}
      <ArcaStatusBanner
        config={config}
        diagnostic={diagnostic}
        testing={testing}
        onTest={handleTestConnection}
        onGoToTab={(tab) => setActiveTab(tab)}
      />

      {/* ── WIZARD DE PASOS ── */}
      <SetupWizard
        config={config}
        hasCert={hasCert}
        hasPos={hasPos}
        diagnostic={diagnostic}
        onGoToTab={(tab) => setActiveTab(tab)}
      />

      {/* ── TABS ── */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <Tabs
          variant="underline"
          className="px-4"
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={[
            // ─── TAB 1: ESTADO Y CONEXIÓN ───────────────────────────
            {
              id: 'overview',
              label: '🔌 Estado ARCA',
              content: (
                <div className="p-6 space-y-6">
                  {/* Panel de Test Connection */}
                  <ConnectionTestPanel
                    diagnostic={diagnostic}
                    testing={testing}
                    lastTested={lastTested}
                    onTest={handleTestConnection}
                  />

                  {/* Switch Activación */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-primary-500" /> Modo de facturación
                      </h4>
                    </div>
                    <div className="p-5 space-y-4">
                      {/* Toggle principal */}
                      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${config.enabled ? 'bg-emerald-100 dark:bg-emerald-950/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                            <ShieldCheck className={`w-5 h-5 ${config.enabled ? 'text-emerald-600' : 'text-slate-400'}`} />
                          </div>
                          <div>
                            <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                              Facturación electrónica ARCA
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {config.enabled
                                ? 'Activa — las ventas POS intentarán obtener CAE automáticamente'
                                : 'Inactiva — las ventas usan ticket interno sin CAE'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleToggleEnabled}
                          className="flex items-center gap-2 focus:outline-none"
                        >
                          {config.enabled
                            ? <ToggleRight className="w-9 h-9 text-emerald-500" />
                            : <ToggleLeft className="w-9 h-9 text-slate-400" />
                          }
                        </button>
                      </div>

                      {/* Advertencia si se activa sin cert */}
                      {config.enabled && !hasCert && (
                        <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <p>
                            <strong>Advertencia:</strong> La facturación está activa pero no hay un certificado ARCA cargado.
                            Las facturas quedarán en estado <strong>PENDING</strong> hasta que suba el certificado en la pestaña "Certificados".
                          </p>
                        </div>
                      )}

                      {/* Advertencia producción */}
                      {config.environment === 'PRODUCCION' && (
                        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <p>
                            <strong>Modo Producción activo.</strong> Los comprobantes emitidos son <strong>documentos fiscales reales</strong> con validez legal ante AFIP.
                            Solo active este modo con certificado de producción válido.
                          </p>
                        </div>
                      )}

                      {/* Selectores de ambiente y modo */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Ambiente de operación</label>
                          <Select
                            value={config.environment || 'HOMOLOGACION'}
                            onChange={e => setConfig({ ...config, environment: e.target.value as any })}
                            options={[
                              { value: 'INACTIVA', label: 'Inactiva (Solo Tickets Internos)' },
                              { value: 'HOMOLOGACION', label: 'Homologación — Testing ARCA' },
                              { value: 'PRODUCCION', label: 'Producción — Comprobantes Reales' },
                            ]}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Modo de comprobante en POS</label>
                          <Select
                            value={config.invoiceMode || 'AUTOMATIC'}
                            onChange={e => setConfig({ ...config, invoiceMode: e.target.value as any })}
                            options={[
                              { value: 'TICKET_INTERNO', label: 'Ticket Interno (Sin CAE)' },
                              { value: 'AUTOMATIC', label: 'Facturación Automática al vender' },
                              { value: 'MANUAL', label: 'Facturación Manual a demanda' },
                            ]}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveConfig} disabled={saving} variant="primary">
                          {saving ? 'Guardando...' : 'Guardar modo ARCA'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ),
            },

            // ─── TAB 2: DATOS FISCALES ──────────────────────────────
            {
              id: 'data',
              label: '🏢 Datos Fiscales',
              content: (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Razón Social</label>
                      <Input value={config.businessName || ''} onChange={e => setConfig({ ...config, businessName: e.target.value })} placeholder="Ej: Prueba ERP S.A." />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre Comercial</label>
                      <Input value={config.tradeName || ''} onChange={e => setConfig({ ...config, tradeName: e.target.value })} placeholder="Ej: PresuERP Comercio" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">CUIT (11 dígitos sin guiones)</label>
                      <Input value={config.taxId || ''} onChange={e => setConfig({ ...config, taxId: e.target.value })} placeholder="Ej: 30712345678" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Condición frente al IVA</label>
                      <Select
                        value={config.ivaCondition || 'RESPONSABLE_INSCRIPTO'}
                        onChange={e => setConfig({ ...config, ivaCondition: e.target.value })}
                        options={[
                          { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' },
                          { value: 'MONOTRIBUTO', label: 'Monotributo' },
                          { value: 'EXENTO', label: 'Exento' },
                          { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Ingresos Brutos (IIBB)</label>
                      <Input value={config.iibb || ''} onChange={e => setConfig({ ...config, iibb: e.target.value })} placeholder="Ej: 30-71234567-8" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Provincia</label>
                      <Input value={config.province || ''} onChange={e => setConfig({ ...config, province: e.target.value })} placeholder="Ej: Buenos Aires / CABA" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Domicilio Fiscal</label>
                      <Input value={config.fiscalAddress || ''} onChange={e => setConfig({ ...config, fiscalAddress: e.target.value })} placeholder="Ej: Av. Corrientes 1234, CABA" />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button onClick={handleSaveConfig} disabled={saving} variant="primary">
                      {saving ? 'Guardando...' : 'Guardar Datos Fiscales'}
                    </Button>
                  </div>
                </div>
              ),
            },

            // ─── TAB 3: CERTIFICADOS ────────────────────────────────
            {
              id: 'certificates',
              label: '🔐 Certificados',
              content: (
                <div className="p-6 space-y-6">
                  {/* Estado credencial actual */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Credencial cifrada vigente</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5 uppercase text-[10px] font-bold">Nombre</span>
                        <strong className="text-slate-900 dark:text-white block">{config.certificateName || 'Sin certificado'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 uppercase text-[10px] font-bold">Vencimiento</span>
                        <strong className={`block ${config.certificateExpiration ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                          {config.certificateExpiration ? new Date(config.certificateExpiration).toLocaleDateString('es-AR') : 'N/A'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 uppercase text-[10px] font-bold">Coincidencia RSA</span>
                        {diagnostic?.hasCertificate
                          ? <span className="inline-flex items-center gap-1 font-bold text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Verificada</span>
                          : <span className="text-slate-400">—</span>
                        }
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5 uppercase text-[10px] font-bold">Custodia</span>
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600"><CheckCircle2 className="w-3 h-3" /> AES-256-CBC</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Certificado .crt / .pem */}
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 dark:bg-primary-950/30 rounded-lg">
                          <FileText className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            Certificado Digital
                            <span className="ml-2 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-mono rounded">.crt / .pem / .cer</span>
                          </h4>
                          <p className="text-xs text-slate-400">Certificado X.509 emitido por AFIP/ARCA para su CUIT</p>
                        </div>
                      </div>
                      {pendingCertName && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {pendingCertName} — listo para subir
                        </div>
                      )}
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-colors">
                        <Upload className="w-4 h-4" /> Seleccionar Certificado
                        <input type="file" onChange={handleFileUpload} accept=".crt,.pem,.cer" className="hidden" />
                      </label>
                    </div>

                    {/* Clave Privada .key / .pem */}
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-950/30 rounded-lg">
                          <Key className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            Clave Privada RSA
                            <span className="ml-2 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-mono rounded">.key / .pem</span>
                          </h4>
                          <p className="text-xs text-slate-400">Par de clave privada correspondiente al certificado. Cifrada con AES-256 en el servidor.</p>
                        </div>
                      </div>
                      {pendingKeyContent && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Clave privada en memoria — lista para cifrar
                        </div>
                      )}
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer transition-colors">
                        <Key className="w-4 h-4" /> Seleccionar Clave Privada
                        <input type="file" onChange={handleKeyUpload} accept=".key,.pem" className="hidden" />
                      </label>
                    </div>

                    {/* Botón subida */}
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={handleUploadCertificate}
                        disabled={!pendingCertContent || uploadingCert}
                        variant="primary"
                        size="sm"
                        className="gap-1.5"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingCert ? 'Validando y cifrando...' : 'Cifrar y Registrar Certificado'}
                      </Button>
                      {pendingCertContent && !pendingKeyContent && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Sin clave privada la firma CMS no funcionará — WSAA rechazará la autenticación
                        </p>
                      )}
                    </div>

                    {/* Info de seguridad */}
                    <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300">
                      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                      <p>
                        Los certificados nunca se almacenan como archivos físicos. Se cifran con <strong>AES-256-CBC</strong> inmediatamente al subir y se desencriptan en memoria solo en el momento de la firma CMS.
                      </p>
                    </div>
                  </div>
                </div>
              ),
            },

            // ─── TAB 4: PUNTOS DE VENTA ─────────────────────────────
            {
              id: 'points_of_sale',
              label: '🏪 Puntos de Venta',
              content: (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Puntos de Venta Fiscales Habilitados</h3>
                      <p className="text-xs text-slate-500">Puntos de venta registrados en AFIP para la emisión de comprobantes ARCA.</p>
                    </div>
                    <Button onClick={() => setIsPosModalOpen(true)} variant="primary" size="sm" className="gap-1.5">
                      <Plus className="w-4 h-4" /> Nuevo Punto de Venta
                    </Button>
                  </div>

                  {pointsOfSale.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-10 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full"><Plus className="w-6 h-6 text-slate-400" /></div>
                      <p className="text-sm font-medium text-slate-600">Sin puntos de venta configurados</p>
                      <p className="text-xs text-slate-400">Cree el punto de venta 00001 para comenzar a emitir comprobantes ARCA</p>
                      <Button onClick={() => setIsPosModalOpen(true)} variant="outline" size="sm">Crear Punto de Venta 00001</Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-950 font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-3">Número PtoVta</th>
                            <th className="px-4 py-3">Descripción / Sucursal</th>
                            <th className="px-4 py-3">Estado</th>
                            <th className="px-4 py-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {pointsOfSale.map((pos) => (
                            <tr key={pos.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-mono font-extrabold text-slate-900 dark:text-white text-sm">
                                {String(pos.number).padStart(5, '0')}
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{pos.description}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${pos.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                  {pos.active ? '🟢 Activo' : '⚪ Inactivo'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => pos.id && handleDeletePos(pos.id)}
                                  className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                  title="Eliminar punto de venta"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ),
            },

            // ─── TAB 5: COMPROBANTES ────────────────────────────────
            {
              id: 'invoices',
              label: '📄 Comprobantes',
              content: (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Historial de Comprobantes ARCA</h3>
                      <p className="text-xs text-slate-500">Facturas autorizadas, pendientes de emisión manual o rechazadas.</p>
                    </div>
                    <Button onClick={loadFiscalData} variant="outline" size="sm" className="gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                    </Button>
                  </div>

                  {invoices.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-xs">
                      No hay comprobantes emitidos aún. Los comprobantes aparecerán aquí al realizar ventas con facturación ARCA activa.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-950 font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3">Tipo</th>
                            <th className="px-4 py-3">Nro. Comprobante</th>
                            <th className="px-4 py-3">Cliente</th>
                            <th className="px-4 py-3 font-mono">CAE / Estado</th>
                            <th className="px-4 py-3 text-right">Monto Total</th>
                            <th className="px-4 py-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                                {new Date(inv.createdAt).toLocaleString('es-AR')}
                              </td>
                              <td className="px-4 py-3">{getVoucherBadge(inv.voucherType)}</td>
                              <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{inv.fullNumber}</td>
                              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                {inv.customerName || 'Consumidor Final'}
                              </td>
                              <td className="px-4 py-3 font-mono">
                                <div className="flex flex-col gap-0.5">
                                  <div>{getStatusBadge(inv.status)}</div>
                                  {inv.cae && <span className="text-[11px] font-bold text-emerald-600">{inv.cae}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-right font-bold text-slate-900 dark:text-white">
                                ${Number(inv.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {(inv.status === 'PENDING' || inv.status === 'REJECTED') && (
                                    <button
                                      onClick={() => handleRequestCaeManual(inv.id)}
                                      className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200"
                                      title="Solicitar CAE en ARCA ahora"
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setSelectedInvoice(inv); setIsInvoiceModalOpen(true); }}
                                    className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-slate-200 dark:border-slate-800"
                                    title="Ver Factura PDF / QR AFIP"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  {inv.status === 'AUTHORIZED' && !inv.voucherType.includes('NOTA_CREDITO') && (
                                    <button
                                      onClick={() => { setSelectedInvoice(inv); setIsCreditNoteModalOpen(true); }}
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 dark:border-slate-800"
                                      title="Emitir Nota de Crédito"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ),
            },

            // ─── TAB 6: ERRORES ─────────────────────────────────────
            {
              id: 'error_logs',
              label: '⚠️ Bitácora',
              content: (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Registro de Rechazos y Fallos ARCA</h3>
                      <p className="text-xs text-slate-500">Diagnóstico de rechazos normativos, autenticación fallida y desconexiones de red.</p>
                    </div>
                  </div>
                  {errorLogs.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-10 bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      <p className="text-sm font-medium text-slate-600">Sin errores fiscales registrados</p>
                      <p className="text-xs text-slate-400">Todos los comprobantes se procesaron correctamente</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-950 font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-3">Fecha y Hora</th>
                            <th className="px-4 py-3">Código Error</th>
                            <th className="px-4 py-3">Detalle del Error</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {errorLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/50 font-mono">
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{new Date(log.createdAt).toLocaleString('es-AR')}</td>
                              <td className="px-4 py-3 font-bold text-rose-600">{log.errorCode || 'UNKNOWN'}</td>
                              <td className="px-4 py-3 font-sans text-slate-800 dark:text-slate-200">{log.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* MODAL CREAR PUNTO DE VENTA */}
      {isPosModalOpen && (
        <Modal isOpen={isPosModalOpen} onClose={() => setIsPosModalOpen(false)} title="Nuevo Punto de Venta Fiscal" size="md">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Número de Punto de Venta</label>
              <Input type="number" value={newPosNumber} onChange={e => setNewPosNumber(Number(e.target.value))} placeholder="Ej: 1 (se formatea como 00001)" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Descripción / Sucursal</label>
              <Input value={newPosDescription} onChange={e => setNewPosDescription(e.target.value)} placeholder="Ej: Sucursal Centro / POS 1" />
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" onClick={() => setIsPosModalOpen(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleCreatePos}>Crear Punto de Venta</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL IMPRESIÓN FACTURA */}
      {isInvoiceModalOpen && selectedInvoice && (
        <Modal isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} title={`Comprobante Fiscal ARCA — ${selectedInvoice.fullNumber}`} size="7xl">
          <div className="space-y-6">
            <div className="bg-white text-slate-900 p-8 rounded-xl border border-slate-300 space-y-6 font-sans">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold uppercase">{config.businessName || 'RAZÓN SOCIAL EMPRESA'}</h2>
                  <p className="text-xs text-slate-600">{config.fiscalAddress || 'Domicilio Fiscal Registrado'}</p>
                  <p className="text-xs text-slate-600">Condición IVA: {config.ivaCondition || 'Responsable Inscripto'}</p>
                </div>
                <div className="text-center border-2 border-slate-900 px-4 py-2 font-mono font-extrabold text-2xl">
                  {selectedInvoice.voucherType.includes('FACTURA_A') ? 'A' : selectedInvoice.voucherType.includes('FACTURA_B') ? 'B' : 'C'}
                </div>
                <div className="text-right font-mono">
                  <h3 className="text-lg font-bold">{selectedInvoice.voucherType}</h3>
                  <p className="text-sm font-extrabold text-primary-700">Nº {selectedInvoice.fullNumber}</p>
                  <p className="text-xs text-slate-600">Fecha: {new Date(selectedInvoice.createdAt).toLocaleDateString('es-AR')}</p>
                  <p className="text-xs text-slate-600">CUIT: {config.taxId || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded border border-slate-200">
                <div><strong>Cliente:</strong> {selectedInvoice.customerName || 'Consumidor Final'}</div>
                <div><strong>Documento:</strong> {selectedInvoice.docType === 80 ? 'CUIT' : 'DNI'}: {selectedInvoice.docNumber}</div>
              </div>

              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 uppercase font-bold text-slate-700">
                    <th className="py-2">Detalle</th>
                    <th className="py-2 text-right">Cant.</th>
                    <th className="py-2 text-right">P. Unit.</th>
                    <th className="py-2 text-right">IVA %</th>
                    <th className="py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {selectedInvoice.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-sans font-medium">{it.description}</td>
                      <td className="py-2 text-right">{Number(it.quantity)}</td>
                      <td className="py-2 text-right">${Number(it.unitPrice).toFixed(2)}</td>
                      <td className="py-2 text-right">{Number(it.vatRate)}%</td>
                      <td className="py-2 text-right">${Number(it.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-end border-t-2 border-slate-900 pt-4 font-mono">
                <div className="flex items-center gap-3">
                  <div className="p-2 border border-slate-400 rounded bg-slate-50 text-center">
                    <QrCode className="w-12 h-12 text-slate-800 mx-auto" />
                    <span className="text-[9px] block text-slate-500 font-sans">AFIP / ARCA QR</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <p><strong>CAE Nº:</strong> <span className="text-slate-900 font-bold">{selectedInvoice.cae || 'N/A'}</span></p>
                    <p><strong>Vto. CAE:</strong> {selectedInvoice.caeExpiration ? new Date(selectedInvoice.caeExpiration).toLocaleDateString('es-AR') : 'N/A'}</p>
                    {selectedInvoice.qrUrl && (
                      <a href={selectedInvoice.qrUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary-600 underline block mt-1">
                        Verificar QR AFIP Oficial ↗
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs text-slate-600">Subtotal: ${Number(selectedInvoice.subtotal).toFixed(2)}</p>
                  <p className="text-xs text-slate-600">IVA: ${Number(selectedInvoice.vatAmount).toFixed(2)}</p>
                  <h3 className="text-lg font-extrabold text-slate-900">Total: ${Number(selectedInvoice.totalAmount).toFixed(2)}</h3>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => window.print()} className="gap-1.5">
                <Printer className="w-4 h-4" /> Imprimir Comprobante
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL NOTA DE CRÉDITO */}
      {isCreditNoteModalOpen && selectedInvoice && (
        <Modal isOpen={isCreditNoteModalOpen} onClose={() => setIsCreditNoteModalOpen(false)} title={`Nota de Crédito para ${selectedInvoice.fullNumber}`} size="md">
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Se solicitará la autorización a ARCA para emitir la Nota de Crédito por el monto total de <strong>${Number(selectedInvoice.totalAmount).toFixed(2)}</strong>.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Motivo de Anulación / Devolución</label>
              <Input value={creditNoteReason} onChange={e => setCreditNoteReason(e.target.value)} placeholder="Ej: Devolución de mercadería / Anulación de venta" />
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" onClick={() => setIsCreditNoteModalOpen(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleEmitCreditNote} disabled={saving}>
                {saving ? 'Emitiendo...' : 'Solicitar Nota de Crédito ARCA'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
