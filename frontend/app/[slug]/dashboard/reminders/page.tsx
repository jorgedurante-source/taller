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
    Gauge,
    Edit,
    Send,
    RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useNotification } from '@/lib/notification';
import { useAuth } from '@/lib/auth';

export default function RemindersPage() {
    const { slug } = useSlug();
    const { hasPermission } = useAuth();
    const [reminders, setReminders] = useState<any[]>([]);
    const { notify } = useNotification();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('today');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [sendingBulk, setSendingBulk] = useState(false);
    const [editingDateId, setEditingDateId] = useState<number | null>(null);
    const [newDate, setNewDate] = useState('');

    if (!hasPermission('reminders')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
                <Bell size={48} className="mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-xs">Módulo no habilitado</p>
                <p className="text-[10px] mt-2 italic">Contacta al administrador para activar esta funcionalidad</p>
            </div>
        );
    }

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
        setSelectedIds([]);
    }, [activeTab]);

    const handleUpdateStatus = async (orderId: number, status: string) => {
        try {
            await api.put(`/orders/${orderId}/reminder-status`, { status });
            fetchReminders();
            notify('success', 'Recordatorio actualizado');
        } catch (err) {
            notify('error', 'Error al actualizar recordatorio');
        }
    };

    const handleUpdateDate = async (orderId: number) => {
        if (!newDate) return;
        try {
            await api.patch(`/reports/reminders/${orderId}/date`, { date: newDate });
            setEditingDateId(null);
            fetchReminders();
            notify('success', 'Fecha actualizada');
        } catch (err) {
            notify('error', 'Error al actualizar fecha');
        }
    };

    const handleBulkSend = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`¿Desea enviar ${selectedIds.length} recordatorios ahora?`)) return;

        setSendingBulk(true);
        try {
            const res = await api.post('/reports/reminders/send-bulk', { orderIds: selectedIds });
            notify('success', res.data.message);
            setSelectedIds([]);
            fetchReminders();
        } catch (err) {
            notify('error', 'Error al enviar recordatorios bulk');
        } finally {
            setSendingBulk(false);
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredReminders.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredReminders.map(r => r.order_id));
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';

        let date;
        if (dateStr.includes(' ') || dateStr.includes('T')) {
            // It's a full datetime, replace space with T if needed for better browser compatibility
            date = new Date(dateStr.replace(' ', 'T'));
        } else {
            // It's just a date YYYY-MM-DD, force local time
            date = new Date(`${dateStr}T00:00:00`);
        }

        if (isNaN(date.getTime())) return 'Fecha inválida';

        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const isToday = (dateStr: string) => {
        if (!dateStr) return false;
        const today = new Date();
        const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
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

            {/* Tabs & Bulk Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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

                {selectedIds.length > 0 && (
                    <div className="flex items-center gap-3 bg-blue-600 text-white px-6 py-3 rounded-[2rem] shadow-xl animate-in slide-in-from-right duration-300">
                        <span className="text-[10px] font-black uppercase tracking-widest">{selectedIds.length} seleccionados</span>
                        <div className="w-[1px] h-4 bg-white/20" />
                        <button
                            onClick={handleBulkSend}
                            disabled={sendingBulk}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-blue-100 transition-colors disabled:opacity-50"
                        >
                            {sendingBulk ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                            Enviar Ahora
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-5 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={selectedIds.length === filteredReminders.length && filteredReminders.length > 0}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
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
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Actualizando lista...</p>
                                    </td>
                                </tr>
                            ) : filteredReminders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <AlertCircle className="mx-auto text-slate-200 mb-4" size={40} />
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay recordatorios en esta sección</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredReminders.map((r) => (
                                    <tr
                                        key={r.order_id}
                                        className={`group hover:bg-slate-50/80 transition-colors ${selectedIds.includes(r.order_id) ? 'bg-blue-50/50' : ''} ${isToday(r.reminder_at) && activeTab === 'today' ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <td className="px-6 py-6">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                checked={selectedIds.includes(r.order_id)}
                                                onChange={() => toggleSelect(r.order_id)}
                                            />
                                        </td>
                                        <td className="px-6 py-6 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${isToday(r.reminder_at) ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'}`} />
                                                {editingDateId === r.order_id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="date"
                                                            className="text-xs bg-white border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                                                            value={newDate}
                                                            onChange={(e) => setNewDate(e.target.value)}
                                                        />
                                                        <button onClick={() => handleUpdateDate(r.order_id)} className="text-emerald-500 hover:text-emerald-700">
                                                            <CheckCircle2 size={16} />
                                                        </button>
                                                        <button onClick={() => setEditingDateId(null)} className="text-slate-400 hover:text-slate-600">
                                                            <AlertCircle size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 group/date">
                                                        <span className={`font-black italic text-sm ${isToday(r.reminder_at) ? 'text-blue-600' : 'text-slate-900'}`}>
                                                            {activeTab === 'sent' ? formatDate(r.reminder_sent_at) : formatDate(r.reminder_at)}
                                                        </span>
                                                        {(activeTab === 'today' || activeTab === 'upcoming') && (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingDateId(r.order_id);
                                                                    const d = new Date();
                                                                    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                                                    setNewDate(localDate);
                                                                }}
                                                                className="opacity-0 group-hover/date:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-all"
                                                            >
                                                                <Edit size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
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
