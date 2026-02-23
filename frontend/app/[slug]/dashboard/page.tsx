'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useSlug } from '@/lib/slug';
import api from '@/lib/api';
import Link from 'next/link';
import {
    Users,
    Car,
    ClipboardList,
    TrendingUp,
    Plus,
    ChevronRight,
    Eye,
    EyeOff
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
    const { user, hasPermission } = useAuth();
    const { slug } = useSlug();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showTotals, setShowTotals] = useState(true);

    useEffect(() => {
        const savedPrivacy = localStorage.getItem('hide_income_totals');
        if (savedPrivacy === 'true') setShowTotals(false);
    }, []);

    const togglePrivacy = () => {
        const newVal = !showTotals;
        setShowTotals(newVal);
        localStorage.setItem('hide_income_totals', String(!newVal));
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await api.get('/reports/dashboard');
                setData(response.data);
            } catch (err) {
                console.error('Error fetching dashboard data', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchData();
        }
    }, [user]);

    if (loading) {
        return <div style={{ color: 'var(--text-muted)' }} className="p-8">Cargando estadísticas...</div>;
    }

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    // Use accent color from CSS var for chart ticks
    const tickStyle = { fill: 'var(--text-muted)', fontSize: 12 };
    const gridColor = 'var(--border)';

    return (
        <>
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        Bienvenido, {user?.username}
                    </h2>
                    <p style={{ color: 'var(--text-muted)' }}>Aquí tienes el resumen de hoy para el taller.</p>
                </div>
                <div className="flex items-center gap-3">
                    {hasPermission('income') && (
                        <button
                            onClick={togglePrivacy}
                            className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm transition-all"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            {showTotals ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    )}
                    <Link href={`/${slug}/dashboard/orders/create`}>
                        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all text-sm font-bold">
                            <Plus size={20} />
                            <span>Nueva Orden</span>
                        </button>
                    </Link>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Órdenes Activas"
                    value={data?.ordersByStatus
                        .filter((item: any) => item.status !== 'Pendiente' && item.status !== 'Entregado')
                        .reduce((acc: number, item: any) => acc + item.count, 0) || 0}
                    icon={<ClipboardList className="text-blue-500" />}
                    accent="#3b82f6"
                />
                {hasPermission('income') && (
                    <StatCard
                        title="Ingresos (Mes)"
                        value={showTotals ? (() => {
                            const month = data?.incomeByMonth[0];
                            const labor = month?.labor_income || 0;
                            const profit = (month?.parts_price || 0) * ((data?.parts_profit_percentage || 0) / 100);
                            return formatCurrency(labor + profit);
                        })() : '***'}
                        icon={<TrendingUp className="text-emerald-500" />}
                        accent="#10b981"
                    />
                )}
                <StatCard
                    title="Clientes Nuevos (Mes)"
                    value={data?.newClientsThisMonth || 0}
                    icon={<Users className="text-amber-500" />}
                    accent="#f59e0b"
                />
                <StatCard
                    title="Vehículos Atendidos"
                    value={data?.vehiclesByMonth[0]?.count || 0}
                    icon={<Car className="text-purple-500" />}
                    accent="#8b5cf6"
                />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {hasPermission('income') && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
                            Ingresos Mensuales
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data?.incomeByMonth.slice().reverse().map((m: any) => ({
                                    ...m,
                                    total_calculated: (m.labor_income || 0) + ((m.parts_price || 0) * ((data?.parts_profit_percentage || 0) / 100))
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={tickStyle} />
                                    <YAxis axisLine={false} tickLine={false} tick={tickStyle} />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: '1px solid var(--border)',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)',
                                            backgroundColor: 'var(--bg-surface)',
                                            color: 'var(--text-primary)'
                                        }}
                                        formatter={(val: any) => formatCurrency(val)}
                                        labelStyle={{ color: 'var(--text-primary)' }}
                                        itemStyle={{ color: 'var(--text-muted)' }}
                                    />
                                    <Bar dataKey="total_calculated" name="Ingresos" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
                        Órdenes por Estado
                    </h3>
                    <div className="h-[300px] flex items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={data?.ordersByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="count" nameKey="status">
                                    {data?.ordersByStatus.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: '1px solid var(--border)',
                                        backgroundColor: 'var(--bg-surface)',
                                        color: 'var(--text-primary)'
                                    }}
                                    itemStyle={{ color: 'var(--text-muted)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 ml-4">
                            {data?.ordersByStatus.map((item: any, index: number) => (
                                <div key={item.status} className="flex items-center gap-2 text-sm">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span style={{ color: 'var(--text-muted)' }}>{item.status}: <strong style={{ color: 'var(--text-primary)' }}>{item.count}</strong></span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Servicios Recientes</h3>
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                        Ver todos <ChevronRight size={16} />
                    </button>
                </div>
                <div className="p-0">
                    <table className="w-full text-left">
                        <thead className="text-xs uppercase tracking-wider" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                            <tr>
                                <th className="px-6 py-4 font-medium">Descripción</th>
                                <th className="px-6 py-4 font-medium text-right">Cant.</th>
                            </tr>
                        </thead>
                        <tbody style={{ borderColor: 'var(--border)' }}>
                            {data?.commonServices.map((service: any, i: number) => (
                                <tr
                                    key={i}
                                    className="transition-all"
                                    style={{ borderBottom: '1px solid var(--border)' }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-base)')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    <td className="px-6 py-4 font-medium" style={{ color: 'var(--text-primary)' }}>{service.description}</td>
                                    <td className="px-6 py-4 text-right font-bold" style={{ color: 'var(--accent)' }}>{service.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

function StatCard({ title, value, icon, accent }: { title: string, value: string | number, icon: React.ReactNode, accent: string }) {
    return (
        <div
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between"
        >
            <div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{title}</p>
                <p className="text-3xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>{value}</p>
            </div>
            <div className="p-3 rounded-xl" style={{ backgroundColor: `${accent}15`, border: `1px solid ${accent}25` }}>
                {icon}
            </div>
        </div>
    );
}
