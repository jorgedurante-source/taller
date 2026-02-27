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
    CircleSlash,
    MessageSquare
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSlug } from '@/lib/slug';
import { useTranslation } from '@/lib/i18n';

export default function OrdersPage() {
    const { slug } = useSlug();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [onlyUnread, setOnlyUnread] = useState(false);
    const { hasPermission } = useAuth();
    const { t } = useTranslation();
    const canSeeIncome = hasPermission('income');

    const searchParams = useSearchParams();
    const statusParam = searchParams.get('status');
    const historyParam = searchParams.get('showHistory');
    const filterParam = searchParams.get('filter');

    if (!hasPermission('orders')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
                <ClipboardList size={48} className="mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-xs">{t('module_not_enabled')}</p>
                <p className="text-[10px] mt-2 italic">{t('contact_admin_to_activate')}</p>
            </div>
        );
    }

    useEffect(() => {
        if (historyParam === 'true') setShowAll(true);
        if (statusParam) setSearch(statusParam);
        if (filterParam === 'finished') {
            setShowAll(true);
            setSearch('delivered');
        }
        if (filterParam === 'active_work') {
            setShowAll(false);
            setSearch('approved');
        }
        if (filterParam === 'unread') {
            setOnlyUnread(true);
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

        if (onlyUnread) {
            return matchesSearch && o.unread_messages > 0;
        }

        if (showAll) {
            // History mode: only delivered orders
            return matchesSearch && o.status === 'delivered';
        }

        // Default: all active orders (everything except delivered)
        return matchesSearch && o.status !== 'delivered';
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-slate-100 text-slate-600';
            case 'appointment': return 'bg-purple-100 text-purple-700';
            case 'approved': return 'bg-emerald-100 text-emerald-700';
            case 'in_repair':
            case 'in_progress': return 'bg-amber-100 text-amber-700';
            case 'quoted': return 'bg-blue-100 text-blue-700';
            case 'ready': return 'bg-indigo-100 text-indigo-700';
            case 'waiting_parts': return 'bg-rose-100 text-rose-700';
            case 'delivered': return 'bg-slate-900 text-white';
            default: return 'bg-slate-50 text-slate-500';
        }
    };

    const getPaymentBadge = (order: any) => {
        if (!canSeeIncome) return null;
        const { payment_status, payment_amount, order_total } = order;

        if (!payment_status || payment_status === 'unpaid' || payment_status === 'sin_cobrar') {
            return (
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-500">
                    <CircleSlash size={11} /> {t('unpaid')}
                </span>
            );
        }
        if (payment_status === 'partial') {
            return (
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600">
                    <CircleDollarSign size={11} /> {t('partial')} ${(payment_amount || 0).toLocaleString('es-AR')}
                </span>
            );
        }
        if (payment_status === 'paid') {
            return (
                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600">
                    <CheckCircle2 size={11} /> {t('paid')} ${(payment_amount || 0).toLocaleString('es-AR')}
                </span>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 pb-20">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{t('orders_management')}</h2>
                    <p className="text-slate-500 font-bold tracking-wider uppercase text-xs mt-1">{t('orders_description')}</p>
                </div>
                <Link
                    href={`/${slug}/dashboard/orders/create`}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                >
                    <Plus size={20} />
                    <span>{t('new_order').toUpperCase()}</span>
                </Link>
            </header>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="bg-slate-50 p-3 rounded-xl text-slate-400">
                        <Search size={20} />
                    </div>
                    <input
                        type="text"
                        placeholder={t('search_orders_placeholder')}
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
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900 transition-colors">{t('history_delivered')}</span>
                    </label>
                </div>

                <button
                    onClick={() => {
                        setOnlyUnread(!onlyUnread);
                        if (!onlyUnread) setShowAll(false);
                    }}
                    className={`bg-white p-4 rounded-2xl border flex items-center gap-2 transition-all ${onlyUnread ? 'border-red-200 text-red-600 bg-red-50' : 'border-slate-100 text-slate-400 hover:text-slate-900'}`}
                    title={t('unread_only')}
                >
                    <MessageSquare size={20} />
                    {onlyUnread && <span className="text-[10px] font-black uppercase">{t('unread_only')}</span>}
                </button>

                <button className="bg-white p-4 rounded-2xl border border-slate-100 text-slate-400 hover:text-slate-900 transition-all">
                    <Filter size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <p className="p-10 text-center text-slate-400 font-bold">{t('loading_orders')}</p>
                ) : filteredOrders.length === 0 ? (
                    <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                        <ClipboardList size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">{t('no_orders')}</p>
                    </div>
                ) : (
                    filteredOrders.map(order => (
                        <div key={order.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col lg:flex-row lg:items-center gap-6 group">
                            <div className="flex items-center gap-4 lg:w-1/4">
                                <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    <ClipboardList size={28} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('orders')} #{order.id}</p>
                                        {order.unread_messages > 0 && (
                                            <span className="flex items-center gap-1 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase animate-pulse">
                                                <MessageSquare size={8} /> {order.unread_messages}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 uppercase truncate">{order.client_name}</h3>
                                    {canSeeIncome && order.order_total > 0 && (
                                        <p className="text-[11px] font-black text-slate-400">
                                            {t('total_order')}: <span className="text-slate-700">${Number(order.order_total).toLocaleString('es-AR')}</span>
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
                                        {t(order.status)}
                                    </span>
                                    {getPaymentBadge(order)}
                                </div>
                                <Link
                                    href={`/${slug}/dashboard/orders/${order.id}`}
                                    className="bg-blue-50 text-blue-600 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2"
                                >
                                    {t('details')} <ArrowRight size={14} />
                                </Link>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div >
    );
}
