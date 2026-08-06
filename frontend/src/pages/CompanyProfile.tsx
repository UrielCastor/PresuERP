import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { BusinessService, BusinessData, UsageMetrics } from '../services/business.service';
import { SettingsService } from '../services/settings.service';
import { LogoUploadModal } from '../components/ui/LogoUploadModal';
import { Building2, Save, MapPin, Mail, Phone, Users, Package, Users2, Truck, Warehouse, Banknote, ShoppingCart, ShoppingBag, Palette, Image as ImageIcon } from 'lucide-react';

export const CompanyProfile: React.FC = () => {
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCurrentBusiness();
  }, []);

  const fetchCurrentBusiness = async () => {
    try {
      setLoading(true);
      const [data, usage, fullSettings] = await Promise.all([
        BusinessService.getCurrent(),
        BusinessService.getUsageMetrics('current'),
        SettingsService.getSettings().catch(() => null)
      ]);
      setBusiness(data);
      setMetrics(usage);
      if (fullSettings?.settings?.logoUrl) {
        setLogoUrl(fullSettings.settings.logoUrl);
      }
    } catch (error) {
      console.error('Error fetching current business:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    try {
      setSaving(true);
      await BusinessService.updateCurrent(business);
      alert('Información guardada exitosamente.');
    } catch (error) {
      console.error('Error saving business info:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !business) {
    return <div className="p-8 text-center text-slate-500">Cargando información...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Empresa */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex items-start gap-6 shadow-sm">
        <div className="relative group w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 border border-indigo-100 dark:border-indigo-800 overflow-hidden shadow-xs cursor-pointer" onClick={() => setIsLogoModalOpen(true)}>
           {logoUrl ? (
             <img src={logoUrl} alt="Logo Empresa" className="w-full h-full object-contain p-1" />
           ) : (
             <Building2 className="w-10 h-10" />
           )}
           <div className="absolute inset-0 bg-slate-900/60 text-white font-extrabold text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
             Editar Logo
           </div>
        </div>
        <div className="flex-1">
           <div className="flex items-center justify-between">
              <div>
                 <div className="flex items-center gap-3">
                   <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{business.name}</h1>
                   <button
                     type="button"
                     onClick={() => setIsLogoModalOpen(true)}
                     className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-extrabold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                   >
                     <Palette className="h-3.5 w-3.5" /> Editar Logo
                   </button>
                 </div>
                 <p className="text-slate-500">CUIT: {business.taxId}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                 <span className={`px-3 py-1 rounded-full text-xs font-bold ${business.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {business.isActive ? 'Activo' : 'Suspendido'}
                 </span>
                 <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                    Plan: {business.subscriptionPlan || 'Professional'}
                 </span>
              </div>
           </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Información General */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4 border-b pb-2">
              <Building2 className="w-5 h-5 text-indigo-500" /> Información General
            </h2>
            <div className="grid grid-cols-1 gap-4">
               <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Comercial</label>
                 <input type="text" required value={business.name || ''} onChange={(e) => setBusiness({...business, name: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CUIT / Identificación Fiscal</label>
                 <input type="text" required value={business.taxId || ''} disabled className="w-full p-2 border rounded-lg bg-slate-50 text-slate-500 dark:bg-slate-800 dark:border-slate-700 cursor-not-allowed" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                   <input type="email" value={business.email || ''} onChange={(e) => setBusiness({...business, email: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                   <input type="text" value={business.phone || ''} onChange={(e) => setBusiness({...business, phone: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" />
                 </div>
               </div>
            </div>
          </CardContent>
        </Card>

        {/* Dirección */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4 border-b pb-2">
              <MapPin className="w-5 h-5 text-indigo-500" /> Dirección
            </h2>
            <div className="grid grid-cols-2 gap-4">
               <div className="col-span-2">
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Calle y Número</label>
                 <input type="text" value={business.address || ''} onChange={(e) => setBusiness({...business, address: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ciudad</label>
                 <input type="text" value={business.city || ''} onChange={(e) => setBusiness({...business, city: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Provincia</label>
                 <input type="text" value={business.state || ''} onChange={(e) => setBusiness({...business, state: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">País</label>
                 <input type="text" value={business.country || ''} onChange={(e) => setBusiness({...business, country: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código Postal</label>
                 <input type="text" value={business.zipCode || ''} onChange={(e) => setBusiness({...business, zipCode: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700" />
               </div>
            </div>
            
            <div className="pt-4 flex justify-end">
              <button disabled={saving} type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition">
                  <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Métricas del Sistema */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6 border-b pb-2">
            Uso del Sistema
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-center">
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
               <Users2 className="w-5 h-5 mx-auto text-blue-500 mb-2" />
               <p className="text-xl font-bold text-slate-800 dark:text-white">{metrics?.users || 0}</p>
               <p className="text-xs text-slate-500 font-medium">Usuarios</p>
             </div>
             
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
               <Package className="w-5 h-5 mx-auto text-purple-500 mb-2" />
               <p className="text-xl font-bold text-slate-800 dark:text-white">{metrics?.products || 0}</p>
               <p className="text-xs text-slate-500 font-medium">Productos</p>
             </div>
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
               <Users className="w-5 h-5 mx-auto text-emerald-500 mb-2" />
               <p className="text-xl font-bold text-slate-800 dark:text-white">{metrics?.customers || 0}</p>
               <p className="text-xs text-slate-500 font-medium">Clientes</p>
             </div>
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
               <Truck className="w-5 h-5 mx-auto text-amber-500 mb-2" />
               <p className="text-xl font-bold text-slate-800 dark:text-white">{metrics?.suppliers || 0}</p>
               <p className="text-xs text-slate-500 font-medium">Proveedores</p>
             </div>
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
               <Warehouse className="w-5 h-5 mx-auto text-slate-500 mb-2" />
               <p className="text-xl font-bold text-slate-800 dark:text-white">{metrics?.warehouses || 0}</p>
               <p className="text-xs text-slate-500 font-medium">Depósitos</p>
             </div>
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
               <Banknote className="w-5 h-5 mx-auto text-emerald-600 mb-2" />
               <p className="text-xl font-bold text-slate-800 dark:text-white">{metrics?.cashRegisters || 0}</p>
               <p className="text-xs text-slate-500 font-medium">Cajas</p>
             </div>
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
               <ShoppingCart className="w-5 h-5 mx-auto text-indigo-500 mb-2" />
               <p className="text-xl font-bold text-slate-800 dark:text-white" title={`Operaciones: ${metrics?.salesCount || 0}`}>$ {Number(metrics?.salesTotal || 0).toLocaleString()}</p>
               <p className="text-xs text-slate-500 font-medium">Ventas</p>
             </div>
             <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
               <ShoppingBag className="w-5 h-5 mx-auto text-orange-500 mb-2" />
               <p className="text-xl font-bold text-slate-800 dark:text-white" title={`Operaciones: ${metrics?.purchasesCount || 0}`}>$ {Number(metrics?.purchasesTotal || 0).toLocaleString()}</p>
               <p className="text-xs text-slate-500 font-medium">Compras</p>
             </div>
          </div>
        </CardContent>
      </Card>
      {/* Modal para Editar Logo */}
       <LogoUploadModal
         isOpen={isLogoModalOpen}
         currentLogoUrl={logoUrl}
         onClose={() => setIsLogoModalOpen(false)}
         onSuccess={(newUrl) => setLogoUrl(newUrl)}
       />
    </div>
  );
};
