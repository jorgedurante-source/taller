'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { chainApi } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function ChainReportsPage() {
    const { chain_slug } = useParams<{ chain_slug: string }>();
    const [reports, setReports] = useState<any>(null);
    const [chainData, setChainData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('chain_user') || '{}') : {};

    useEffect(() => {
        Promise.all([chainApi.get('/reports'), chainApi.get('/me')])
            .then(([r, m]) => { setReports(r.data); setChainData(m.data); })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-20 text-center text-slate-400 font-bold">Cargando...</div>;

    const workshops = chainData?.workshops || [];
    const byTenant = reports?.by_tenant || {};

    // Build comparison chart data
    const comparisonData = workshops.map((w: any, i: number) => ({
        name: w.name,
        ordenes: byTenant[w.slug]?.orders_this_month || 0,
        activas: byTenant[w.slug]?.active_orders || 0,
        ingresos: byTenant[w.slug]?.monthly_income || 0,
        fill: COLORS[i % COLORS.length],
    }));

    return (
        <div className="space-y-8">
            <header>
                <h2 className="text-3xl font-black text-slate-900 uppercase italic">Reportes</h2>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Comparativa entre sucursales</p>
            </header>

            {/* Comparativa de órdenes */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                <h3 className="font-black text-slate-900 uppercase italic mb-6">Órdenes este mes por sucursal</h3>
                <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="ordenes" radius={[10, 10, 0, 0]}>
                                {comparisonData.map((entry: any, index: number) => (
                                    <Cell key={index} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Comparativa financiera */}
            {user.can_see_financials && (
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                    <h3 className="font-black text-slate-900 uppercase italic mb-6">Ingresos del mes por sucursal</h3>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparisonData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }}
                                    tickFormatter={v => `$${Number(v).toLocaleString('es-AR')}`} width={80} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }}
                                    formatter={(v: any) => [`$${Number(v).toLocaleString('es-AR')}`, 'Ingresos']} />
                                <Bar dataKey="ingresos" radius={[10, 10, 0, 0]}>
                                    {comparisonData.map((entry: any, index: number) => (
                                        <Cell key={index} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Tabla detallada */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm overflow-x-auto">
                <h3 className="font-black text-slate-900 uppercase italic mb-6">Resumen por sucursal</h3>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-100">
                            {['Sucursal', 'Órdenes/mes', 'Activas', 'Días prom.', 'Clientes', user.can_see_financials ? 'Ingresos/mes' : null]
                                .filter(Boolean).map(h => (
                                    <th key={h} className="text-left py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                ))}
                        </tr>
                    </thead>
                    <tbody>
                        {workshops.map((w: any) => {
                            const d = byTenant[w.slug] || {};
                            return (
                                <tr key={w.slug} className="border-b border-slate-50 hover:bg-slate-50/50">
                                    <td className="py-4 px-4 font-black text-slate-900 uppercase italic text-xs">{w.name}</td>
                                    <td className="py-4 px-4 font-black text-slate-900 tabular-nums">{d.orders_this_month ?? '—'}</td>
                                    <td className="py-4 px-4 font-black text-amber-600 tabular-nums">{d.active_orders ?? '—'}</td>
                                    <td className="py-4 px-4">
                                        <span className={`font-black text-sm ${d.avg_repair_days > 7 ? 'text-rose-600' : d.avg_repair_days > 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            {d.avg_repair_days > 0 ? `${d.avg_repair_days}d` : '—'}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 font-black text-slate-900 tabular-nums">{d.total_clients ?? '—'}</td>
                                    {user.can_see_financials && (
                                        <td className="py-4 px-4 font-black text-emerald-600 tabular-nums">
                                            {d.monthly_income != null ? `$${Number(d.monthly_income).toLocaleString('es-AR')}` : '—'}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
