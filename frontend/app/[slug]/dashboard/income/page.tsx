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
    const incomeMap = Object.fromEntries(dailyData.map((d: any) => [String(d.day).padStart(2, '0'), d.total]));
    const fullDailyData = Array.from({ length: daysInMonth }, (_, i) => {
        const day = String(i + 1).padStart(2, '0');
        return { day, total: incomeMap[day] || 0 };
    });

    const monthIncome = fullDailyData.reduce((acc, d) => acc + d.total, 0);
    const totalIncome = summary?.incomeByMonth?.reduce((acc: number, curr: any) => acc + curr.total, 0) || 0;
    const nonZeroMonths = summary?.incomeByMonth?.filter((m: any) => m.total > 0).length || 1;
    const avgIncome = totalIncome / nonZeroMonths;
    const readyToDeliverCount = summary?.ordersByStatus?.find((s: any) => s.status === 'Listo para entrega')?.count || 0;

    const formatVal = (val: number) => showTotals ? `$${val.toLocaleString('es-AR')}` : '***';

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Ingreso Histórico */}
                <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute -right-8 -bottom-8 bg-blue-600/20 w-40 h-40 rounded-full blur-3xl group-hover:bg-blue-600/40 transition-all"></div>
                    <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-4">Ingreso Total Histórico</p>
                    <h3 className="text-4xl font-black tracking-tighter">{formatVal(totalIncome)}</h3>
                    <div className="mt-6 flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase italic">
                        <ArrowUpRight size={16} /> Tendencia en crecimiento
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
                            Total del mes: <span className="text-blue-600">{formatVal(monthIncome)}</span>
                        </p>
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
                                formatter={(value: any) => [showTotals ? `$${Number(value).toLocaleString('es-AR')}` : '***', 'Ingreso']}
                            />
                            <Bar dataKey="total" radius={[6, 6, 4, 4]}>
                                {fullDailyData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.total > 0 ? '#3b82f6' : '#e2e8f0'}
                                        fillOpacity={entry.total > 0 ? 1 : 0.6}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </section>
        </div>
    );
}
