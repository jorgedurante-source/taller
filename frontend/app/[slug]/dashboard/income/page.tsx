'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useSlug } from '@/lib/slug';
import {
    TrendingUp,
    DollarSign,
    Calendar,
    ArrowUpRight,
    ClipboardCheck,
    Eye,
    EyeOff,
    ChevronLeft,
    ChevronRight,
    Search
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import {
    PieChart,
    Pie,
    Cell as PieCell
} from 'recharts';
import { Tab } from '@headlessui/react';

export default function IncomePage() {
    const { slug } = useSlug();
    const router = useRouter();
    const [summary, setSummary] = useState<any>(null);
    const [dailyData, setDailyData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const now = new Date();
    const localMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState(localMonth);
    const [showTotals, setShowTotals] = useState(true);
    const [ordersByStatus, setOrdersByStatus] = useState<any[]>([]);
    const [topCustomers, setTopCustomers] = useState<any[]>([]);

    useEffect(() => {
        const savedPrivacy = localStorage.getItem('hide_income_totals');
        if (savedPrivacy === 'true') setShowTotals(false);

        const fetchAll = async () => {
            setLoading(true);
            try {
                const [summaryRes, dailyRes] = await Promise.all([
                    api.get('/reports/dashboard'),
                    api.get(`/reports/income-daily?month=${selectedMonth}`)
                ]);
                setSummary(summaryRes.data);
                setDailyData(dailyRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [selectedMonth]);

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const [statusRes, customersRes] = await Promise.all([
                    api.get('/reports/orders-status'),
                    api.get('/reports/top-customers')
                ]);
                setOrdersByStatus(statusRes.data);
                setTopCustomers(customersRes.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchReports();
    }, []);

    const togglePrivacy = () => {
        const newVal = !showTotals;
        setShowTotals(newVal);
        localStorage.setItem('hide_income_totals', String(!newVal));
    };

    const changeMonth = (offset: number) => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1 + offset, 1);
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(newMonth);
    };

    if (loading && !summary) return <div className="p-10 font-bold text-slate-400 italic">Generando análisis financiero...</div>;

    // Build complete day-by-day grid for the selected month, filling missing days with 0
    const [selYear, selMonthNum] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(selYear, selMonthNum, 0).getDate();
    const incomeMap = Object.fromEntries(dailyData.map((d: any) => [String(d.day).padStart(2, '0'), {
        labor_income: d.labor_income || 0,
        parts_profit: d.parts_profit || 0
    }]));
    const fullDailyData = Array.from({ length: daysInMonth }, (_, i) => {
        const day = String(i + 1).padStart(2, '0');
        const income = incomeMap[day] || { labor_income: 0, parts_profit: 0 };
        return { day, ...income };
    });

    const partsProfitPercentage = summary?.parts_profit_percentage || 0;

    // Historical Breakdown
    const histLabor = summary?.historicalStats?.labor_total || 0;
    const histParts = summary?.historicalStats?.parts_total || 0;
    const histPartsProfit = histParts * (partsProfitPercentage / 100);
    const totalHistoricalIncome = histLabor + histPartsProfit;

    // Monthly Breakdown
    const monthLabor = summary?.monthlyStats?.labor_total || 0;
    const monthParts = summary?.monthlyStats?.parts_total || 0;
    const monthPartsProfit = monthParts * (partsProfitPercentage / 100);
    const totalMonthlyIncome = monthLabor + monthPartsProfit;

    const avgIncome = totalHistoricalIncome / (summary?.incomeByMonth?.length || 1);

    const readyToDeliverCount = summary?.ordersByStatus?.find((s: any) => s.status === 'Listo para entrega')?.count || 0;

    const formatVal = (val: number) => showTotals ? `$${val.toLocaleString('es-AR')}` : '***';

    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];

    return (
        <div className="space-y-8 pb-20">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase italic">Análisis Financiero</h2>
                    <p className="text-slate-500 font-bold tracking-wider uppercase text-xs mt-1">Control de caja y proyecciones</p>
                </div>
                <button
                    onClick={togglePrivacy}
                    className="flex items-center gap-2 bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-900 transition-all"
                >
                    {showTotals ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showTotals ? 'Ocultar Cifras' : 'Mostrar Cifras'}
                </button>
            </header>

            <Tab.Group>
                <Tab.List className="flex space-x-4 border-b border-gray-200">
                    <Tab className={({ selected }) => selected ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}>
                        Ingresos
                    </Tab>
                    <Tab className={({ selected }) => selected ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}>
                        Reportes
                    </Tab>
                </Tab.List>
                <Tab.Panels>
                    <Tab.Panel>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Ingreso Histórico */}
                            <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden group">
                                <div className="absolute -right-8 -bottom-8 bg-blue-600/20 w-40 h-40 rounded-full blur-3xl group-hover:bg-blue-600/40 transition-all"></div>
                                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-4">Ingreso Total Histórico</p>
                                <h3 className="text-4xl font-black tracking-tighter mb-4">{formatVal(totalHistoricalIncome)}</h3>

                                <div className="space-y-2 border-t border-slate-800 pt-4 mt-4">
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        <span>Neto (Mano Obra)</span>
                                        <span className="text-white">{formatVal(histLabor)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        <span>Repuestos</span>
                                        <span className="text-white">{formatVal(histParts)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                                        <span>Ganancia Rep. ({partsProfitPercentage}%)</span>
                                        <span>{formatVal(histPartsProfit)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Promedio Mensual -> Link to History */}
                            <div
                                onClick={() => router.push(`/${slug}/dashboard/orders?showHistory=true&filter=finished`)}
                                className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:border-blue-200 cursor-pointer transition-all group"
                            >
                                <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    <TrendingUp size={24} />
                                </div>
                                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Promedio Mensual</p>
                                <h3 className="text-2xl font-black text-slate-900">{formatVal(avgIncome)}</h3>
                                <p className="text-slate-500 text-[10px] font-bold mt-4 uppercase flex items-center gap-1 group-hover:text-blue-600 transition-colors">
                                    Ver historial de cobros <ChevronRight size={14} />
                                </p>
                            </div>

                            {/* Listas para cobro -> Link to orders */}
                            <div
                                onClick={() => router.push(`/${slug}/dashboard/orders?status=Listo para entrega`)}
                                className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:border-indigo-200 cursor-pointer transition-all group"
                            >
                                <div className="bg-emerald-50 w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <ClipboardCheck size={24} />
                                </div>
                                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-2">Listas para cobro</p>
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-slate-900 leading-none">{readyToDeliverCount} Órdenes</h3>
                                    <p className="text-emerald-600 font-black text-lg">{formatVal(summary?.readyToDeliverTotal || 0)}</p>
                                </div>
                                <p className="text-slate-500 text-[10px] font-bold mt-4 uppercase flex items-center gap-1 group-hover:text-indigo-600 transition-colors">
                                    Listado de unidades <Search size={14} />
                                </p>
                            </div>
                        </div>

                        <section className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3 italic">
                                        <Calendar className="text-blue-600" size={32} /> FACTURACIÓN DIARIA
                                    </h3>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Detalle del flujo por jornada</p>
                                    <p className="text-slate-900 font-black text-lg mt-1">
                                        Total del mes: <span className="text-blue-600">{formatVal(totalMonthlyIncome)}</span>
                                    </p>
                                    <div className="flex gap-4 mt-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Neto: {formatVal(monthLabor)}</span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Repuestos: {formatVal(monthParts)}</span>
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Ganancia: {formatVal(monthPartsProfit)} ({partsProfitPercentage}%)</span>
                                    </div>
                                </div>

                                <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 items-center">
                                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-slate-900">
                                        <ChevronLeft size={20} />
                                    </button>
                                    <span className="px-6 text-sm font-black text-slate-900 uppercase tracking-widest min-w-[140px] text-center">
                                        {new Date(selYear, selMonthNum - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-slate-900">
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                            <div className="h-[380px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={fullDailyData} margin={{ left: 0, right: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="day"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 900 }}
                                            dy={10}
                                            tickFormatter={(val) => String(parseInt(val))}
                                            interval={0}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                                            tickFormatter={(val) => showTotals ? (val >= 1000 ? `$${val / 1000}k` : `$${val}`) : '***'}
                                            width={55}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 50px -12px rgb(0 0 0 / 0.1)', padding: '15px' }}
                                            itemStyle={{ fontWeight: 900, color: '#0f172a' }}
                                            labelFormatter={(label) => `Día ${parseInt(label)}`}
                                            formatter={(value: any, name: any) => [
                                                showTotals ? `$${Number(value).toLocaleString('es-AR')}` : '***',
                                                name === 'labor_income' ? 'Mano de Obra' : 'Ganancia Repuestos'
                                            ]}
                                        />
                                        <Bar dataKey="labor_income" stackId="a" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                        <Bar dataKey="parts_profit" stackId="a" fill="#82ca9d" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </section>

                        {/* Monthly Income History */}
                        <section className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm mt-8">
                            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3 italic mb-6">
                                <TrendingUp className="text-emerald-600" size={32} /> HISTÓRICO MENSUAL
                            </h3>
                            <div className="h-[380px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={summary?.incomeByMonth.slice().reverse().map((m: any) => ({
                                        ...m,
                                        total_calculated: (m.labor_income || 0) + ((m.parts_price || 0) * (partsProfitPercentage / 100))
                                    }))} margin={{ left: 0, right: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="month"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }}
                                            tickFormatter={(val) => showTotals ? (val >= 1000 ? `$${val / 1000}k` : `$${val}`) : '***'}
                                            width={55}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 50px -12px rgb(0 0 0 / 0.1)', padding: '15px' }}
                                            itemStyle={{ fontWeight: 900, color: '#0f172a' }}
                                            formatter={(val: any) => [showTotals ? `$${Number(val).toLocaleString('es-AR')}` : '***', 'Ingreso']}
                                        />
                                        <Bar dataKey="total_calculated" fill="#10b981" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </section>
                    </Tab.Panel>
                    <Tab.Panel>
                        {/* New Reports Section */}
                        <section className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
                            <h3 className="text-2xl font-black text-slate-900">Reportes Avanzados</h3>
                            <p className="text-slate-400 text-sm">Explora métricas detalladas y gráficas interactivas.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                {/* Orders by Status */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <h4 className="text-lg font-bold text-slate-900 mb-4">Órdenes por Estado</h4>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={ordersByStatus}
                                                dataKey="count"
                                                nameKey="status"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={100}
                                                fill="#8884d8"
                                                label={(entry: any) => entry.status}
                                            >
                                                {ordersByStatus.map((entry, index) => (
                                                    <PieCell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Top Customers */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <h4 className="text-lg font-bold text-slate-900 mb-4">Top Clientes</h4>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={topCustomers} layout="vertical" margin={{ left: 50 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                            <Tooltip />
                                            <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Most Frequent Services */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm md:col-span-2">
                                    <h4 className="text-lg font-bold text-slate-900 mb-4">Servicios más realizados</h4>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={summary?.commonServices} margin={{ bottom: 30 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="description"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 9, fontWeight: 900 }}
                                                interval={0}
                                                angle={-15}
                                                textAnchor="end"
                                                dy={10}
                                            />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="count" name="Frecuencia" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </section>
                    </Tab.Panel>
                </Tab.Panels>
            </Tab.Group>
        </div>
    );
}
