'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useSlug } from '@/lib/slug';
import { useTranslation } from '@/lib/i18n';
import {
    TrendingUp,
    Clock,
    Users,
    Wrench,
    DollarSign,
    PieChart as PieChartIcon,
    BarChart as BarChartIcon,
    BarChart3,
    Calendar,
    RefreshCw,
    Download,
    Search,
    Building2,
    Tag,
    X,
    Filter,
    ClipboardList,
    AlertTriangle,
    Car,
    Info,
    Gauge,
    AlertCircle
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';

export default function ReportsPage() {
    const { slug } = useSlug();
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('general');
    const [data, setData] = useState<any>(null);
    const [vehicleFilters, setVehicleFilters] = useState({ brands: [], models: [] });
    const [vFilters, setVFilters] = useState({ brand: '', model: '' });
    const [vehicleStats, setVehicleStats] = useState<any>(null);

    // Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportParams, setExportParams] = useState({
        type: 'orders',
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/reports/analytics');
            setData(res.data);

            // Also fetch vehicle filters
            const vRes = await api.get('/reports/vehicle-filters');
            setVehicleFilters(vRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchVehicleStats = async () => {
        try {
            const res = await api.get('/reports/vehicle-stats', { params: vFilters });
            setVehicleStats(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (activeTab === 'vehicles') {
            fetchVehicleStats();
        }
    }, [vFilters, activeTab]);

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const response = await api.post('/reports/export-excel', exportParams, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `reporte_${exportParams.type}_${Date.now()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setShowExportModal(false);
        } catch (err) {
            console.error('Error exporting excel:', err);
        } finally {
            setExporting(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <RefreshCw className="animate-spin text-blue-500 mr-3" size={24} />
            <span className="font-bold text-slate-500 uppercase tracking-widest text-xs">{t('loading')}</span>
        </div>
    );

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            <header className="flex justify-between items-end">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 text-white p-4 rounded-3xl shadow-xl shadow-indigo-600/20">
                        <BarChart3 size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">{t('reports')}</h2>
                        <p className="text-slate-500 mt-1 font-bold">{t('reports_desc')}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowExportModal(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                    >
                        <Download size={18} />
                        Exportar Excel
                    </button>
                    <button
                        onClick={fetchData}
                        className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400 hover:text-blue-500 transition-all active:scale-95"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </header>

            {/* Tabs Navigation */}
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[2rem] w-fit">
                {[
                    { id: 'general', label: 'General', icon: <TrendingUp size={16} /> },
                    { id: 'finances', label: 'Finanzas / Servicios', icon: <DollarSign size={16} /> },
                    { id: 'customers', label: 'Clientes', icon: <Users size={16} /> },
                    { id: 'vehicles', label: 'Vehículos', icon: <Car size={16} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab.id
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'general' && (
                    <>
                        <ReportCard
                            title={t('lead_time')}
                            icon={<Clock className="text-blue-500" size={20} />}
                            error={data?.errors?.includes('leadTimes')}
                        >
                            <div className="h-[300px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data?.leadTimes}>
                                        <defs>
                                            <linearGradient id="colorDays" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: '#000' }}
                                            itemStyle={{ fontWeight: 'bold', color: '#000' }}
                                        />
                                        <Area type="monotone" dataKey="avg_days" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorDays)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </ReportCard>

                        <ReportCard
                            title="Desempeño por Marca"
                            icon={<Building2 className="text-slate-700" size={20} />}
                            error={data?.errors?.includes('brands')}
                        >
                            <div className="h-[300px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data?.brands} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} width={80} />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: '#000' }}
                                            itemStyle={{ color: '#000' }}
                                            formatter={(value, name) => [`$${value}`, name]}
                                        />
                                        <Legend iconType="circle" />
                                        <Bar name="Mano de Obra" dataKey="labor_income" stackId="a" fill="#3b82f6" />
                                        <Bar name="Repuestos" dataKey="parts_profit" stackId="a" fill="#10b981" radius={[0, 10, 10, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ReportCard>

                        <ReportCard
                            title={t('top_mechanics')}
                            icon={<Wrench className="text-slate-700" size={20} />}
                            error={data?.errors?.includes('rankings')}
                        >
                            <div className="mt-6 space-y-4">
                                {data?.rankings?.map((tech: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-black text-slate-400 group-hover:text-blue-500 group-hover:border-blue-200 transition-all">
                                                #{idx + 1}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 uppercase italic tracking-tighter">{tech.name}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">{tech.completed_orders} {t('orders_completed')}</p>
                                            </div>
                                        </div>
                                        <div className="text-blue-600 font-black italic">
                                            #{idx + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ReportCard>
                    </>
                )}

                {activeTab === 'finances' && (
                    <>
                        <ReportCard
                            title={t('profit_breakdown')}
                            icon={<DollarSign className="text-emerald-500" size={20} />}
                            error={data?.errors?.includes('profitBreakdown')}
                        >
                            <div className="h-[350px] w-full mt-4 flex items-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={data?.profitBreakdown}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={120}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {data?.profitBreakdown?.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </ReportCard>

                        <ReportCard
                            title="Evolución Mensual"
                            icon={<TrendingUp className="text-emerald-600" size={20} />}
                            error={data?.errors?.includes('incomeByMonth')}
                        >
                            <div className="h-[350px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data?.incomeByMonth}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: '#000' }}
                                            itemStyle={{ color: '#000' }}
                                        />
                                        <Legend />
                                        <Bar name="Mano de Obra" dataKey="labor_income" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                        <Bar name="Ganancia Repuestos" dataKey="parts_profit" fill="#10b981" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ReportCard>

                        <ReportCard
                            title="Ingresos por Mano de Obra"
                            icon={<Tag className="text-rose-500" size={20} />}
                            error={data?.errors?.includes('topServices')}
                        >
                            <div className="h-[350px] w-full mt-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data?.topServices} margin={{ bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 9, fontWeight: 'bold' }}
                                            interval={0}
                                            angle={-35}
                                            textAnchor="end"
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: '#000' }}
                                            itemStyle={{ color: '#000' }}
                                            formatter={(value) => [`$${value}`, 'Ingreso Mano de Obra']}
                                        />
                                        <Bar dataKey="labor_income" radius={[10, 10, 0, 0]}>
                                            {data?.topServices?.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ReportCard>
                    </>
                )}

                {activeTab === 'customers' && (
                    <>
                        <ReportCard
                            title={t('customer_retention')}
                            icon={<Users className="text-indigo-500" size={20} />}
                            error={data?.errors?.includes('retention')}
                        >
                            <div className="h-[350px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data?.retention}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: '#000' }}
                                            itemStyle={{ color: '#000' }}
                                        />
                                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                                            {data?.retention?.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ReportCard>

                        <ReportCard
                            title="Ranking de Fidelidad"
                            icon={<Users className="text-indigo-500" size={20} />}
                            error={data?.errors?.includes('loyalty')}
                        >
                            <div className="mt-6 space-y-4">
                                {data?.loyalty?.map((cust: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-black text-slate-400 group-hover:text-indigo-500 group-hover:border-indigo-200 transition-all">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 uppercase italic tracking-tighter">{cust.name}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">{cust.visits} servicios realizados</p>
                                            </div>
                                        </div>
                                        <div className="bg-white px-3 py-1 rounded-full border border-slate-200 text-[10px] font-black text-slate-500">
                                            {cust.paid_visits} cobrados
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ReportCard>
                    </>
                )}

                {activeTab === 'vehicles' && (
                    <div className="lg:col-span-2 space-y-8">
                        <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-wrap items-end gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marca</label>
                                <select
                                    className="bg-slate-50 border-none rounded-2xl p-3 font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 transition-all text-xs min-w-[180px]"
                                    value={vFilters.brand}
                                    onChange={(e) => setVFilters({ brand: e.target.value, model: '' })}
                                >
                                    <option value="">Todas las marcas</option>
                                    {vehicleFilters.brands.map((b: any) => (
                                        <option key={b.brand} value={b.brand}>{b.brand}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modelo</label>
                                <select
                                    className="bg-slate-50 border-none rounded-2xl p-3 font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 transition-all text-xs min-w-[180px]"
                                    value={vFilters.model}
                                    onChange={(e) => setVFilters({ ...vFilters, model: e.target.value })}
                                    disabled={!vFilters.brand}
                                >
                                    <option value="">Todos los modelos</option>
                                    {vehicleFilters.models.filter((m: any) => m.brand === vFilters.brand).map((m: any) => (
                                        <option key={m.model} value={m.model}>{m.model}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={fetchVehicleStats}
                                className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20 hover:scale-110 active:scale-95 transition-all"
                            >
                                <Filter size={20} />
                            </button>
                        </section>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <ReportCard
                                title="Lo que más se rompió"
                                icon={<Wrench className="text-rose-500" size={20} />}
                            >
                                <div className="h-[350px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={vehicleStats?.topDefects} margin={{ bottom: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 9, fontWeight: 'bold' }}
                                                angle={-25}
                                                textAnchor="end"
                                                interval={0}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: '#000' }}
                                                itemStyle={{ color: '#000' }}
                                            />
                                            <Bar dataKey="count" fill="#ef4444" radius={[8, 8, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </ReportCard>

                            <ReportCard
                                title="Distribución por Año"
                                icon={<Calendar className="text-blue-500" size={20} />}
                            >
                                <div className="h-[350px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={vehicleStats?.ageDistribution}>
                                            <defs>
                                                <linearGradient id="colorYear" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: '#000' }}
                                                itemStyle={{ color: '#000' }}
                                            />
                                            <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorYear)" strokeWidth={3} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <Info size={12} className="inline mr-2 text-blue-500" />
                                    Muestra la cantidad de visitas al taller según el año de fabricación del vehículo.
                                </p>
                            </ReportCard>

                            <ReportCard
                                title="Kilometraje al Ingresar"
                                icon={<Gauge className="text-emerald-500" size={20} />}
                            >
                                <div className="h-[350px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={vehicleStats?.kmTrend}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="month"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 10, fontWeight: 'bold' }}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: '#000' }}
                                                itemStyle={{ color: '#000' }}
                                                formatter={(value) => [`${Math.round(Number(value)).toLocaleString()} km`, 'KM Promedio']}
                                            />
                                            <Line type="monotone" dataKey="avg_km" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                    <TrendingUp size={12} className="inline mr-2 text-emerald-500" />
                                    Promedio de kilómetros registrados en la primera visita de cada vehículo.
                                </p>
                            </ReportCard>

                            <ReportCard
                                title="Fallas por Kilometraje"
                                icon={<AlertCircle className="text-orange-500" size={20} />}
                            >
                                <div className="mt-6 grid grid-cols-1 gap-4">
                                    {Object.keys(vehicleStats?.kmDefects || {}).length > 0 ? (
                                        Object.entries(vehicleStats?.kmDefects || {}).map(([range, items]: [string, any]) => (
                                            <div key={range} className="p-5 bg-slate-50 border border-slate-100 rounded-[2rem] hover:bg-white hover:border-orange-100 transition-all group">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="bg-orange-100 text-orange-600 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-orange-200 group-hover:bg-orange-500 group-hover:text-white transition-all">
                                                        Rango {range}
                                                    </span>
                                                    <span className="text-[10px] font-black text-slate-400">MAYOR FRECUENCIA</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {items.map((item: any, i: number) => (
                                                        <div key={i} className="flex items-center justify-between">
                                                            <p className="text-xs font-bold text-slate-800 uppercase italic tracking-tight">{item.defect}</p>
                                                            <p className="text-[10px] font-black text-slate-400">{item.count} ops</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-20 text-center text-slate-400 font-bold italic border border-dashed border-slate-200 rounded-[2rem]">
                                            Carga filtros para ver datos específicos
                                        </div>
                                    )}
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-6 p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                                    <Info size={12} className="inline mr-2 text-orange-500" />
                                    Muestra los servicios más recurrentes agrupados por el kilometraje del vehículo.
                                </p>
                            </ReportCard>
                        </div>
                    </div>
                )}
            </div>

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Exportar Datos</h2>
                                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mt-2 flex items-center gap-2">
                                    <Download size={14} className="text-indigo-500" />
                                    Generar Reporte Excel Personalizado
                                </p>
                            </div>
                            <button onClick={() => setShowExportModal(false)} className="bg-slate-50 p-3 rounded-2xl text-slate-400 hover:text-slate-900 transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo de Reporte</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'orders', label: 'Órdenes', icon: <ClipboardList size={16} /> },
                                        { id: 'income', label: 'Finanzas', icon: <DollarSign size={16} /> },
                                        { id: 'clients', label: 'Clientes', icon: <Users size={16} /> }
                                    ].map(type => (
                                        <button
                                            key={type.id}
                                            onClick={() => setExportParams({ ...exportParams, type: type.id })}
                                            className={`p-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${exportParams.type === type.id
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-600'
                                                : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'
                                                }`}
                                        >
                                            {type.icon}
                                            <span className="text-[10px] font-black uppercase tracking-wider">{type.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha Desde</label>
                                    <input
                                        type="date"
                                        value={exportParams.startDate}
                                        onChange={(e) => setExportParams({ ...exportParams, startDate: e.target.value })}
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 transition-all text-sm"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha Hasta</label>
                                    <input
                                        type="date"
                                        value={exportParams.endDate}
                                        onChange={(e) => setExportParams({ ...exportParams, endDate: e.target.value })}
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 transition-all text-sm"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 space-y-4">
                                <button
                                    onClick={handleExportExcel}
                                    disabled={exporting}
                                    className="w-full bg-indigo-600 text-white font-black py-6 rounded-[2rem] shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all text-[12px] uppercase tracking-[0.2em] italic flex items-center justify-center gap-3"
                                >
                                    {exporting ? (
                                        <>
                                            <RefreshCw size={20} className="animate-spin" />
                                            Generando...
                                        </>
                                    ) : (
                                        <>
                                            <Download size={20} />
                                            Descargar Excel
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowExportModal(false)}
                                    className="w-full font-black py-4 rounded-[1.5rem] bg-slate-50 text-slate-400 hover:bg-slate-100 transition-all uppercase text-[10px] tracking-widest"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ReportCard({ title, icon, children, error }: { title: string, icon: React.ReactNode, children: React.ReactNode, error?: boolean }) {
    return (
        <section className={`bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group overflow-hidden relative ${error ? 'border-red-100 bg-red-50/10' : ''}`}>
            {error && (
                <div className="absolute top-4 right-8 z-10">
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                        <AlertTriangle size={12} />
                        Error de Datos
                    </span>
                </div>
            )}
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:bg-blue-50 transition-colors" />
            <div className="relative">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-white transition-colors">
                        {icon}
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">{title}</h3>
                </div>
                {children}
            </div>
        </section>
    );
}
