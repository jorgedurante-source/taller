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
    const [activeTab, setActiveTab] = useState('today');
    const [search, setSearch] = useState('');

    const fetchReminders = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/reports/reminders?tab=${activeTab}`);
            setReminders(res.data);
        } catch (err) {
            console.error('Error fetching reminders', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReminders();
    }, [activeTab]);

    const handleUpdateStatus = async (orderId: number, status: string) => {
        try {
            await api.put(`/orders/${orderId}/reminder-status`, { status });
            fetchReminders();
        } catch (err) {
            alert('Error al actualizar recordatorio');
        }
    };

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

    const tabs = [
        { id: 'today', label: 'Hoy', icon: <Bell size={14} />, color: 'blue' },
        { id: 'upcoming', label: 'Próximos', icon: <Calendar size={14} />, color: 'amber' },
        { id: 'skipped', label: 'Salteados', icon: <Clock size={14} />, color: 'slate' },
        { id: 'sent', label: 'Enviados', icon: <CheckCircle2 size={14} />, color: 'emerald' },
    ];

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-3">
                        <Bell className="text-blue-600" /> Seguimientos
                    </h2>
                    <p className="text-slate-500 font-bold tracking-wider uppercase text-xs mt-1">
                        Gestión de recordatorios post-entrega
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
                </div>
            </header>

            {/* Tabs Navigation */}
            <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id
                            ? `bg-slate-900 text-white shadow-lg shadow-slate-200`
                            : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{activeTab === 'sent' ? 'Enviado el' : 'Recordatorio'}</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehículo</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Km</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trabajos prev.</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Actualizando lista...</p>
                                    </td>
                                </tr>
                            ) : filteredReminders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <AlertCircle className="mx-auto text-slate-200 mb-4" size={40} />
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay recordatorios en esta sección</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredReminders.map((r) => (
                                    <tr
                                        key={r.order_id}
                                        className={`group hover:bg-slate-50/80 transition-colors ${isToday(r.reminder_at) && activeTab === 'today' ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <td className="px-6 py-6 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${isToday(r.reminder_at) ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'}`} />
                                                <span className={`font-black italic text-sm ${isToday(r.reminder_at) ? 'text-blue-600' : 'text-slate-900'}`}>
                                                    {activeTab === 'sent' ? formatDate(r.reminder_sent_at) : formatDate(r.reminder_at)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 font-black text-slate-900 uppercase text-xs">
                                            {r.client_name}
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-700 uppercase italic text-xs leading-tight">{r.brand} {r.model}</span>
                                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{r.plate}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right font-mono text-xs font-black text-slate-500">
                                            {Number(r.vehicle_km || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-6 max-w-sm">
                                            <p className="text-[11px] font-bold text-slate-500 truncate leading-relaxed" title={r.services_done}>
                                                {r.services_done || '---'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {activeTab === 'today' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(r.order_id, 'skipped')}
                                                        className="px-4 py-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                                                        title="Saltear recordatorio de hoy"
                                                    >
                                                        Saltear
                                                    </button>
                                                )}
                                                {activeTab === 'skipped' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(r.order_id, 'pending')}
                                                        className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                                                        title="Restaurar recordatorio"
                                                    >
                                                        Restaurar
                                                    </button>
                                                )}
                                                <a
                                                    href={`https://wa.me/${r.client_phone.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                                                >
                                                    <MessageSquare size={18} />
                                                </a>
                                                <Link
                                                    href={`/${slug}/dashboard/orders/${r.order_id}`}
                                                    className="p-2 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                                                >
                                                    <ExternalLink size={18} />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Automation Strategy Info */}
            <div className="bg-slate-900 rounded-[32px] p-10 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute right-0 top-0 opacity-5 -translate-y-1/4 translate-x-1/4">
                    <Bell size={240} />
                </div>
                <div className="max-w-3xl space-y-6 relative z-10">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                        <Clock className="text-blue-400" /> Robot de Seguimiento MechHub
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <div className="space-y-2">
                            <span className="text-blue-400 font-black text-[10px] uppercase tracking-widest block">¿Cómo funciona?</span>
                            <p className="text-xs text-slate-400 font-bold leading-relaxed">
                                El sistema revisa cada mañana la lista de <span className="text-white">Hoy</span>.
                                Si el servicio está activo en Configuración, enviará el email automáticamente utilizando la plantilla de seguimiento.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <span className="text-amber-400 font-black text-[10px] uppercase tracking-widest block">Control Total</span>
                            <p className="text-xs text-slate-400 font-bold leading-relaxed">
                                Podés saltear recordatorios si el cliente ya vino o restaurarlos si querés que el robot los procese mañana. No se envían mensajes en Domingo.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
