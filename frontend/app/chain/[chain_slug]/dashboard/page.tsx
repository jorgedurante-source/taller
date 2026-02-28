'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { chainApi } from '@/lib/api';

export default function ChainDashboard() {
    const { chain_slug } = useParams<{ chain_slug: string }>();
    const [reports, setReports] = useState<any>(null);
    const [chainData, setChainData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('chain_user') || '{}') : {};

    useEffect(() => {
        Promise.all([chainApi.get('/reports'), chainApi.get('/me')])
            .then(([rRes, mRes]) => { setReports(rRes.data); setChainData(mRes.data); })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-20 text-center text-slate-400 font-bold">Cargando...</div>;

    const { consolidated, by_tenant } = reports || {};
    const workshops = chainData?.workshops || [];

    return (
        <div className="space-y-8">
            <header>
                <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tight">
                    Bienvenido, {user.name}
                </h2>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
                    Vista consolidada · {workshops.length} sucursales
                </p>
            </header>

            {/* Consolidated KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Órdenes este mes', value: consolidated?.orders_this_month, color: 'indigo' },
                    { label: 'Órdenes activas', value: consolidated?.active_orders, color: 'amber' },
                    { label: 'Total clientes', value: consolidated?.total_clients, color: 'emerald' },
                    {
                        label: 'Ingresos del mes', value: user.can_see_financials && consolidated?.monthly_income != null
                            ? `$${Number(consolidated.monthly_income).toLocaleString('es-AR')}` : '—', color: 'violet'
                    },
                ].map(kpi => (
                    <div key={kpi.label} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{kpi.label}</p>
                        <h3 className="text-3xl font-black text-slate-900 italic">{kpi.value ?? '—'}</h3>
                    </div>
                ))}
            </div>

            {/* Per-tenant breakdown */}
            <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Por sucursal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workshops.map((w: any) => {
                        const data = by_tenant?.[w.slug];
                        return (
                            <div key={w.slug} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-black text-slate-900 uppercase italic">{w.name}</h4>
                                    <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">/{w.slug}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 rounded-2xl p-3">
                                        <p className="text-[9px] font-black text-slate-400 uppercase">Órdenes/mes</p>
                                        <p className="text-xl font-black text-slate-900">{data?.orders_this_month ?? '—'}</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-3">
                                        <p className="text-[9px] font-black text-slate-400 uppercase">Activas</p>
                                        <p className="text-xl font-black text-slate-900">{data?.active_orders ?? '—'}</p>
                                    </div>
                                    {user.can_see_financials && data?.monthly_income != null && (
                                        <div className="bg-slate-50 rounded-2xl p-3 col-span-2">
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Ingresos del mes</p>
                                            <p className="text-xl font-black text-emerald-600">${Number(data.monthly_income).toLocaleString('es-AR')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
