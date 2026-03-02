'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
    MessageSquare,
    Send,
    Package,
    ArrowRight,
    Clock,
    CheckCircle2,
    XCircle,
    User,
    Building2,
    RefreshCw,
    Truck
} from 'lucide-react';
import { useNotification } from '@/lib/notification';
import { useAuth } from '@/lib/auth';

export default function ChainPage() {
    const [messages, setMessages] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [messageText, setMessageText] = useState('');
    const [view, setView] = useState<'messages' | 'requests'>('messages');
    const [workshops, setWorkshops] = useState<any[]>([]);
    const [messageTarget, setMessageTarget] = useState<string>(''); // empty = all
    const [unreadCounts, setUnreadCounts] = useState<{ direct: any[], global: number }>({ direct: [], global: 0 });
    const { notify } = useNotification();
    const { user } = useAuth();

    const fetchData = async () => {
        try {
            const [msgRes, reqRes, workshopRes, unreadRes] = await Promise.all([
                api.get('/chain-internal/messages', { params: { other_slug: messageTarget || undefined } }),
                api.get('/chain-internal/requests', { params: { type: 'incoming' } }),
                api.get('/orders/chain-workshops'),
                api.get('/chain-internal/unread-counts')
            ]);
            setMessages(msgRes.data);
            setRequests(reqRes.data);
            setWorkshops(workshopRes.data);
            setUnreadCounts(unreadRes.data);

            // Mark as read based on current selection
            if (view === 'messages') {
                await api.post('/chain-internal/read', { from_slug: messageTarget || null });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [messageTarget]);

    const handleSendMessage = async (e: any) => {
        e.preventDefault();
        if (!messageText.trim()) return;
        try {
            await api.post('/chain-internal/messages', {
                message: messageText,
                to_slug: messageTarget || null
            });
            setMessageText('');
            fetchData();
        } catch (err) {
            notify('error', 'Error al enviar mensaje');
        }
    };

    const handleRespondRequest = async (id: number, status: 'approved' | 'rejected') => {
        try {
            await api.put(`/chain-internal/requests/${id}/respond`, { status });
            notify('success', `Pedido ${status === 'approved' ? 'aprobado' : 'rechazado'}`);
            fetchData();
        } catch (err) {
            notify('error', 'Error al procesar pedido');
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            <header className="flex flex-wrap items-center justify-between gap-6 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="bg-indigo-600 text-white p-4 rounded-3xl shadow-xl shadow-indigo-200">
                        <Building2 size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">Red de Talleres</h2>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Comunicación e Intercambio Interno</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                    <button
                        onClick={() => setView('messages')}
                        className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all relative ${view === 'messages' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500'}`}
                    >
                        Mensajes
                        {(unreadCounts.global > 0 || unreadCounts.direct.length > 0) && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-100 animate-pulse"></span>
                        )}
                    </button>
                    <button
                        onClick={() => setView('requests')}
                        className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${view === 'requests' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500'}`}
                    >
                        Pedidos de Stock
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {view === 'messages' ? (
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[600px]">
                        <div className="flex-grow overflow-y-auto p-8 space-y-6">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                                    <MessageSquare size={48} className="opacity-20" />
                                    <p className="italic font-bold">No hay mensajes en este chat</p>
                                </div>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.from_slug === (window.location.pathname.split('/')[1]) ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-md p-5 rounded-3xl shadow-sm border ${msg.from_slug === (window.location.pathname.split('/')[1]) ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-50 text-slate-900 border-slate-100'}`}>
                                            <div className="flex items-center gap-2 mb-2 opacity-80">
                                                <Building2 size={12} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{msg.from_slug}</span>
                                                <span className="w-1 h-1 bg-current opacity-30 rounded-full"></span>
                                                <User size={12} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{msg.from_user_name}</span>
                                            </div>
                                            <p className="text-sm font-bold leading-relaxed">{msg.message}</p>
                                            <div className="mt-3 flex items-center justify-end gap-1 opacity-50">
                                                <Clock size={10} />
                                                <span className="text-[9px] font-bold">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <form onSubmit={handleSendMessage} className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-4">
                            <div className="flex gap-4">
                                <select
                                    className="px-4 py-4 rounded-2xl border border-slate-200 outline-none focus:border-indigo-500 font-bold text-xs uppercase tracking-widest text-slate-500 bg-white shadow-sm appearance-none min-w-[220px]"
                                    value={messageTarget}
                                    onChange={(e) => setMessageTarget(e.target.value)}
                                >
                                    <option value="">🌎 Toda la Red {unreadCounts.global > 0 ? `(${unreadCounts.global})` : ''}</option>
                                    {workshops.map(w => {
                                        const unread = unreadCounts.direct.find(u => u.from_slug === w.slug)?.count;
                                        return (
                                            <option key={w.slug} value={w.slug}>
                                                🏢 {w.name} {unread ? `(${unread})` : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                                <input
                                    className="flex-grow px-6 py-4 rounded-2xl border border-slate-200 outline-none focus:border-indigo-500 font-bold text-slate-900 bg-white shadow-inner"
                                    placeholder={messageTarget ? "Escribí un mensaje directo..." : "Escribí un mensaje para toda la red..."}
                                    value={messageText}
                                    onChange={e => setMessageText(e.target.value)}
                                />
                                <button type="submit" className="bg-indigo-600 text-white p-4 rounded-2xl shadow-xl shadow-indigo-200 hover:scale-105 active:scale-95 transition-all">
                                    <Send size={24} />
                                </button>
                            </div>
                            {messageTarget && (
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-4 animate-in fade-in slide-in-from-left-2">
                                    Enviando mensaje directo a: {workshops.find(w => w.slug === messageTarget)?.name}
                                </p>
                            )}
                        </form>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {requests.length === 0 ? (
                            <div className="bg-white p-20 rounded-[40px] text-center text-slate-400 italic font-bold">No hay pedidos entrantes</div>
                        ) : (
                            requests.map(req => (
                                <div key={req.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-8 group hover:border-indigo-200 transition-all">
                                    <div className="flex items-center gap-6">
                                        <div className={`p-5 rounded-3xl ${req.status === 'pending' ? 'bg-amber-100 text-amber-600' : req.status === 'approved' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                            <Package size={32} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">Pedido de {req.requesting_name}</span>
                                                <span className="text-slate-300">/</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(req.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <h4 className="text-xl font-black text-slate-900 uppercase italic">
                                                {req.item_name} <span className="text-indigo-600 not-italic ml-2">(x{req.quantity})</span>
                                            </h4>
                                            {req.notes && <p className="text-slate-500 text-sm mt-1 font-medium italic">"{req.notes}"</p>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {req.status === 'pending' ? (
                                            <>
                                                <button
                                                    onClick={() => handleRespondRequest(req.id, 'rejected')}
                                                    className="px-6 py-3 bg-slate-50 text-slate-400 hover:text-red-500 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                                                >
                                                    Rechazar
                                                </button>
                                                <button
                                                    onClick={() => handleRespondRequest(req.id, 'approved')}
                                                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all flex items-center gap-2"
                                                >
                                                    <CheckCircle2 size={16} /> Aprobar y Preparar
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                                                {req.status === 'approved' ? (
                                                    <><CheckCircle2 className="text-indigo-500" size={18} /> <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Aprobado</span></>
                                                ) : req.status === 'delivered' ? (
                                                    <><Truck className="text-emerald-500" size={18} /> <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Entregado</span></>
                                                ) : (
                                                    <><XCircle className="text-slate-400" size={18} /> <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Rechazado</span></>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
