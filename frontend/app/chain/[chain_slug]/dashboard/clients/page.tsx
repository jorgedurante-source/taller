'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { chainApi } from '@/lib/api';

export default function ChainClientsPage() {
    const { chain_slug } = useParams<{ chain_slug: string }>();
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setLoading(true);
        const params = search ? `?search=${encodeURIComponent(search)}` : '';
        chainApi.get(`/clients${params}`).then(r => setClients(r.data)).finally(() => setLoading(false));
    }, [search]);

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-3xl font-black text-slate-900 uppercase italic">Clientes</h2>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Base unificada de la cadena</p>
            </header>

            <input
                type="text"
                placeholder="Buscar por nombre, email o teléfono..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-3 font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-sm"
            />

            {loading ? (
                <p className="text-center text-slate-400 font-bold py-20">Cargando...</p>
            ) : (
                <div className="space-y-3">
                    {clients.map(client => (
                        <Link key={client.uuid || client.id}
                            href={`/chain/${chain_slug}/dashboard/clients/${client.uuid}`}
                            className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex items-center gap-6 hover:shadow-lg hover:border-indigo-100 transition-all block"
                        >
                            <div className="flex-grow">
                                <h3 className="font-black text-slate-900 uppercase italic">{client.first_name} {client.last_name}</h3>
                                <p className="text-xs font-bold text-slate-400">{client.email} · {client.phone}</p>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase">
                                <span>{client.total_orders || client.order_count} órdenes</span>
                                <div className="flex gap-1">
                                    {client.tenants?.map((t: string) => (
                                        <span key={t} className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg">{t}</span>
                                    ))}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
