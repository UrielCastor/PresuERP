import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { DataGrid } from '../../components/ui/DataGrid';
import { SystemService, Plan, PlanPrice } from '../services/system.service';
import { Plus, Save, Layers, AlertTriangle } from 'lucide-react';

export const SystemPlans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Partial<Plan>>({});
  
  // Pricing states
  const [currentPrices, setCurrentPrices] = useState<PlanPrice[]>([]);
  const [newPriceCycle, setNewPriceCycle] = useState<string>('MONTHLY');
  const [newPriceVal, setNewPriceVal] = useState<string>('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await SystemService.getPlans();
      setPlans(data);
    } catch (error) {
      console.error('Error fetching plans', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewModal = () => {
     setCurrentPlan({});
     setCurrentPrices([]);
     setIsModalOpen(true);
  };

  const handleOpenEditModal = (plan: Plan) => {
     setCurrentPlan(plan);
     setCurrentPrices(plan.prices || []);
     setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentPlan.id) {
        await SystemService.updatePlan(currentPlan.id, currentPlan);
      } else {
        await SystemService.createPlan({ ...currentPlan, active: true });
      }
      setIsModalOpen(false);
      fetchPlans();
    } catch (error) {
      console.error(error);
      alert('Error guardando estructura básica del plan');
    }
  };

  const toggleStatus = async (plan: Plan) => {
    if (plan.active) {
      if (!confirm(`¿Está seguro de desactivar el plan ${plan.name}? No podrá ser contratado.`)) return;
    }
    
    try {
      await SystemService.changePlanStatus(plan.id!, !plan.active);
      fetchPlans();
    } catch (error) {
      console.error(error);
      alert('Error cambiando estado del plan');
    }
  };

  // --- Plan Prices handlers ---

  const handleAddPrice = async () => {
    if (!currentPlan.id) return;
    if (!newPriceVal || isNaN(Number(newPriceVal))) {
       alert('Ingrese un precio numérico válido.');
       return;
    }

    // Client-side duplicate check
    const existingActive = currentPrices.find(
      p => p.billingCycle === newPriceCycle && p.active
    );
    if (existingActive) {
      alert(`Este plan ya tiene configurado el ciclo ${newPriceCycle} con estado activo.\n\nDesactive el precio existente primero o edítelo directamente.`);
      return;
    }

    // Check for inactive duplicate — confirm reactivation
    const existingInactive = currentPrices.find(
      p => p.billingCycle === newPriceCycle && !p.active
    );
    if (existingInactive) {
      if (!confirm(`Ya existe un precio inactivo para el ciclo ${newPriceCycle}.\n\n¿Desea reactivarlo con el nuevo precio $${Number(newPriceVal).toLocaleString()}?`)) {
        return;
      }
    }

    try {
       const created = await SystemService.createPlanPrice(currentPlan.id, {
          billingCycle: newPriceCycle as any,
          price: Number(newPriceVal),
          active: true
       });
       
       // If we reactivated an existing price, replace it in the list
       if (existingInactive) {
         const updatedPrices = currentPrices.map(p => 
           p.id === existingInactive.id ? created : p
         );
         setCurrentPrices(updatedPrices);
       } else {
         const updatedPrices = [...currentPrices, created];
         setCurrentPrices(updatedPrices);
       }
       setNewPriceVal('');
       fetchPlans();
    } catch (e: any) {
       console.error(e);
       const msg = e.response?.data?.message || 'Error registrando precio. Intente nuevamente.';
       alert(msg);
    }
  };

  const handleTogglePriceActive = async (priceObj: PlanPrice) => {
     if (!priceObj.id) return;
     try {
        const nextActive = !priceObj.active;
        await SystemService.changePlanPriceStatus(priceObj.id, nextActive);
        
        // Update local state
        const updatedPrices = currentPrices.map(p => p.id === priceObj.id ? { ...p, active: nextActive } : p);
        setCurrentPrices(updatedPrices);
        fetchPlans();
     } catch (e) {
        console.error(e);
        alert('Error modificando estado del precio');
     }
  };

  const handleDeletePrice = async (priceId: string) => {
     if (!confirm('¿Confirma definitivamente la eliminación de este precio?')) return;
     try {
        await SystemService.deletePlanPrice(priceId);
        
        // Update local state
        const updatedPrices = currentPrices.filter(p => p.id !== priceId);
        setCurrentPrices(updatedPrices);
        fetchPlans();
     } catch (e) {
        console.error(e);
        alert('Error eliminando el ciclo de precio del plan.');
     }
  };

  const columns = [
    { 
      header: 'Plan', 
      cell: (row: Plan) => (
        <div className="flex flex-col">
           <span className="font-bold text-slate-800">{row.name}</span>
           <span className="text-xs text-slate-500 font-mono">{row.code}</span>
        </div>
      )
    },
    { 
      header: 'Precios / Ciclos de Facturación', 
      cell: (row: Plan) => (
        <div className="flex flex-wrap gap-1.5 max-w-sm">
           {row.prices && row.prices.length > 0 ? (
              row.prices.map((p: PlanPrice) => (
                 <span key={p.id} className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${p.active ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-400 border-slate-200 line-through'}`}>
                    {p.billingCycle}: ${Number(p.price).toLocaleString()}
                 </span>
              ))
           ) : (
              <span className="text-xs text-amber-500 font-medium italic">Sin precios asociados</span>
           )}
        </div>
      )
    },
    { 
      header: 'Límites',
      cell: (row: Plan) => (
         <div className="text-sm">
            <div><span className="font-semibold text-slate-700">{row.maxUsers === 0 ? 'Ilimitado' : row.maxUsers}</span> usuarios</div>
            <div><span className="font-semibold text-slate-700">{row.maxProducts === 0 ? 'Ilimitado' : row.maxProducts}</span> productos</div>
         </div>
      )
    },
    { 
      header: 'Estado', 
      cell: (row: Plan) => (
         <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
           {row.active ? 'Activo' : 'Inactivo'}
         </span>
      )
    },
    { 
      header: 'Acciones', 
      cell: (row: Plan) => (
        <div className="flex gap-2">
           <button onClick={() => handleOpenEditModal(row)} className="px-3 py-1 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200 font-medium">
             Editar
           </button>
           <button onClick={() => toggleStatus(row)} className={`px-3 py-1 rounded text-sm font-medium ${row.active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
             {row.active ? 'Desactivar' : 'Activar'}
           </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Planes y Suscripciones (SaaS)"
        subtitle="Catálogo de tiers, límites y precios dinámicos disponibles"
        action={
          <button onClick={handleOpenNewModal} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700 shadow-sm font-medium">
             <Plus className="w-4 h-4" /> Crear Plan
          </button>
        }
      />

      <Card>
         <CardContent className="p-0">
            <DataGrid
              columns={columns}
              data={plans}
              isLoading={loading}
              keyExtractor={(item) => item.id!}
            />
         </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentPlan.id ? 'Modificar Plan SaaS' : 'Nuevo Plan SaaS'}>
         <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium mb-1">Nombre Comercial</label>
                  <input required type="text" placeholder="Ej. STARTER" value={currentPlan.name || ''} onChange={e => setCurrentPlan({...currentPlan, name: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase" />
               </div>
               <div>
                  <label className="block text-sm font-medium mb-1">Código Interno</label>
                  <input required type="text" placeholder="Ej. PLAN_STARTER_2026" value={currentPlan.code || ''} onChange={e => setCurrentPlan({...currentPlan, code: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 uppercase" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium mb-1">Max Usuarios (0 = Ilimitado)</label>
                  <input required type="number" value={currentPlan.maxUsers || 0} onChange={e => setCurrentPlan({...currentPlan, maxUsers: Number(e.target.value)})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
               </div>
               <div>
                  <label className="block text-sm font-medium mb-1">Max Productos (0 = Ilimitado)</label>
                  <input required type="number" value={currentPlan.maxProducts || 0} onChange={e => setCurrentPlan({...currentPlan, maxProducts: Number(e.target.value)})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
               </div>
            </div>

            <div>
               <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                 Características del Plan
                 <span className="text-xs text-slate-400 font-normal">(Array JSON o Texto)</span>
               </label>
               <textarea rows={3} placeholder='Ej: ["VENTAS", "COMPRAS", "CAJAS"]' value={currentPlan.features || ''} onChange={e => setCurrentPlan({...currentPlan, features: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm" />
               <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-sans">
                 <AlertTriangle className="w-3 h-3 text-amber-500" /> Las características definen los módulos y menús habilitados para el tenant.
               </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
               <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-lg text-slate-700 font-medium">Cancelar</button>
               <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 font-medium hover:bg-indigo-700">
                 <Save className="w-4 h-4" /> Guardar Estructura
               </button>
            </div>
         </form>

         {/* Multiple Price Editor Section */}
         {currentPlan.id && (
            <div className="border-t pt-4 mt-4 space-y-4">
               <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" /> Precios y Ciclos de Facturación
               </h3>
               
               <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-3 gap-2 items-end">
                  <div>
                     <label className="block text-xs font-semibold text-slate-500 mb-1">Ciclo *</label>
                     <select value={newPriceCycle} onChange={e => setNewPriceCycle(e.target.value)} className="w-full p-1.5 text-sm border rounded-lg bg-white">
                        <option value="FREE">FREE</option>
                        <option value="MONTHLY">MONTHLY</option>
                        <option value="QUARTERLY">QUARTERLY</option>
                        <option value="SEMIANNUAL">SEMIANNUAL</option>
                        <option value="YEARLY">YEARLY</option>
                        <option value="LIFETIME">LIFETIME</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-semibold text-slate-500 mb-1">Precio ($) *</label>
                     <input type="number" step="0.01" value={newPriceVal} onChange={e => setNewPriceVal(e.target.value)} placeholder="0.00" className="w-full p-1.5 text-sm border rounded-lg bg-white" />
                  </div>
                  <button type="button" onClick={handleAddPrice} className="w-full bg-indigo-600 text-white rounded-lg p-1.5 text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-1">
                     <Plus className="w-3 h-3" /> Agregar Ciclo
                  </button>
               </div>

               <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {currentPrices.length > 0 ? (
                     currentPrices.map((price: PlanPrice) => (
                        <div key={price.id} className="flex justify-between items-center bg-white p-2 border rounded-lg shadow-sm text-sm">
                           <div className="flex gap-2 items-center">
                              <span className="font-bold text-slate-700 uppercase font-mono">{price.billingCycle}</span>
                              <span className="text-indigo-600 font-semibold font-mono">${Number(price.price).toLocaleString()}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${price.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                                 {price.active ? 'Activo' : 'Inactivo'}
                              </span>
                           </div>
                           <div className="flex gap-1.5">
                              <button type="button" onClick={() => handleTogglePriceActive(price)} className="px-2 py-1 text-xs bg-slate-100 rounded text-slate-600 hover:bg-slate-200">
                                 {price.active ? 'Desactivar' : 'Activar'}
                              </button>
                              <button type="button" onClick={() => handleDeletePrice(price.id!)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 font-medium">
                                 Eliminar
                              </button>
                           </div>
                        </div>
                     ))
                  ) : (
                     <p className="text-xs text-slate-400 italic text-center py-4 bg-white border border-dashed rounded-lg">Este plan aún no posee precios. Agregue uno arriba.</p>
                  )}
               </div>
            </div>
         )}
      </Modal>
    </div>
  );
};
