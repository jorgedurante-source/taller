'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useSlug } from '@/lib/slug';
import api from '@/lib/api';
import { useNotification } from '@/lib/notification';
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, X, ArrowRight, CalendarDays, Key } from 'lucide-react';
import Link from 'next/link';

export default function AppointmentsPage() {
    const { slug } = useSlug();
    const { hasPermission } = useAuth();
    const router = useRouter();
    const { notify } = useNotification();

    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<any[]>([]);
    const [config, setConfig] = useState<any>({});
    const [clients, setClients] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [mode, setMode] = useState<'existing' | 'new'>('existing');

    // New Order state
    const [newClientId, setNewClientId] = useState('');
    const [newVehicleId, setNewVehicleId] = useState('');
    const [newDescription, setNewDescription] = useState('');

    // Calendar state
    const [currentDate, setCurrentDate] = useState(new Date());

    // Modal state
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('09:00');
    const [saving, setSaving] = useState(false);

    // Mover Turno State
    const [movingOrder, setMovingOrder] = useState<any>(null);
    const [moveDate, setMoveDate] = useState<string>('');
    const [moveTime, setMoveTime] = useState<string>('09:00');

    // Search state
    const [clientSearch, setClientSearch] = useState('');

    const handleClientChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const cid = e.target.value;
        setNewClientId(cid);
        setNewVehicleId('');
        if (cid) {
            try {
                const res = await api.get(`/clients/${cid}/vehicles`);
                setVehicles(res.data || []);
            } catch (err) {
                console.error(err);
            }
        } else {
            setVehicles([]);
        }
    };

    const fetchOrders = async () => {
        try {
            const [ordersRes, configRes, clientsRes] = await Promise.all([
                api.get('/orders'),
                api.get('/config'),
                api.get('/clients')
            ]);
            setOrders(ordersRes.data || []);
            setConfig(configRes.data || {});
            setClients(clientsRes.data || []);
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
        if (!appointmentTime) {
            notify('info', 'Por favor, seleccioná un horario.');
            return;
        }

        setSaving(true);
        try {
            // Robust local date formatting YYYY-MM-DD
            const y = selectedDate!.getFullYear();
            const m = String(selectedDate!.getMonth() + 1).padStart(2, '0');
            const d = String(selectedDate!.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;
            const finalAppointmentDate = `${dateStr}T${appointmentTime}:00`;

            let orderIdToUpdate = selectedOrderId;

            if (mode === 'new') {
                if (!newClientId || !newVehicleId) {
                    notify('info', 'Seleccioná un cliente y un vehículo para el turn nuevo.');
                    setSaving(false);
                    return;
                }
                const res = await api.post('/orders', {
                    client_id: newClientId,
                    vehicle_id: newVehicleId,
                    description: newDescription,
                    items: []
                });
                orderIdToUpdate = res.data.id;
            }

            if (!orderIdToUpdate) {
                notify('info', 'Seleccioná una orden existente o cambiá al modo Nuevo.');
                setSaving(false);
                return;
            }

            await api.put(`/orders/${orderIdToUpdate}/status`, {
                status: 'Turno asignado',
                notes: 'Turno asignado desde calendario',
                appointment_date: finalAppointmentDate
            });

            notify('success', 'Turno asignado correctamente');
            fetchOrders();
            setSelectedDate(null);
            setSelectedOrderId('');
            setNewClientId('');
            setNewVehicleId('');
            setNewDescription('');
        } catch (err) {
            console.error(err);
            notify('error', 'Error al asignar el turno');
        } finally {
            setSaving(false);
        }
    };

    const handleMoveAppointment = async () => {
        if (!movingOrder || !moveDate || !moveTime) return;
        setSaving(true);
        try {
            const finalDate = `${moveDate}T${moveTime}:00`;
            await api.put(`/orders/${movingOrder.id}/status`, {
                status: movingOrder.status,
                notes: `Turno movido al ${moveDate.split('-').reverse().join('/')} desde el calendario`,
                appointment_date: finalDate
            });
            notify('success', 'Turno movido correctamente');
            setMovingOrder(null);
            fetchOrders();
        } catch (error) {
            notify('error', 'Error al mover turno');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 font-bold text-slate-400">Cargando turnos...</div>;

    // derived data
    const appointments = orders.filter(o => o.appointment_date);
    const unassignedOrders = orders.filter(o => !o.appointment_date && (o.status === 'Pendiente' || o.status === 'Turno asignado' || o.status === 'En proceso'));

    const getTimeSlots = (date: Date | null) => {
        if (!date || !config.business_hours) return [];
        let hoursObj: any = {};
        try {
            hoursObj = typeof config.business_hours === 'string' ? JSON.parse(config.business_hours) : config.business_hours;
        } catch (e) {
            return [];
        }

        const day = date.getDay();
        let rangeStr = '';
        if (day >= 1 && day <= 5) rangeStr = hoursObj.mon_fri;
        else if (day === 6) rangeStr = hoursObj.sat;
        else if (day === 0) rangeStr = hoursObj.sun;

        if (!rangeStr || rangeStr.toLowerCase() === 'cerrado') return [];

        const parts = rangeStr.split('-').map((s: string) => s.trim());
        if (parts.length !== 2) return [];

        const [startH, startM] = parts[0].split(':').map(Number);
        const [endH, endM] = parts[1].split(':').map(Number);
        if (isNaN(startH) || isNaN(endH)) return [];

        const slots = [];
        let curr = new Date(date);
        curr.setHours(startH, startM || 0, 0, 0);

        const end = new Date(date);
        end.setHours(endH, endM || 0, 0, 0);

        while (curr <= end) {
            const h = String(curr.getHours()).padStart(2, '0');
            const mi = String(curr.getMinutes()).padStart(2, '0');
            slots.push(`${h}:${mi}`);
            curr.setMinutes(curr.getMinutes() + 30);
        }
        return slots;
    };

    const timeSlots = getTimeSlots(selectedDate);

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
                    onClick={() => { setSelectedDate(cellDate); setAppointmentTime(''); }}
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
                                                <div className="flex flex-col gap-1 items-end shrink-0">
                                                    <Link href={`/${slug}/dashboard/orders/${app.id}`}>
                                                        <button className="text-[9px] w-full font-black uppercase tracking-widest text-indigo-600 hover:text-white border-2 border-indigo-600 hover:bg-indigo-600 px-3 py-1 rounded-lg transition-all">
                                                            Ver
                                                        </button>
                                                    </Link>
                                                    <button
                                                        onClick={() => {
                                                            setMovingOrder(app);
                                                            const parts = app.appointment_date.split('T');
                                                            setMoveDate(parts[0]);
                                                            setMoveTime(parts[1].substring(0, 5));
                                                        }}
                                                        className="text-[9px] w-full font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 border-2 border-slate-200 hover:border-slate-800 bg-white px-3 py-1 rounded-lg transition-all"
                                                    >
                                                        Mover
                                                    </button>
                                                </div>
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

                            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit gap-1 border border-slate-200">
                                <button
                                    onClick={() => setMode('existing')}
                                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'existing' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Orden Existente
                                </button>
                                <button
                                    onClick={() => setMode('new')}
                                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'new' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Nuevo Turno
                                </button>
                            </div>

                            {mode === 'existing' ? (
                                unassignedOrders.length > 0 ? (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            placeholder="🔍 Buscar por Nº orden, cliente o vehículo..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            value={clientSearch}
                                            onChange={(e) => setClientSearch(e.target.value)}
                                        />
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none"
                                            value={selectedOrderId}
                                            onChange={e => setSelectedOrderId(e.target.value)}
                                        >
                                            <option value="">-- Seleccionar Orden --</option>
                                            {unassignedOrders
                                                .filter(o =>
                                                    !clientSearch ||
                                                    o.id.toString().includes(clientSearch) ||
                                                    o.client_name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
                                                    o.model?.toLowerCase().includes(clientSearch.toLowerCase()) ||
                                                    o.plate?.toLowerCase().includes(clientSearch.toLowerCase())
                                                )
                                                .map(o => (
                                                    <option key={o.id} value={o.id}>
                                                        #{o.id} - {o.client_name} ({o.model})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                        {selectedOrderId && (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Problema reportado:</p>
                                                <p className="text-xs font-medium text-slate-700 italic">
                                                    {unassignedOrders.find(o => o.id.toString() === selectedOrderId)?.description || 'Sin descripción detallada.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-500 font-bold bg-amber-50 p-4 rounded-2xl border border-amber-200">
                                        No hay órdenes pendientes para asignar.
                                    </div>
                                )
                            ) : (
                                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cliente</label>
                                        <div className="space-y-2 mt-1">
                                            <input
                                                type="text"
                                                placeholder="🔍 Buscar cliente por nombre o apellido..."
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                value={clientSearch}
                                                onChange={(e) => setClientSearch(e.target.value)}
                                            />
                                            <select
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none"
                                                value={newClientId}
                                                onChange={handleClientChange}
                                            >
                                                <option value="">-- Seleccionar Cliente --</option>
                                                {clients
                                                    .filter(c =>
                                                        !clientSearch ||
                                                        `${c.first_name} ${c.last_name}`.toLowerCase().includes(clientSearch.toLowerCase())
                                                    )
                                                    .map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)
                                                }
                                            </select>
                                        </div>
                                    </div>
                                    {newClientId && (
                                        <div className="animate-in slide-in-from-top-2 fade-in">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Vehículo</label>
                                            <select
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none mt-1"
                                                value={newVehicleId}
                                                onChange={e => setNewVehicleId(e.target.value)}
                                            >
                                                <option value="">-- Seleccionar Vehículo --</option>
                                                {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Motivo / Problema</label>
                                        <textarea
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 mt-1 resize-none h-16"
                                            placeholder="Problemas al frenar..."
                                            value={newDescription}
                                            onChange={e => setNewDescription(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            {((mode === 'existing' && unassignedOrders.length > 0) || mode === 'new') && (
                                <div>
                                    <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">Horario del Turno ({timeSlots.length > 0 ? 'Intervalos 30m' : 'Taller Cerrado'})</label>
                                    <select
                                        className="w-full mt-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-2xl px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none"
                                        value={appointmentTime}
                                        onChange={e => setAppointmentTime(e.target.value)}
                                    >
                                        <option value="">-- Elegir --</option>
                                        {timeSlots.map(t => (
                                            <option key={t} value={t}>{t} hs</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="mt-8">
                            <button
                                onClick={handleAssignAppointment}
                                disabled={saving || !appointmentTime || (mode === 'existing' && !selectedOrderId) || (mode === 'new' && (!newClientId || !newVehicleId))}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                            >
                                {saving ? 'Guardando...' : 'Confirmar Turno'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para Mover Turno */}
            {movingOrder && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6 animate-in zoom-in duration-300">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">
                                    Re-agendar Turno
                                </h3>
                                <p className="text-xs text-slate-500 font-bold mt-1 max-w-[200px] truncate">
                                    #{movingOrder.id} - {movingOrder.client_name}
                                </p>
                            </div>
                            <button onClick={() => setMovingOrder(null)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nueva Fecha</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none mt-1"
                                    value={moveDate}
                                    onChange={e => setMoveDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nuevo Horario</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none mt-1"
                                    value={moveTime}
                                    onChange={e => setMoveTime(e.target.value)}
                                >
                                    {getTimeSlots(moveDate ? new Date(moveDate + 'T12:00:00') : new Date()).map(t => (
                                        <option key={t} value={t}>{t} hs</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleMoveAppointment}
                            disabled={saving}
                            className="w-full mt-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                        >
                            {saving ? 'Guardando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


