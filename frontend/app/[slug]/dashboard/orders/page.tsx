'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
    ClipboardList,
    Calendar,
    RefreshCw,
    Download,
    Search,
    Building2,
    Tag,
    X,
    Filter,
    Plus,
    MessageSquare,
    List,
    LayoutGrid,
    Car,
    Clock,
    ArrowRight,
    CircleSlash,
    CircleDollarSign,
    ChevronLeft,
    ChevronRight,
    CheckCircle2
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
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
    const [collapsedColumns, setCollapsedColumns] = useState<string[]>([]);
    const [ordersPage, setOrdersPage] = useState(1);
    const [ordersPagination, setOrdersPagination] = useState<any>(null);

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
            setLoading(true);
            try {
                // Determine search status vs plain text search
                let filterStatus = 'active'; // Default
                if (showAll) filterStatus = 'history';

                // If search input matches exactly one status alias, we fetch JUST that status
                const matchedStatuses = resolveStatusAliases(search);
                let finalSearch = search;
                let activeStatus = filterStatus;

                if (matchedStatuses.length === 1) {
                    activeStatus = matchedStatuses[0];
                    finalSearch = ''; // If we filter by status, we clear text search unless we want both?
                }

                const queryParams = new URLSearchParams();
                queryParams.set('page', ordersPage.toString());
                queryParams.set('limit', '50');
                queryParams.set('status', activeStatus);
                if (finalSearch) queryParams.set('search', finalSearch);
                if (onlyUnread) queryParams.set('unread_only', 'true');

                const response = await api.get(`/orders?${queryParams.toString()}`);
                setOrders(response.data.data);
                setOrdersPagination(response.data.pagination);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [ordersPage, search, showAll, onlyUnread, slug]);

    useEffect(() => {
        setOrdersPage(1);
    }, [search, showAll, onlyUnread]);

    const STATUS_SEARCH_ALIASES: Record<string, string[]> = {
        appointment: ['turno', 'turno asignado', 'appointment'],
        pending: ['pendiente', 'pending'],
        quoted: ['presupuestado', 'quoted'],
        approved: ['aprobado', 'approved'],
        in_progress: ['en proceso', 'in progress', 'in_progress'],
        in_repair: ['en reparación', 'en reparacion', 'reparación', 'reparacion', 'in repair', 'in_repair'],
        waiting_parts: ['esperando repuestos', 'repuestos', 'waiting parts', 'waiting_parts'],
        ready: ['listo', 'listo para retiro', 'listo para entrega', 'ready'],
        delivered: ['entregado', 'delivered'],
        cancelled: ['cancelado', 'cancelled'],
    };

    // Given a search query, returns the English status keys that match
    const resolveStatusAliases = (query: string): string[] => {
        const q = query.toLowerCase().trim();
        const matched: string[] = [];
        for (const [statusKey, aliases] of Object.entries(STATUS_SEARCH_ALIASES)) {
            if (aliases.some(alias => alias.includes(q) || q.includes(alias))) {
                matched.push(statusKey);
            }
        }
        return matched;
    };

    const filteredOrders = orders; // Now filtered by backend


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
            case 'cancelled': return 'bg-red-100 text-red-600';
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

                <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        title={t('list_view')}
                    >
                        <List size={20} />
                    </button>
                    <button
                        onClick={() => setViewMode('kanban')}
                        className={`p-2.5 rounded-xl transition-all ${viewMode === 'kanban' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        title={t('kanban_view')}
                    >
                        <LayoutGrid size={20} />
                    </button>
                </div>
            </div>

            {loading ? (
                <p className="p-10 text-center text-slate-400 font-bold">{t('loading_orders')}</p>
            ) : filteredOrders.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                    <ClipboardList size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">{t('no_orders')}</p>
                </div>
            ) : viewMode === 'list' ? (
                <div className="grid grid-cols-1 gap-4">
                    {filteredOrders.map(order => (
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
                    ))}
                </div>
            ) : (
                <div className="flex gap-6 overflow-x-auto pb-8 min-h-[600px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent items-start">
                    {(showAll
                        ? ['cancelled', 'delivered']
                        : ['appointment', 'pending', 'quoted', 'approved', 'in_progress', 'waiting_parts', 'ready']
                    ).map(status => {
                        const isCollapsed = collapsedColumns.includes(status);
                        const statusOrders = filteredOrders.filter(o => o.status === status || (status === 'in_progress' && o.status === 'in_repair'));

                        return (
                            <div key={status} className={`flex-shrink-0 transition-all duration-300 flex flex-col gap-4 ${isCollapsed ? 'w-16' : 'w-80'}`}>
                                <div className={`flex items-center justify-between px-2 ${isCollapsed ? 'flex-col gap-4 py-4 min-h-[400px]' : ''}`}>
                                    <div
                                        className={`flex items-center gap-2 cursor-pointer hover:opacity-70 transition-all ${isCollapsed ? 'rotate-90 origin-center whitespace-nowrap' : ''}`}
                                        onClick={() => {
                                            if (isCollapsed) setCollapsedColumns(collapsedColumns.filter(c => c !== status));
                                            else setCollapsedColumns([...collapsedColumns, status]);
                                        }}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${getStatusColor(status).split(' ')[0]}`}></span>
                                        <h3 className="font-black text-slate-900 uppercase tracking-widest text-[11px]">{t(status)}</h3>
                                    </div>
                                    {!isCollapsed && (
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg text-[10px] font-black">
                                                {statusOrders.length}
                                            </span>
                                            <button
                                                onClick={() => setCollapsedColumns([...collapsedColumns, status])}
                                                className="text-slate-300 hover:text-slate-600 transition-all"
                                            >
                                                <ChevronLeft size={14} />
                                            </button>
                                        </div>
                                    )}
                                    {isCollapsed && (
                                        <button
                                            onClick={() => setCollapsedColumns(collapsedColumns.filter(c => c !== status))}
                                            className="text-slate-300 hover:text-slate-600 p-2 bg-slate-100 rounded-full"
                                        >
                                            <ChevronRight size={14} />
                                        </button>
                                    )}
                                </div>

                                {!isCollapsed && (
                                    <div className="flex-1 space-y-4 bg-slate-50/50 p-3 rounded-[32px] border border-slate-100 min-h-[500px]">
                                        {statusOrders.map(order => (
                                            <div key={order.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative">
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">#{order.id}</span>
                                                        {order.unread_messages > 0 && (
                                                            <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[8px] font-black">
                                                                {order.unread_messages}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black text-slate-900 uppercase italic tracking-tighter text-sm leading-tight text-blue-600 group-hover:underline cursor-pointer">
                                                            <Link href={`/${slug}/dashboard/orders/${order.id}`}>
                                                                {order.client_name}
                                                            </Link>
                                                        </h4>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">{order.brand} {order.model}</p>
                                                        <p className="text-[10px] font-black text-slate-900 mt-0.5 font-mono tracking-widest">{order.plate}</p>
                                                    </div>

                                                    <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                                                        <div className="flex items-center gap-1.5 text-slate-400">
                                                            <Clock size={12} />
                                                            <span className="text-[9px] font-bold">{new Date(order.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                        {canSeeIncome && order.order_total > 0 && (
                                                            <p className="font-black text-slate-900 text-xs">${Number(order.order_total).toLocaleString()}</p>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {getPaymentBadge(order)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {statusOrders.length === 0 && (
                                            <div className="h-20 flex items-center justify-center border border-dashed border-slate-200 rounded-2xl opacity-40">
                                                <p className="text-[10px] font-bold uppercase text-slate-400">{t('empty')}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {ordersPagination && ordersPagination.total_pages > 1 && (
                <div className="flex items-center justify-between pt-8 border-t border-slate-50">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {ordersPagination.total} {t('orders')} · {t('page')} {ordersPagination.page} {t('of')} {ordersPagination.total_pages}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                            disabled={!ordersPagination.has_prev}
                            className="px-4 py-2 rounded-xl bg-white border border-slate-100 font-black text-xs text-slate-600 disabled:opacity-30 hover:border-indigo-300 transition-all shadow-sm flex items-center gap-2 uppercase tracking-tight"
                        >
                            <ChevronLeft size={16} /> {t('back')}
                        </button>
                        <div className="h-4 w-px bg-slate-100 mx-2"></div>
                        <button
                            onClick={() => setOrdersPage(p => Math.min(ordersPagination.total_pages, p + 1))}
                            disabled={!ordersPagination.has_next}
                            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-900 font-black text-xs text-white disabled:opacity-30 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-2 uppercase tracking-tight"
                        >
                            {t('next')} <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div >
    );
}
