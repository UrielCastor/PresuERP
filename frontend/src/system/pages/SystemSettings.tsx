import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import api from '@/services/api';
import { Save, Link, CheckCircle, ShieldAlert, AlertTriangle } from 'lucide-react';

export const SystemSettings: React.FC = () => {
  const [config, setConfig] = useState<any>({ environment: 'SANDBOX' });
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data } = await api.get('/system/payments/config');
      if (data.data) {
         setConfig(data.data);
      }
    } catch(e) { console.error(e); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/system/payments/config', { ...config, provider: 'MERCADO_PAGO' });
      alert('Configuración guardada exitosamente.');
    } catch (e) {
      alert('Error al guardar configuración');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      const { data } = await api.post('/system/payments/test-config');
      setTestResult(data.message || 'Error desconocido al testear conexión.');
      await fetchConfig();
    } catch (e) {
      setTestResult('Problema al comunicar con la pasarela.');
      await fetchConfig();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
      <PageHeader 
        title="Configuración SaaS"
        subtitle="Módulos nativos e integraciones comerciales de la plataforma"
      />

      <Card>
         <CardContent className="p-6">
            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
              <ShieldAlert className="w-5 h-5 text-indigo-500" /> Webhooks y Procesadores de Pago (Mercado Pago)
            </h3>
            
            <form onSubmit={handleSave} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Access Token</label>
                    <input 
                      type="password" 
                      value={config.accessToken || ''} 
                      onChange={e => setConfig({...config, accessToken: e.target.value})} 
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" 
                      placeholder="APP_USR-..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Public Key</label>
                    <input 
                      type="text" 
                      value={config.publicKey || ''} 
                      onChange={e => setConfig({...config, publicKey: e.target.value})} 
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" 
                      placeholder="APP_USR-..."
                    />
                  </div>
               </div>
               
               <div>
                 <label className="block text-sm font-medium mb-2 flex items-center gap-2">Webhook Secret <span className="text-xs text-slate-400 font-normal">(Firma Hmac)</span></label>
                 <input 
                   type="password" 
                   value={config.webhookSecret || ''} 
                   onChange={e => setConfig({...config, webhookSecret: e.target.value})} 
                   className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500" 
                 />
                 <p className="text-xs text-slate-500 mt-2">Utilice Endpoint POST: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">/api/v1/system/payments/webhook</code></p>
               </div>

               <div>
                 <label className="block text-sm font-medium mb-2">Entorno Operativo (Modo)</label>
                 <select 
                   value={config.environment || 'SANDBOX'} 
                   onChange={e => setConfig({...config, environment: e.target.value})} 
                   className="w-full md:w-1/3 p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold"
                 >
                    <option value="SANDBOX">🚧 Testing (Sandbox)</option>
                    <option value="PRODUCTION">🚀 Producción (Real)</option>
                 </select>
               </div>

               <div className="bg-slate-50 p-4 border rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="block text-xs uppercase text-slate-400 font-bold">Estado Conexión</span>
                    <span className="text-sm font-semibold flex items-center gap-1 mt-1">
                       {config.lastTestStatus === 'SUCCESS' ? <><CheckCircle className="w-4 h-4 text-emerald-500" /> <span className="text-emerald-700">Conectado</span></> : 
                        config.lastTestStatus === 'FAILED' ? <><AlertTriangle className="w-4 h-4 text-red-500" /> <span className="text-red-700">Desconectado</span></> : 
                        <span className="text-slate-500">Pendiente Prueba</span>}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase text-slate-400 font-bold">Última Prueba</span>
                    <span className="text-sm font-medium text-slate-700 mt-1 block">
                       {config.lastTestAt ? new Date(config.lastTestAt).toLocaleString('es-AR') : 'Nunca evaluado'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase text-slate-400 font-bold">SDK MP</span>
                    <span className="text-sm font-medium text-slate-700 mt-1 block tracking-widest">{config.lastTestVersion || 'v2'}</span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase text-slate-400 font-bold">Webhooks</span>
                    <span className={`text-sm font-bold mt-1 block ${config.webhookSecret ? 'text-indigo-600' : 'text-slate-400'}`}>
                       {config.webhookSecret ? 'Activo' : 'No configurado'}
                    </span>
                  </div>
               </div>

               {testResult && (
                  <div className={`p-4 border text-sm font-medium rounded-lg flex items-center gap-2 ${testResult.includes('✓') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                     {testResult.includes('✓') ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                     {testResult}
                  </div>
               )}

               <div className="pt-6 border-t flex flex-col md:flex-row gap-3">
                  <button type="button" onClick={testConnection} className="px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 flex items-center justify-center gap-2">
                     <Link className="w-4 h-4" /> Probar Conexión
                  </button>
                  <button type="submit" disabled={loading} className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-75">
                     <Save className="w-4 h-4" /> {loading ? 'Guardando...' : 'Guardar Credenciales'}
                  </button>
               </div>
            </form>
         </CardContent>
      </Card>
    </div>
  );
};
