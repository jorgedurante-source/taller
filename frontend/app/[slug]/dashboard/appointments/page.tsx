'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useSlug } from '@/lib/slug';
import api from '@/lib/api';
import { useNotification } from '@/lib/notification';
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, X } from 'lucide-react';
import Link from 'next/link';

export default function AppointmentsPage() {
    const { slug } = useSlug();
    const { hasPermission } = useAuth();
    const router = useRouter();
    const { notify } = useNotification();

    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<any[]>([]);

    // Calendar state
    const [currentDate, setCurrentDate] = useState(new Date());

    // Modal state
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('09:00');
    const [saving, setSaving] = useState(false);

    const fetchOrders = async () => {
        try {
            const res = await api.get('/orders');
            setOrders(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!hasPermission('appointments')) {
            router.push(`/${slug}/dashboard`);
            return;
        }
        fetchOrders();
    }, [slug, hasPermission, router]);

    const handleAssignAppointment = async () => {
        if (!selectedOrderId || !selectedDate || !appointmentTime) {
            notify('info', 'Por favor, completá todos los campos.');
            return;
        }

        setSaving(true);
        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const finalAppointmentDate = `${dateStr}T${appointmentTime}:00`;

            await api.put(`/orders/${selectedOrderId}/status`, {
                status: 'En proceso',
                notes: 'Turno asignado',
                appointment_date: finalAppointmentDate
            });

            notify('success', 'Turno asignado correctamente');
            fetchOrders();
            setSelectedDate(null);
            setSelectedOrderId('');
        } catch (err) {
            console.error(err);
            notify('error', 'Error al asignar el turno');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 font-bold text-slate-400">Cargando turnos...</div>;

    // derived data
    const appointments = orders.filter(o => o.appointment_date);
    const unassignedOrders = orders.filter(o => !o.appointment_date && (o.status === 'Pendiente' || o.status === 'En proceso'));

    // Calendar functions
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDayOfWeek = startOfMonth.getDay(); // Sunday is 0
    const daysInMonth = endOfMonth.getDate();

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const renderCalendarGrid = () => {
        const grid = [];
        // Empty slots for start of month
        for (let i = 0; i < startDayOfWeek; i++) {
            grid.push(<div key={`empty-${i}`} className="min-h-[120px] p-2 bg-slate-50/30 rounded-2xl border border-transparent"></div>);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
            const dateStr = cellDate.toISOString().split('T')[0];
            const dayAppointments = appointments.filter(a => a.appointment_date.startsWith(dateStr))
                .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));

            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            grid.push(
                <div
                    key={d}
                    className={`min-h-[120px] p-3 rounded-2xl border border-slate-200 transition-all cursor-pointer hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/10 ${isToday ? 'bg-indigo-50 border-indigo-200' : 'bg-white'}`}
                    onClick={() => setSelectedDate(cellDate)}
                >
                    <div className="flex justify-between items-start mb-2">
                        <span className={`text-sm font-black ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{d}</span>
                        {dayAppointments.length > 0 && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                                {dayAppointments.length}
                            </span>
                        )}
                    </div>

                    <div className="space-y-1">
                        {dayAppointments.map(app => {
                            const timeStr = app.appointment_date.split('T')[1].substring(0, 5);
                            return (
                                <div
                                    key={app.id}
                                    className="text-[10px] w-full text-left truncate bg-indigo-600 text-white px-2 py-1.5 rounded-lg shadow-sm font-bold flex items-center justify-between group"
                                    title={`${timeStr} - ${app.client_name} - ${app.model}`}
                                >
                                    <span className="truncate">{app.client_name}</span>
                                    <span className="shrink-0 opacity-80 pl-1">{timeStr}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return grid;
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-3">
                        <Calendar className="text-indigo-600" size={32} /> Calendario de Turnos
                    </h2>
                    <p className="text-slate-500 font-bold mt-1 tracking-wider uppercase text-xs">Asignación y seguimiento</p>
                </div>
                <Link href={`/${slug}/dashboard/orders/create`}>
                    <button className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-900/20">
                        <Plus size={16} /> Nueva Orden
                    </button>
                </Link>
            </header>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                {/* Header Month Navigation */}
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tighter capitalize ml-2">
                        {currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={prevMonth} className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                        <button onClick={nextMonth} className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-4 mb-4">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                        <div key={day} className="text-center text-[10px] font-black tracking-widest uppercase text-slate-400">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-4">
                    {renderCalendarGrid()}
                </div>
            </div>

            {/* Modal de Turno */}
            {selectedDate && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">
                                    {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Gestión de Turnos</p>
                            </div>
                            <button onClick={() => setSelectedDate(null)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Turnos Existentes */}
                        <div className="mb-8 space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Turnos Confirmados</h4>
                            {appointments.filter(a => a.appointment_date.startsWith(selectedDate.toISOString().split('T')[0])).length > 0 ? (
                                <div className="space-y-2">
                                    {appointments.filter(a => a.appointment_date.startsWith(selectedDate.toISOString().split('T')[0]))
                                        .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))
                                        .map(app => (
                                            <div key={app.id} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                <div className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-black flex items-center gap-1.5 shrink-0">
                                                    <Clock size={14} />
                                                    {app.appointment_date.split('T')[1].substring(0, 5)}
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{app.client_name}</p>
                                                    <p className="text-xs text-slate-500 font-medium truncate">{app.plate} • {app.brand} {app.model}</p>
                                                </div>
                                                <Link href={`/${slug}/dashboard/orders/${app.id}`}>
                                                    <button className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-white border-2 border-indigo-600 hover:bg-indigo-600 px-3 py-1.5 rounded-xl transition-all h-fit">
                                                        Ver
                                                    </button>
                                                </Link>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                                    <p className="text-slate-400 text-sm font-bold">No hay turnos agendados para este día.</p>
                                </div>
                            )}
                        </div>

                        {/* Asignar Nuevo Turno */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 ml-1">Asignar Orden a este día</h4>
                            {unassignedOrders.length > 0 ? (
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none"
                                            value={selectedOrderId}
                                            onChange={e => setSelectedOrderId(e.target.value)}
                                        >
                                            <option value="">-- Seleccionar Orden --</option>
                                            {unassignedOrders.map(o => (
                                                <option key={o.id} value={o.id}>
                                                    #{o.id} - {o.client_name} ({o.model})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-1">
                                        <input
                                            type="time"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none"
                                            value={appointmentTime}
                                            onChange={e => setAppointmentTime(e.target.value)}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-500 font-bold bg-amber-50 p-4 rounded-2xl border border-amber-200">
                                    No hay órdenes pendientes para asignar.
                                </div>
                            )}
                        </div>

                        <div className="mt-8">
                            <button
                                onClick={handleAssignAppointment}
                                disabled={saving || !selectedOrderId || !appointmentTime}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                            >
                                {saving ? 'Guardando...' : 'Confirmar Turno'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
