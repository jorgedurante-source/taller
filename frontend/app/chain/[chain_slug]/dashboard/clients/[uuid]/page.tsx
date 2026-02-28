'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { chainApi } from '@/lib/api';

export default function ChainClientDetailPage() {
    const { chain_slug, uuid } = useParams<{ chain_slug: string; uuid: string }>();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        chainApi.get(`/clients/${uuid}/history`).then(r => setData(r.data)).finally(() => setLoading(false));
    }, [uuid]);

    if (loading) return <div className="p-20 text-center text-slate-400 font-bold">Cargando historial...</div>;

    const client = data[0]?.client;

    return (
        <div className="space-y-8">
            <header>
                <h2 className="text-3xl font-black text-slate-900 uppercase italic">
                    {client?.first_name} {client?.last_name}
                </h2>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">
                    {client?.email} · Historial completo en la cadena
                </p>
            </header>

            {data.map((tenantData: any) => (
                <div key={tenantData.tenant_slug} className="space-y-3">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black bg-indigo-600 text-white px-3 py-1.5 rounded-xl uppercase tracking-widest">
                            {tenantData.tenant_slug}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase">
                            {tenantData.orders?.length} órdenes
                        </span>
                    </div>
                    {tenantData.orders?.length === 0 ? (
                        <p className="text-xs font-bold text-slate-300 italic px-2">Sin órdenes en esta sucursal</p>
                    ) : (
                        tenantData.orders.map((order: any) => (
                            <div key={order.uuid} className="bg-white rounded-[1.5rem] p-4 border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className="flex-grow">
                                    <p className="text-[9px] font-black text-slate-400 uppercase">#{order.id} · {order.plate} {order.brand} {order.model}</p>
                                    <p className="font-bold text-slate-700 text-sm">{order.description || 'Sin descripción'}</p>
                                </div>
                                <div className="text-right text-[10px] font-black text-slate-400 uppercase">
                                    <p>{new Date(order.created_at).toLocaleDateString('es-AR')}</p>
                                    <p className="text-slate-600">{order.status}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ))}
        </div>
    );
}
