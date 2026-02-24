'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
    ClipboardList,
    Plus,
    Search,
    Car,
    Clock,
    ArrowRight,
    Filter,
    CheckCircle2,
    CircleDollarSign,
    CircleSlash
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSlug } from '@/lib/slug';

export default function OrdersPage() {
    const { slug } = useSlug();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAll, setShowAll] = useState(false);
    const { hasPermission } = useAuth();
    const canSeeIncome = hasPermission('income');

    const searchParams = useSearchParams();
    const statusParam = searchParams.get('status');
    const historyParam = searchParams.get('showHistory');
    const filterParam = searchParams.get('filter');

    useEffect(() => {
        if (historyParam === 'true') setShowAll(true);
        if (statusParam) setSearch(statusParam);
        if (filterParam === 'finished') {
            setShowAll(true);
            setSearch('Entregado');
        }
        if (filterParam === 'active_work') {
            setShowAll(false);
            setSearch('Apro'); // Will match Aprobado
        }
    }, [statusParam, historyParam, filterParam]);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await api.get('/orders');
                setOrders(response.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    const filteredOrders = orders.filter(o => {
        const query = search.toLowerCase();
        const matchesSearch = (
            (o.client_name || '').toLowerCase().includes(query) ||
            (o.plate || '').toLowerCase().includes(query) ||
            (o.model || '').toLowerCase().includes(query) ||
            (o.status || '').toLowerCase().includes(query)
        );

        if (showAll) {
            // History mode: only delivered orders
            return matchesSearch && o.status === 'Entregado';
        }

        // Default: all active orders (everything except Entregado)
        return matchesSearch && o.status !== 'Entregado';
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pendiente': return 'bg-slate-100 text-slate-600';
            case 'Aprobado': return 'bg-emerald-100 text-emerald-700';
            case 'En proceso':
            case 'En reparación': return 'bg-amber-100 text-amber-700';
            case 'Presupuestado': return 'bg-blue-100 text-blue-700';
            case 'Listo para entrega': return 'bg-indigo-100 text-indigo-700';
            case 'Entregado': return 'bg-slate-900 text-white';
            default: return 'bg-slate-50 text-slate-500';
        }
    };

    const getPaymentBadge = (order: any) => {
        if (!canSeeIncome) return null;
        const { payment_status, payment_amount, order_total } = order;

        if (!payment_status || payment_status === 'sin_cobrar') {
            return (
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-500">
                    <CircleSlash size={11} /> Sin cobrar
                </span>
            );
        }
        if (payment_status === 'parcial') {
            return (
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600">
                    <CircleDollarSign size={11} /> Parcial ${(payment_amount || 0).toLocaleString('es-AR')}
                </span>
            );
        }
        if (payment_status === 'cobrado') {
            return (
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600">
                    <CheckCircle2 size={11} /> Cobrado ${(payment_amount || 0).toLocaleString('es-AR')}
                </span>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 pb-20">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Gestión de Órdenes</h2>
                    <p className="text-slate-500 font-bold tracking-wider uppercase text-xs mt-1">Órdenes de trabajo del taller</p>
                </div>
                <Link
                    href={`/${slug}/dashboard/orders/create`}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                >
                    <Plus size={20} />
                    <span>NUEVA ORDEN</span>
                </Link>
            </header>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="bg-slate-50 p-3 rounded-xl text-slate-400">
                        <Search size={20} />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por cliente, patente, modelo o estado..."
                        className="bg-transparent border-none outline-none w-full text-slate-900 font-bold p-2 placeholder-slate-400"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 px-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={showAll}
                                onChange={(e) => setShowAll(e.target.checked)}
                            />
                            <div className={`w-10 h-5 rounded-full transition-colors ${showAll ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${showAll ? 'translate-x-5' : ''}`}></div>
                        </div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900 transition-colors">Entregadas</span>
                    </label>
                </div>

                <button className="bg-white p-4 rounded-2xl border border-slate-100 text-slate-400 hover:text-slate-900 transition-all">
                    <Filter size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <p className="p-10 text-center text-slate-400 font-bold">Cargando órdenes...</p>
                ) : filteredOrders.length === 0 ? (
                    <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                        <ClipboardList size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No hay órdenes para mostrar</p>
                    </div>
                ) : (
                    filteredOrders.map(order => (
                        <div key={order.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col lg:flex-row lg:items-center gap-6 group">
                            <div className="flex items-center gap-4 lg:w-1/4">
                                <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    <ClipboardList size={28} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orden #{order.id}</p>
                                    <h3 className="text-xl font-black text-slate-900 uppercase truncate">{order.client_name}</h3>
                                    {canSeeIncome && order.order_total > 0 && (
                                        <p className="text-[11px] font-black text-slate-400">
                                            Total orden: <span className="text-slate-700">${Number(order.order_total).toLocaleString('es-AR')}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-6 lg:w-1/3 text-slate-500">
                                <div className="flex items-center gap-2">
                                    <Car size={18} className="text-slate-300" />
                                    <div>
                                        <p className="font-bold text-slate-700 leading-tight">{order.model}</p>
                                        <p className="text-[10px] font-black uppercase tracking-widest bg-slate-100 px-2 rounded-sm text-slate-500">{order.plate}</p>
                                    </div>
                                </div>
                                <div className="h-8 w-px bg-slate-100"></div>
                                <div className="flex items-center gap-2">
                                    <Clock size={18} className="text-slate-300" />
                                    <span className="text-xs font-bold">{new Date(order.created_at).toLocaleDateString('es-AR')}</span>
                                </div>
                            </div>

                            <div className="flex-1 flex items-center justify-between flex-wrap gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(order.status)}`}>
                                        {order.status}
                                    </span>
                                    {getPaymentBadge(order)}
                                </div>
                                <Link
                                    href={`/${slug}/dashboard/orders/${order.id}`}
                                    className="bg-blue-50 text-blue-600 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"
                                >
                                    Detalles <ArrowRight size={14} />
                                </Link>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
