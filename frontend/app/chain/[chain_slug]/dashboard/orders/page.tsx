'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { chainApi } from '@/lib/api';

export default function ChainOrdersPage() {
    const { chain_slug } = useParams<{ chain_slug: string }>();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterSlug, setFilterSlug] = useState('');
    const [chainData, setChainData] = useState<any>(null);

    useEffect(() => {
        chainApi.get('/me').then(r => setChainData(r.data));
    }, []);

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (filterSlug) params.set('slug', filterSlug);
        chainApi.get(`/orders?${params}`).then(r => setOrders(r.data)).finally(() => setLoading(false));
    }, [search, filterSlug]);

    const STATUS_COLORS: Record<string, string> = {
        pending: 'bg-slate-100 text-slate-600',
        approved: 'bg-emerald-100 text-emerald-700',
        in_repair: 'bg-amber-100 text-amber-700',
        in_progress: 'bg-amber-100 text-amber-700',
        ready: 'bg-indigo-100 text-indigo-700',
        waiting_parts: 'bg-rose-100 text-rose-600',
        quoted: 'bg-blue-100 text-blue-700',
        appointment: 'bg-purple-100 text-purple-700',
    };

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 uppercase italic">Órdenes</h2>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Toda la cadena · Solo lectura</p>
                </div>
            </header>

            <div className="flex gap-3">
                <input
                    type="text"
                    placeholder="Buscar por cliente o patente..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-grow bg-white border border-slate-100 rounded-2xl px-5 py-3 font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-sm"
                />
                <select
                    value={filterSlug}
                    onChange={e => setFilterSlug(e.target.value)}
                    className="bg-white border border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-700 focus:outline-none shadow-sm"
                >
                    <option value="">Todas las sucursales</option>
                    {chainData?.workshops?.map((w: any) => (
                        <option key={w.slug} value={w.slug}>{w.name}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <p className="text-center text-slate-400 font-bold py-20">Cargando...</p>
            ) : orders.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Sin órdenes activas</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {orders.map(order => (
                        <div key={order.uuid} className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex items-center gap-6">
                            <div className="flex-grow">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">#{order.id}</span>
                                    <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg uppercase">{order.tenant_slug}</span>
                                </div>
                                <h3 className="font-black text-slate-900 uppercase italic">{order.client_name}</h3>
                                <p className="text-xs font-bold text-slate-400">{order.plate} · {order.brand} {order.model}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-500'}`}>
                                    {order.status}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                    {new Date(order.created_at).toLocaleDateString('es-AR')}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
