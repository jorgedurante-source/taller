'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useSlug } from '@/lib/slug';
import {
    Bell,
    Calendar,
    User,
    Car,
    Phone,
    ExternalLink,
    Clock,
    CheckCircle2,
    MessageSquare,
    Search,
    History,
    AlertCircle,
    Gauge
} from 'lucide-react';
import Link from 'next/link';

export default function RemindersPage() {
    const { slug } = useSlug();
    const [reminders, setReminders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [search, setSearch] = useState('');

    const fetchReminders = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/reports/reminders?history=${showHistory}`);
            setReminders(res.data);
        } catch (err) {
            console.error('Error fetching reminders', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReminders();
    }, [showHistory]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const isToday = (dateStr: string) => {
        const today = new Date();
        const date = new Date(dateStr);
        return today.toDateString() === date.toDateString();
    };

    const filteredReminders = reminders.filter(r =>
        r.client_name.toLowerCase().includes(search.toLowerCase()) ||
        r.plate.toLowerCase().includes(search.toLowerCase()) ||
        r.model.toLowerCase().includes(search.toLowerCase())
    );

    if (loading && reminders.length === 0) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-20 gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Cargando recordatorios...</p>
        </div>
    );

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-3">
                        <Bell className="text-blue-600" /> Recordatorios
                    </h2>
                    <p className="text-slate-500 font-bold tracking-wider uppercase text-xs mt-1">
                        {showHistory ? 'Historial de seguimientos pasados' : 'Gestión de seguimientos pendientes'}
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-grow md:w-64">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <Search size={16} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar cliente o patente..."
                            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${showHistory
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <History size={14} />
                        {showHistory ? 'Viendo Pasados' : 'Ver Pasados'}
                    </button>
                </div>
            </header>

            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehículo</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Km</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trabajos realizados</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredReminders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <AlertCircle className="mx-auto text-slate-200 mb-4" size={40} />
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay recordatorios que coincidan</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredReminders.map((r) => (
                                    <tr
                                        key={r.order_id}
                                        className={`group hover:bg-slate-50/80 transition-colors ${isToday(r.reminder_at) && !showHistory ? 'bg-blue-50/30' : ''
                                            }`}
                                    >
                                        <td className="px-6 py-6 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${isToday(r.reminder_at) ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'
                                                    }`} />
                                                <span className={`font-black italic text-sm ${isToday(r.reminder_at) ? 'text-blue-600' : 'text-slate-900'
                                                    }`}>
                                                    {formatDate(r.reminder_at)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900 uppercase text-xs">{r.client_name}</span>
                                                <span className="text-[10px] font-bold text-slate-400 tracking-tight flex items-center gap-1">
                                                    <Phone size={10} /> {r.client_phone}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-700 uppercase italic text-xs leading-tight">
                                                    {r.brand} {r.model}
                                                </span>
                                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                                                    {r.plate}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span className="font-mono text-xs font-black text-slate-600">
                                                    {Number(r.vehicle_km || 0).toLocaleString()}
                                                </span>
                                                <Gauge size={12} className="text-slate-300" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 max-w-sm">
                                            <p className="text-[11px] font-bold text-slate-500 truncate leading-relaxed" title={r.services_done}>
                                                {r.services_done || '---'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <a
                                                    href={`https://wa.me/${r.client_phone.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    title="WhatsApp de seguimiento"
                                                >
                                                    <MessageSquare size={18} />
                                                </a>
                                                <Link
                                                    href={`/${slug}/dashboard/orders/${r.order_id}`}
                                                    className="p-2 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                                                    title="Ver Orden"
                                                >
                                                    <ExternalLink size={18} />
                                                </Link>
                                                {!showHistory && (
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('¿Marcar seguimiento como realizado?')) {
                                                                try {
                                                                    await api.put(`/orders/${r.order_id}/status`, {
                                                                        status: 'Entregado',
                                                                        notes: 'Seguimiento realizado (recordatorio completado)',
                                                                        reminder_days: null
                                                                    });
                                                                    fetchReminders();
                                                                } catch (err) {
                                                                    alert('Error al completar');
                                                                }
                                                            }
                                                        }}
                                                        className="ml-2 bg-slate-900 hover:bg-blue-600 text-white p-2 rounded-lg transition-all"
                                                        title="Finalizar Recordatorio"
                                                    >
                                                        <CheckCircle2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Ideas for "Sending together" Section */}
            <div className="bg-slate-900 rounded-[32px] p-10 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute right-0 top-0 opacity-5 -translate-y-1/4 translate-x-1/4">
                    <Bell size={240} />
                </div>
                <div className="max-w-3xl space-y-6 relative z-10">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">Plan de Automatización 💡</h3>
                    <p className="text-slate-400 font-bold leading-relaxed">
                        Para el envío de estos recordatorios, te propongo tres estrategias. ¿Qué opinas de cada una?
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-all cursor-pointer group">
                            <span className="text-blue-400 font-black text-[10px] uppercase tracking-widest mb-2 block">Opción 1</span>
                            <h4 className="font-black uppercase italic mb-2">Botón de WhatsApp Directo</h4>
                            <p className="text-xs text-slate-400 font-bold leading-relaxed">
                                Agregamos un botón que abra WhatsApp con una plantilla prediseñada (Ej: "Hola [Nombre], hace 3 meses hicimos [Servicio] en tu [Vehículo]...").
                            </p>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-all cursor-pointer group">
                            <span className="text-emerald-400 font-black text-[10px] uppercase tracking-widest mb-2 block">Opción 2</span>
                            <h4 className="font-black uppercase italic mb-2">Email Automático</h4>
                            <p className="text-xs text-slate-400 font-bold leading-relaxed">
                                El sistema revisa cada mañana y envía un email automático de seguimiento sin que tengas que hacer nada.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
