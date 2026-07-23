import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { Card, CardContent } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { ReportToolbar } from '../components/ui/ReportToolbar';
import { ChartCard } from '../components/ui/ChartCard';
import { MetricTrend } from '../components/ui/MetricTrend';
import { ShoppingCart, ShoppingBag, Banknote, Package, Box, LineChart as LineChartIcon, Users, CreditCard, DollarSign, TrendingUp, TrendingDown, AlertCircle, Building2, Layers } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ReportService } from '../services/report.service';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('this_month');
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
  const [dateTo, setDateTo] = useState(new Date().toISOString());
  const [loading, setLoading] = useState(true);

  const [salesData, setSalesData] = useState<any>(null);
  const [purchaseData, setPurchaseData] = useState<any>(null);
  const [cashData, setCashData] = useState<any>(null);
  const [stockData, setStockData] = useState<any>(null);
  const [kardexData, setKardexData] = useState<any>([]);
  const [financialData, setFinancialData] = useState<any>(null);
  const [customersData, setCustomersData] = useState<any>(null);
  const [productsData, setProductsData] = useState<any>(null);
  const [usersData, setUsersData] = useState<any>(null);
  const [executiveData, setExecutiveData] = useState<any>(null);

  useEffect(() => {
    fetchActiveReport();
  }, [activeTab, dateRange]);

  const fetchActiveReport = async () => {
    setLoading(true);
    try {
       const params = { dateFrom, dateTo };
       if (activeTab === 'overview') setExecutiveData(await ReportService.getExecutiveSummary(params));
       if (activeTab === 'overview' || activeTab === 'sales') setSalesData(await ReportService.getSales(params));
       if (activeTab === 'overview' || activeTab === 'purchases') setPurchaseData(await ReportService.getPurchases(params));
       if (activeTab === 'cash') setCashData(await ReportService.getCash(params));
       if (activeTab === 'overview' || activeTab === 'stock' && !stockData) setStockData(await ReportService.getInventory(params)); // Solo 1 vez snapshot
       if (activeTab === 'kardex') setKardexData(await ReportService.getKardex(params));
       
       if (activeTab === 'financial') setFinancialData(await ReportService.getFinancial(params));
       if (activeTab === 'customers') setCustomersData(await ReportService.getCustomers(params));
       if (activeTab === 'products') setProductsData(await ReportService.getProducts(params));
       if (activeTab === 'users') setUsersData(await ReportService.getUsers(params));
    } catch (e) {
       console.error("Error loading report", e);
    } finally {
       setLoading(false);
    }
  };

  const handleExport = (type: 'CSV' | 'XLSX' | 'PDF') => {
    ReportService.exportReport({ report: activeTab, type, dateFrom, dateTo });
  };

  const renderOverview = () => {
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
        <ReportToolbar dateRange={dateRange} onDateRangeChange={setDateRange} onExport={handleExport} onClearFilters={() => {}} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
           <StatCard title="Ventas del Mes" value={`$ ${Number(salesData?.totalAmount || 0).toLocaleString()}`} icon={DollarSign} />
           <StatCard 
              title="Compras del Mes" 
              value={`$ ${Number(executiveData?.purchasesMonth || 0).toLocaleString()}`} 
              icon={ShoppingBag} 
              trend={executiveData?.purchasesTrend !== 'Sin datos' && executiveData?.purchasesTrend !== undefined ? { value: `${Math.abs(executiveData.purchasesTrend)}%`, isPositive: executiveData.purchasesTrend >= 0 } : undefined} 
              description={executiveData?.purchasesTrend === 'Sin datos' ? 'Sin datos' : undefined}
           />
           <StatCard title="Ganancia Bruta" value={`$ ${Number((salesData?.totalAmount || 0) - (executiveData?.purchasesMonth || 0)).toLocaleString()}`} icon={TrendingUp} className="border-emerald-200" />
           <StatCard title="Valor Stock" value={executiveData ? `$ ${Number(executiveData.stockValue || 0).toLocaleString()}` : '$ 0'} icon={Package} />
           <StatCard title="Caja Fuerte" value={executiveData ? `$ ${Number(executiveData.cashBalance || 0).toLocaleString()}` : '$ 0'} icon={Banknote} />
        </div>
        <ChartCard title="Evolución General" subtitle="Ventas vs Compras">
           <div className="h-72">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={salesData?.salesByDay || []}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
                 <XAxis dataKey="day" axisLine={false} tickLine={false} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {weekday:'short'})} />
                 <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                 <RechartsTooltip formatter={(value: any) => [`$ ${Number(value).toLocaleString()}`, 'Monto']} />
                 <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={3} dot={false} />
                 <Line type="monotone" dataKey="purchases" stroke="#f43f5e" strokeWidth={3} dot={false} />
               </LineChart>
             </ResponsiveContainer>
           </div>
        </ChartCard>
      </div>
    );
  };

  const renderFinancial = () => {
    if (!financialData) return null;
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
        <ReportToolbar dateRange={dateRange} onDateRangeChange={setDateRange} onExport={handleExport} onClearFilters={() => {}} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           <StatCard title="Ingresos Totales (Ventas)" value={`$ ${Number(financialData.totalSales || 0).toLocaleString()}`} icon={TrendingUp} />
           <StatCard title="Costos (Compras Grales)" value={`$ ${Number(financialData.totalPurchases || 0).toLocaleString()}`} icon={TrendingDown} />
           <StatCard title="Ganancia Bruta" value={`$ ${Number(financialData.grossMargin || 0).toLocaleString()}`} icon={DollarSign} className="border-emerald-200" />
           <StatCard title="Margen (%)" value={`${financialData.totalSales > 0 ? ((financialData.grossMargin / financialData.totalSales)*100).toFixed(2) : 0}%`} icon={LineChartIcon} />
        </div>
      </div>
    );
  };

  const renderSales = () => {
    if (!salesData) return null;
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
        <ReportToolbar dateRange={dateRange} onDateRangeChange={setDateRange} onExport={handleExport} onClearFilters={() => {}} />
        {/* Visual content from earlier */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           <StatCard title="Ventas Totales" value={`$ ${Number(salesData.totalAmount || 0).toLocaleString()}`} icon={DollarSign} />
           <StatCard title="Cantidad Operaciones" value={salesData.totalSales || 0} icon={ShoppingCart} />
           <StatCard title="Ticket Promedio" value={`$ ${Number(salesData.averageTicket || 0).toLocaleString()}`} icon={CreditCard} />
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    if (!usersData) return null;
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
        <ReportToolbar dateRange={dateRange} onDateRangeChange={setDateRange} onExport={handleExport} onClearFilters={() => {}} />
        <Card>
          <CardContent className="p-0">
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-50 border-b border-slate-200">
                   <tr><th className="px-6 py-3">Vendedor</th><th className="px-6 py-3">Volumen Total</th><th className="px-6 py-3">Operaciones</th></tr>
                 </thead>
                 <tbody>
                   {usersData.ranking.map((user: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50 border-b border-slate-100">
                        <td className="px-6 py-4 font-bold">{i===0?'🥇':i===1?'🥈':i===2?'🥉':''} {user.user}</td>
                        <td className="px-6 py-4 text-emerald-600 font-bold">$ {Number(user.total || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">{user.sales} tks</td>
                      </tr>
                   ))}
                   {usersData.ranking.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-slate-500">Sin ventas activas registradas.</td></tr>}
                 </tbody>
               </table>
             </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderCustomers = () => {
    if (!customersData) return null;
    return (
      <div className="space-y-6">
         <ReportToolbar dateRange={dateRange} onDateRangeChange={setDateRange} onExport={handleExport} onClearFilters={() => {}} />
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <StatCard title="Clientes Activos" value={customersData.totalActive || 0} icon={Users} />
           <StatCard title="Nuevos" value={customersData.newCustomers || 0} icon={Users} />
         </div>
      </div>
    );
  }

  const renderInventoryReport = () => {
    if (!stockData || !stockData.summary) return null;
    const { summary = {}, stockStatus = {}, products = [] } = stockData;

    return (
      <div className="space-y-6">
        <ReportToolbar dateRange={dateRange} onDateRangeChange={setDateRange} onExport={handleExport} onClearFilters={() => {}} />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Productos en Stock" value={summary.totalProducts || 0} icon={Package} />
          <StatCard title="Valor Total Inventario" value={`$ ${(summary.totalStockValue || 0).toLocaleString()}`} icon={Banknote} className="border-emerald-200" />
          <StatCard title="Stock Bajo" value={summary.lowStockProducts || 0} icon={AlertCircle} className="border-amber-200 text-amber-600" />
          <StatCard title="Sin Stock" value={summary.outOfStockProducts || 0} icon={Box} className="border-red-200 text-red-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Estado del Inventario">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[
                    { name: 'OK', value: stockStatus.ok },
                    { name: 'Bajo', value: stockStatus.low },
                    { name: 'Sobre', value: stockStatus.over },
                    { name: 'Sin Stock', value: stockStatus.empty }
                  ]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#0ea5e9" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <RechartsTooltip formatter={(value: any) => [value, 'Cant. Productos']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Productos Críticos" subtitle="Exigen reposición inmediata y están debajo del mínimo">
             <div className="overflow-y-auto max-h-72 pr-2">
                <table className="w-full text-sm text-left">
                  <thead className="bg-red-50 border-b border-red-100"><tr><th className="px-4 py-2 text-red-700">Producto</th><th className="px-4 py-2 text-red-700 text-right">Cant.</th><th className="px-4 py-2 text-red-700 text-right">Mín.</th></tr></thead>
                  <tbody>
                    {products.filter((p:any) => p.status === 'LOW_STOCK' || p.status === 'NO_STOCK').slice(0,10).map((p:any, i:number) => (
                      <tr key={i} className="border-b hover:bg-slate-50"><td className="px-4 py-3 font-medium">{p.productName}</td><td className="px-4 py-3 text-right bg-red-50/30 text-red-600 font-bold">{p.quantity}</td><td className="px-4 py-3 text-right text-slate-500">{p.minimumStock}</td></tr>
                    ))}
                    {products.filter((p:any) => p.status === 'LOW_STOCK' || p.status === 'NO_STOCK').length === 0 && <tr><td colSpan={3} className="text-center py-6 opacity-60 text-emerald-600 font-bold">No hay productos críticos identificados</td></tr>}
                  </tbody>
                </table>
             </div>
          </ChartCard>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-3">Producto / SKU</th>
                    <th className="px-6 py-3">Depósito</th>
                    <th className="px-6 py-3">Categoría</th>
                    <th className="px-6 py-3 text-right">Disponible</th>
                    <th className="px-6 py-3 text-right">Mín / Máx</th>
                    <th className="px-6 py-3 text-right">Valor Inv.</th>
                    <th className="px-6 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p: any, i: number) => {
                    return (
                      <tr key={p.id || i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium">{p.productName} <span className="text-slate-400 text-xs block">{p.sku || 'S/S'} {p.supplierName ? `• ${p.supplierName}` : ''}</span></td>
                        <td className="px-6 py-4 text-slate-500">{p.warehouseName}</td>
                        <td className="px-6 py-4 text-slate-500">{p.categoryName || '-'}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">{p.quantity}</td>
                        <td className="px-6 py-4 text-right font-mono text-slate-500 text-xs">{p.minimumStock} / {p.maximumStock > 0 ? p.maximumStock : '∞'}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">${Number(p.inventoryValue).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            p.status === 'OK' ? 'bg-emerald-100 text-emerald-700' :
                            p.status === 'LOW_STOCK' ? 'bg-amber-100 text-amber-700' :
                            p.status === 'OVER_STOCK' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {p.status === 'OK' ? 'Stock OK' : p.status === 'LOW_STOCK' ? 'Stock Bajo' : p.status === 'OVER_STOCK' ? 'Sobre Stock' : 'Sin Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && <tr><td colSpan={7} className="text-center py-10 opacity-60">Sin datos de stock disponibles.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderPurchasesReport = () => {
    if (!purchaseData || !purchaseData.summary) return null;
    const { summary, purchasesByDay = [], topSuppliers = [], topProducts = [], paymentStatus = [], purchaseHistory = [] } = purchaseData;

    return (
      <div className="space-y-6">
        <ReportToolbar dateRange={dateRange} onDateRangeChange={setDateRange} onExport={handleExport} onClearFilters={() => {}} />

        <Tabs
          variant="pill"
          tabs={[
            {
              id: 'p-resumen', label: 'Resumen', content: (
                <div className="space-y-6 mt-6 animate-in slide-in-from-bottom-2 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <StatCard title="Total Compras" value={`$ ${Number(summary.totalAmount || 0).toLocaleString()}`} icon={Banknote} className="border-emerald-200 text-emerald-600" />
                    <StatCard title="Órdenes Emitidas" value={summary.totalOrders || 0} icon={ShoppingCart} />
                    <StatCard title="Ticket Promedio" value={`$ ${Number(summary.averageTicket || 0).toLocaleString()}`} icon={CreditCard} />
                    <StatCard title="Proveedores" value={summary.uniqueSuppliers || 0} icon={Users} />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ChartCard title="Evolución de Compras" subtitle="Montos invertidos históricamente">
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={purchasesByDay}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="day" axisLine={false} tickLine={false} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {weekday:'short'})} />
                              <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                              <RechartsTooltip formatter={(value: any) => [`$ ${Number(value).toLocaleString()}`, 'Compras']} />
                              <Area type="monotone" dataKey="amount" name="Compras" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                    </ChartCard>
                    <ChartCard title="Estado de Pagos" subtitle="Distribución del estatus actual">
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={paymentStatus.length ? paymentStatus : [{status:'Sin Pagos', count: 1}]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count">
                                {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                              </Pie>
                              <RechartsTooltip formatter={(value: any, name: any, props: any) => [value, props.payload.status === 'PENDING' ? 'Pendiente' : props.payload.status === 'PARTIAL' ? 'Parcial' : props.payload.status === 'PAID' ? 'Pagado' : props.payload.status]} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                    </ChartCard>
                  </div>
                </div>
              )
            },
            {
              id: 'p-suppliers', label: 'Proveedores', content: (
                <Card className="mt-6"><CardContent className="p-0">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b"><tr><th className="px-6 py-3">Proveedor</th><th className="px-6 py-3 text-center">Órdenes</th><th className="px-6 py-3 text-right">Monto Total</th></tr></thead>
                    <tbody>
                      {topSuppliers.map((s:any, i:number) => (
                         <tr key={i} className="border-b hover:bg-slate-50">
                            <td className="px-6 py-4 font-bold">{i===0?'🥇':i===1?'🥈':i===2?'🥉':''} {s.supplierName}</td>
                            <td className="px-6 py-4 text-center">{s.orders}</td>
                            <td className="px-6 py-4 text-right font-bold text-emerald-600">$ {Number(s.amount).toLocaleString()}</td>
                         </tr>
                      ))}
                      {topSuppliers.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-slate-500">Sin historial de proveedores</td></tr>}
                    </tbody>
                  </table>
                </CardContent></Card>
              )
            },
            {
              id: 'p-products', label: 'Productos', content: (
                <Card className="mt-6"><CardContent className="p-0">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b"><tr><th className="px-6 py-3">Producto</th><th className="px-6 py-3 text-center">Unidades Compradas</th><th className="px-6 py-3 text-right">Monto Total</th></tr></thead>
                    <tbody>
                      {topProducts.map((p:any, i:number) => (
                         <tr key={i} className="border-b hover:bg-slate-50">
                            <td className="px-6 py-4 font-bold">{p.productName}</td>
                            <td className="px-6 py-4 text-center font-mono">{Number(p.quantity).toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-bold text-emerald-600">$ {Number(p.amount).toLocaleString()}</td>
                         </tr>
                      ))}
                      {topProducts.length === 0 && <tr><td colSpan={3} className="text-center py-8 text-slate-500">Sin productos comprados en este período</td></tr>}
                    </tbody>
                  </table>
                </CardContent></Card>
              )
            },
            {
              id: 'p-history', label: 'Historial', content: (
                <Card className="mt-6"><CardContent className="p-0">
                   <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b">
                        <tr><th className="px-6 py-3">Fecha</th><th className="px-6 py-3">Número</th><th className="px-6 py-3">Proveedor</th><th className="px-6 py-3">Depósito</th><th className="px-6 py-3 text-center">Estado</th><th className="px-6 py-3 text-right">Total</th></tr>
                      </thead>
                      <tbody>
                        {purchaseHistory.map((m:any, i:number) => (
                           <tr key={i} className="border-b hover:bg-slate-50">
                             <td className="px-6 py-4 whitespace-nowrap">{new Date(m.purchaseDate).toLocaleString(undefined, {dateStyle:'short'})}</td>
                             <td className="px-6 py-4 font-medium text-slate-600">{m.purchaseNumber}</td>
                             <td className="px-6 py-4 font-bold">{m.supplier?.name}</td>
                             <td className="px-6 py-4 text-slate-500 text-xs">{m.warehouse?.name}</td>
                             <td className="px-6 py-4 text-center">
                               <span className={`px-2 py-1 rounded text-xs font-bold ${m.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : m.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                 {m.status}
                               </span>
                             </td>
                             <td className={`px-6 py-4 text-right font-mono font-bold`}>
                               $ {Number(m.total).toLocaleString()}
                             </td>
                           </tr>
                        ))}
                        {purchaseHistory.length === 0 && <tr><td colSpan={6} className="text-center py-10 opacity-60">Sin registro histórico</td></tr>}
                      </tbody>
                    </table>
                   </div>
                </CardContent></Card>
              )
            }
          ]}
        />
      </div>
    );
  }

  const renderCashReport = () => {
    if (!cashData || !cashData.summary) return null;
    const { summary, sessions = [], movements = [], flowByDay = [], paymentMethods = [], userPerformance = [] } = cashData;

    return (
      <div className="space-y-6">
        <ReportToolbar dateRange={dateRange} onDateRangeChange={setDateRange} onExport={handleExport} onClearFilters={() => {}} />

        <Tabs
          variant="pill"
          tabs={[
            {
              id: 'c-resumen', label: 'Resumen', content: (
                <div className="space-y-6 mt-6 animate-in slide-in-from-bottom-2 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard title="Caja Activa" value={summary.activeSession ? summary.activeSession.cashRegister?.name : 'Ninguna'} icon={Banknote} /* It's better to show name */ />
                    <StatCard title="Ingresos" value={`$ ${Number(summary.incomes || 0).toLocaleString()}`} icon={TrendingUp} className="border-emerald-200 text-emerald-600" />
                    <StatCard title="Egresos" value={`$ ${Number(summary.expenses || 0).toLocaleString()}`} icon={TrendingDown} className="border-red-200 text-red-600" />
                    <StatCard title="Saldo Actual" value={`$ ${Number(summary.net || 0).toLocaleString()}`} icon={DollarSign} className="border-blue-200" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ChartCard title="Evolución Diaria" subtitle="Ingresos vs Egresos">
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={flowByDay}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="day" axisLine={false} tickLine={false} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {weekday:'short'})} />
                              <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                              <RechartsTooltip formatter={(value: any) => [`$ ${Number(value).toLocaleString()}`, 'Monto']} />
                              <Area type="monotone" dataKey="incomes" name="Ingresos" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                              <Area type="monotone" dataKey="expenses" name="Egresos" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                    </ChartCard>
                    <ChartCard title="Medios de Pago" subtitle="Distribución histórica (Ventas)">
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={paymentMethods.length ? paymentMethods : [{name:'Sin', value: 1}]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                              </Pie>
                              <RechartsTooltip formatter={(value: any) => [`$ ${Number(value).toLocaleString()}`, 'Ventas']} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                    </ChartCard>
                  </div>
                </div>
              )
            },
            {
              id: 'c-sessions', label: 'Sesiones de Caja', content: (
                <Card className="mt-6"><CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b">
                        <tr><th className="px-6 py-3">Caja</th><th className="px-6 py-3">Usuario</th><th className="px-6 py-3">Apertura</th><th className="px-6 py-3">Cierre</th><th className="px-6 py-3 text-right">Inicial</th><th className="px-6 py-3 text-right">Final</th><th className="px-6 py-3 text-center">Estado</th></tr>
                      </thead>
                      <tbody>
                        {sessions.map((s:any, i:number) => (
                           <tr key={i} className="border-b hover:bg-slate-50">
                             <td className="px-6 py-4 font-bold">{s.cashRegister?.name}</td>
                             <td className="px-6 py-4">{s.openedBy?.name}</td>
                             <td className="px-6 py-4">{new Date(s.openedAt).toLocaleString(undefined, {dateStyle:'short', timeStyle:'short'})}</td>
                             <td className="px-6 py-4">{s.closedAt ? new Date(s.closedAt).toLocaleString(undefined, {dateStyle:'short', timeStyle:'short'}) : '-'}</td>
                             <td className="px-6 py-4 text-right font-mono">$ {Number(s.openingBalance).toLocaleString()}</td>
                             <td className="px-6 py-4 text-right font-mono font-bold">$ {Number(s.closingBalance).toLocaleString()}</td>
                             <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{s.status === 'OPEN' ? 'ABIERTA' : 'CERRADA'}</span></td>
                           </tr>
                        ))}
                        {sessions.length === 0 && <tr><td colSpan={7} className="text-center py-10 opacity-60">Sin sesiones en este periodo.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </CardContent></Card>
              )
            },
            {
              id: 'c-movements', label: 'Movimientos', content: (
                <Card className="mt-6"><CardContent className="p-0">
                   <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b">
                        <tr><th className="px-6 py-3">Fecha</th><th className="px-6 py-3">Concepto</th><th className="px-6 py-3">Usuario</th><th className="px-6 py-3 text-center">Tipo</th><th className="px-6 py-3 text-right">Monto</th></tr>
                      </thead>
                      <tbody>
                        {movements.map((m:any, i:number) => (
                           <tr key={i} className="border-b hover:bg-slate-50">
                             <td className="px-6 py-4">{new Date(m.createdAt).toLocaleString(undefined, {dateStyle:'short', timeStyle:'short'})}</td>
                             <td className="px-6 py-4 font-medium">{m.reason} <span className="text-xs text-slate-400 block">{m.cashSession?.cashRegister?.name}</span></td>
                             <td className="px-6 py-4">{m.createdByUser?.name}</td>
                             <td className="px-6 py-4 text-center">
                               <span className={`px-2 py-1 rounded text-xs font-bold ${m.type === 'IN' ? 'text-emerald-700 bg-emerald-100' : m.type === 'OUT' ? 'text-red-700 bg-red-100' : 'text-amber-700 bg-amber-100'}`}>
                                 {m.type === 'IN' ? 'INGRESO' : m.type === 'OUT' ? 'EGRESO' : m.type}
                               </span>
                             </td>
                             <td className={`px-6 py-4 text-right font-mono font-bold ${m.type === 'IN' ? 'text-emerald-600' : m.type === 'OUT' ? 'text-red-600' : ''}`}>
                               {m.type === 'IN' ? '+' : '-'}$ {Number(m.amount).toLocaleString()}
                             </td>
                           </tr>
                        ))}
                        {movements.length === 0 && <tr><td colSpan={5} className="text-center py-10 opacity-60">Sin movimientos de caja</td></tr>}
                      </tbody>
                    </table>
                   </div>
                </CardContent></Card>
              )
            },
            {
              id: 'c-cashiers', label: 'Rendimiento Cajeros', content: (
                <Card className="mt-6"><CardContent className="p-0">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b"><tr><th className="px-6 py-3">Cajero</th><th className="px-6 py-3 text-center">Operaciones</th><th className="px-6 py-3 text-right">Facturación</th><th className="px-6 py-3 text-right">Ticket Prom.</th></tr></thead>
                    <tbody>
                      {userPerformance.map((u:any, i:number) => (
                         <tr key={i} className="border-b hover:bg-slate-50">
                            <td className="px-6 py-4 font-bold">{i===0?'🥇':i===1?'🥈':i===2?'🥉':''} {u.userName}</td>
                            <td className="px-6 py-4 text-center">{u.sales} tks</td>
                            <td className="px-6 py-4 text-right font-bold text-emerald-600">$ {Number(u.amount).toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-mono text-slate-500">$ {Number(u.averageTicket).toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                         </tr>
                      ))}
                      {userPerformance.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate-500">Sin operaciones por parte de cajeros.</td></tr>}
                    </tbody>
                  </table>
                </CardContent></Card>
              )
            }
          ]}
        />
      </div>
    );
  }

  const renderKardex = () => {
    if (!kardexData || !kardexData.movements) return null;
    const { summary = {}, movements = [] } = kardexData;

    return (
      <div className="space-y-6">
        <ReportToolbar dateRange={dateRange} onDateRangeChange={setDateRange} onExport={handleExport} onClearFilters={() => {}} />
        
        {/* Resumen Superior */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard title="Total Movimientos" value={summary.total || 0} icon={Layers} />
          <StatCard title="Entradas" value={summary.in || 0} icon={TrendingUp} className="border-emerald-200 text-emerald-600" />
          <StatCard title="Salidas" value={summary.out || 0} icon={TrendingDown} className="border-red-200 text-red-600" />
          <StatCard title="Ajustes Manuales" value={summary.adjust || 0} icon={AlertCircle} className="border-amber-200 text-amber-600" />
          <StatCard title="Productos Afectados" value={summary.uniqueProducts || 0} icon={Package} />
        </div>

        {/* Tabla Analítica */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-3">Fecha</th>
                    <th className="px-6 py-3">Producto / SKU</th>
                    <th className="px-6 py-3">Depósito</th>
                    <th className="px-6 py-3">Tipo</th>
                    <th className="px-6 py-3">Cantidad</th>
                    <th className="px-6 py-3">Anterior</th>
                    <th className="px-6 py-3">Posterior</th>
                    <th className="px-6 py-3">Usuario</th>
                    <th className="px-6 py-3">Documento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m: any, i: number) => {
                    const qty = Number(m.quantity);
                    return (
                      <tr key={m.id || i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">{new Date(m.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="px-6 py-4 font-medium">{m.product?.name} <span className="text-slate-400 text-xs block">{m.product?.sku}</span></td>
                        <td className="px-6 py-4 text-slate-500">{m.warehouse?.name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${['IN', 'ENTRY', 'PURCHASE'].includes(m.movementType) ? 'bg-emerald-100 text-emerald-700' : ['OUT', 'EXIT', 'SALE'].includes(m.movementType) ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {m.movementType}
                          </span>
                        </td>
                        <td className={`px-6 py-4 font-mono font-bold ${qty > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{qty > 0 ? '+' : ''}{qty}</td>
                        <td className="px-6 py-4 font-mono text-slate-500">{Number(m.stockBefore)}</td>
                        <td className="px-6 py-4 font-mono font-bold">{Number(m.stockAfter)}</td>
                        <td className="px-6 py-4 text-slate-500 text-xs">{m.user?.name || 'Sistema'}</td>
                        <td className="px-6 py-4 text-slate-400 text-xs">{m.referenceNumber || '-'}</td>
                      </tr>
                    );
                  })}
                  {movements.length === 0 && <tr><td colSpan={9} className="text-center py-10 opacity-60">Sin movimientos de stock en el periodo</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderProducts = () => {
    if (!productsData) return null;
    const { summary, topSelling = [], inactive = [], categories = [], profitability = [] } = productsData;
    
    return (
      <div className="space-y-6">
         <ReportToolbar dateRange={dateRange} onDateRangeChange={setDateRange} onExport={handleExport} onClearFilters={() => {}} />
         
         <Tabs 
           variant="pill"
           tabs={[
             {
               id: 'p-resumen', label: 'Resumen', content: (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <StatCard title="Productos Activos" value={summary.activeProducts || 0} icon={Package} />
                    <StatCard title="Stock Valorizado" value={`$ ${Number(summary.totalValuation || 0).toLocaleString()}`} icon={DollarSign} className="border-emerald-200" />
                    <StatCard title="Sin Movimiento" value={summary.withoutMovement || 0} icon={Box} className="border-red-200 text-red-600" />
                    <StatCard title="Margen Promedio" value={`${Number(summary.averageMargin || 0).toFixed(2)}%`} icon={LineChartIcon} />
                 </div>
               )
             },
             {
               id: 'p-top', label: 'Más Vendidos', content: (
                 <Card className="mt-6"><CardContent className="p-0">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b"><tr><th className="px-6 py-3">Producto</th><th className="px-6 py-3">Volumen</th><th className="px-6 py-3">Facturación</th></tr></thead>
                      <tbody>
                        {topSelling.map((x: any, i: number) => (
                           <tr key={i} className="border-b hover:bg-slate-50"><td className="px-6 py-4 font-bold">{x.producto}</td><td className="px-6 py-4">{x.cantidad} u.</td><td className="px-6 py-4 text-emerald-600 font-bold">$ {Number(x.facturacion).toLocaleString()}</td></tr>
                        ))}
                        {topSelling.length === 0 && <tr><td colSpan={3} className="text-center py-8 opacity-60">Sin datos</td></tr>}
                      </tbody>
                    </table>
                 </CardContent></Card>
               )
             },
             {
               id: 'p-inactive', label: 'Sin Movimiento', content: (
                 <Card className="mt-6"><CardContent className="p-0">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-red-50 border-b border-red-100"><tr><th className="px-6 py-3 text-red-700">Producto</th><th className="px-6 py-3 text-red-700">Stock Estancado</th><th className="px-6 py-3 text-red-700">Alerta</th></tr></thead>
                      <tbody>
                        {inactive.map((x: any, i: number) => (
                           <tr key={i} className="border-b"><td className="px-6 py-4 font-medium">{x.producto}</td><td className="px-6 py-4 bg-red-50/30">{x.stock} u.</td><td className="px-6 py-4">{x.lastSale}</td></tr>
                        ))}
                        {inactive.length === 0 && <tr><td colSpan={3} className="text-center py-8 opacity-60 text-emerald-600">No hay stock estancado</td></tr>}
                      </tbody>
                    </table>
                 </CardContent></Card>
               )
             },
             {
               id: 'p-profitability', label: 'Rentabilidad', content: (
                 <Card className="mt-6"><CardContent className="p-0">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-emerald-50 border-b border-emerald-100"><tr><th className="px-6 py-3 text-emerald-700">Producto</th><th className="px-6 py-3 text-emerald-700">Ventas</th><th className="px-6 py-3 text-emerald-700">Ganancia Estimada</th><th className="px-6 py-3 text-emerald-700">Margen %</th></tr></thead>
                      <tbody>
                        {profitability.map((x: any, i: number) => (
                           <tr key={i} className="border-b"><td className="px-6 py-4 font-medium">{x.producto}</td><td className="px-6 py-4">{x.ventas} u.</td><td className="px-6 py-4 font-bold text-emerald-600">$ {Number(x.ganancia).toLocaleString(undefined, {maximumFractionDigits: 2})}</td><td className="px-6 py-4">{Number(x.margen).toFixed(2)} %</td></tr>
                        ))}
                        {profitability.length === 0 && <tr><td colSpan={4} className="text-center py-8 opacity-60">Sin datos de rentabilidad calculables</td></tr>}
                      </tbody>
                    </table>
                 </CardContent></Card>
               )
             },
             {
               id: 'p-category', label: 'Categorías', content: (
                  <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                     <ChartCard title="Distribución de Ventas por Categoría">
                       <div className="h-72">
                         <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                             <Pie data={categories.length ? categories : [{name:'Sin', qty: 1}]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="qty">
                               {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                             </Pie>
                             <RechartsTooltip />
                           </PieChart>
                         </ResponsiveContainer>
                       </div>
                     </ChartCard>
                  </div>
               )
             }
           ]}
         />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader title="Centro Analítico BI" subtitle="Visualiza métricas, exporta datos y audita rentabilidad." />
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <Tabs
          variant="underline"
          className="px-2"
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={[
            { id: 'overview', label: 'Resumen Ejecutivo', content: <div className="p-6 bg-slate-50/50">{renderOverview()}</div> },
            { id: 'financial', label: 'Financiero', content: <div className="p-6">{renderFinancial()}</div> },
            { id: 'sales', label: 'Ventas', content: <div className="p-6">{renderSales()}</div> },
            { id: 'purchases', label: 'Compras', content: <div className="p-6">{renderPurchasesReport()}</div> },
            { id: 'cash', label: 'Caja', content: <div className="p-6">{renderCashReport()}</div> },
            { id: 'stock', label: 'Stock', content: <div className="p-6">{renderInventoryReport()}</div> },
            { id: 'kardex', label: 'Kardex', content: <div className="p-6">{renderKardex()}</div> },
            { id: 'customers', label: 'Clientes', content: <div className="p-6">{renderCustomers()}</div> },
            { id: 'products', label: 'Productos', content: <div className="p-6">{renderProducts()}</div> },
            { id: 'users', label: 'Vendedores', content: <div className="p-6">{renderUsers()}</div> }
          ]}
        />
      </Card>
      <style>{`
         .recharts-cartesian-axis-tick-value { font-size: 11px; fill: #64748b; font-family: ui-sans-serif, system-ui, sans-serif; }
      `}</style>
    </div>
  );
};
