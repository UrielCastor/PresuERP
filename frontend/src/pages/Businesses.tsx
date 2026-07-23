import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { DataGrid } from '../components/ui/DataGrid';
import { Card, CardContent } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { BusinessService, BusinessData } from '../services/business.service';
import { Building2, Search, Plus, MapPin, Mail, Phone, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Businesses: React.FC = () => {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentBusiness, setCurrentBusiness] = useState<Partial<BusinessData>>({});

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      const data = await BusinessService.getAll();
      setBusinesses(data);
    } catch (error) {
      console.error('Error loading businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentBusiness.id) {
        await BusinessService.update(currentBusiness.id, currentBusiness);
      } else {
        await BusinessService.create({
          ...currentBusiness,
          subscriptionPlan: currentBusiness.subscriptionPlan || 'Professional',
        });
      }
      setIsModalOpen(false);
      fetchBusinesses();
    } catch (error) {
      console.error('Error saving business:', error);
      alert('Ocurrió un error al guardar la empresa. Verifique sus permisos de Administrador Global.');
    }
  };

  const suspendBusiness = async (id: string, name: string) => {
    if (confirm(`¿Está seguro de suspender la empresa ${name}? Esto bloqueará el acceso a todos sus usuarios.`)) {
      try {
        await BusinessService.suspend(id);
        fetchBusinesses();
      } catch (error) {
        console.error('Error suspending business', error);
      }
    }
  };

  const activateBusiness = async (id: string, name: string) => {
    if (confirm(`¿Está seguro de reactivar la empresa ${name}?`)) {
      try {
        await BusinessService.activate(id);
        fetchBusinesses();
      } catch (error) {
        console.error('Error activating business', error);
      }
    }
  };

  const filteredBusinesses = businesses.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.taxId.includes(searchTerm)
  );

  const columns = [
    { 
      header: 'Empresa', 
      cell: (row: any) => (
         <div className="flex flex-col">
            <span className="font-bold text-slate-800">{row.name}</span>
            <span className="text-xs text-slate-500">{row.taxId}</span>
         </div>
      )
    },
    { header: 'Plan', cell: (row:any) => <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">{row.subscriptionPlan}</span> },
    { header: 'Uso', cell: (row: any) => (
       <div className="text-xs text-slate-500 font-mono">
          <p>Users: {row._count?.users || 0}</p>
          <p>Sales: {row._count?.sales || 0}</p>
       </div>
    )},
    { header: 'Estado', cell: (row: any) => (
      <span className={`px-2 py-1 rounded text-xs font-bold ${row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
        {row.isActive ? 'Activa' : 'Inactiva'}
      </span>
    )},
    { 
      header: 'Acciones', 
      cell: (row: any) => (
        <div className="flex gap-2">
           <button onClick={() => { setCurrentBusiness(row); setIsModalOpen(true); }} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm transition-colors">
              Editar
           </button>
           {row.isActive ? (
             <button onClick={() => suspendBusiness(row.id, row.name)} className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-sm transition-colors">
                Suspender
             </button>
           ) : (
             <button onClick={() => activateBusiness(row.id, row.name)} className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded text-sm transition-colors">
                Activar
             </button>
           )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Gestión de Empresas (SaaS)"
        subtitle="Administra los perfiles de tenants y accesos globales de clientes"
        action={
          <button 
             onClick={() => { setCurrentBusiness({}); setIsModalOpen(true); }}
             className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700"
          >
             <Plus className="w-4 h-4" /> Nueva Empresa
          </button>
        }
      />

      <Card>
        <CardContent className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar Tenant..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </CardContent>
        <CardContent className="p-0">
           <DataGrid
             columns={columns}
             data={filteredBusinesses}
             isLoading={loading}
             keyExtractor={(item) => (item as any).id}
             emptyStateTitle="Sin resultados"
             emptyStateDescription="No hay empresas registradas con ese término."
           />
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentBusiness.id ? "Modificar Empresa" : "Nueva Empresa"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Comercial *</label>
               <input type="text" required value={currentBusiness.name || ''} onChange={e => setCurrentBusiness({...currentBusiness, name: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Tax ID (CUIT/RUT) *</label>
               <input type="text" required value={currentBusiness.taxId || ''} onChange={e => setCurrentBusiness({...currentBusiness, taxId: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Plan de Suscripción</label>
               <select value={currentBusiness.subscriptionPlan || 'Professional'} onChange={e => setCurrentBusiness({...currentBusiness, subscriptionPlan: e.target.value})} className="w-full p-2 border rounded-lg">
                  <option value="Basic">Basic</option>
                  <option value="Professional">Professional</option>
                  <option value="Enterprise">Enterprise</option>
               </select>
            </div>
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Email Principal</label>
               <input type="email" value={currentBusiness.email || ''} onChange={e => setCurrentBusiness({...currentBusiness, email: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Guardar Empresa
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
