'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    Car,
    Wrench,
    Calendar,
    Clock,
    CheckCircle2,
    MapPin,
    Phone,
    AlertCircle,
    FileText,
    MessageSquare,
    History as HistoryIcon
} from 'lucide-react';

export default function PublicOrderPage() {
    const params = useParams();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                // Base API detection
                let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

                // Remove /api if it's already there to build the URL cleanly
                const apiBase = baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl;
                const url = `${apiBase}/api/${params.slug}/public/order/${params.token}`;

                console.log('[Portal] Fetching order details from:', url);

                const res = await fetch(url);
                console.log('[Portal] Server response status:', res.status);

                if (!res.ok) {
                    const errorMsg = await res.json().catch(() => ({ message: 'Error desconocido' }));
                    throw new Error(errorMsg.message || 'No se pudo encontrar la orden');
                }

                const data = await res.json();
                setOrder(data);
            } catch (err: any) {
                console.error('[Portal] Fetch Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchOrder();
    }, [params.slug, params.token]);

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="font-black text-slate-400 uppercase text-[10px] tracking-widest text-center">Consultando estado de reparación...</p>
            </div>
        </div>
    );

    if (error || !order) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-[40px] p-10 shadow-xl border border-slate-100 max-w-sm w-full text-center">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle size={40} />
                </div>
                <h2 className="text-xl font-black text-slate-900 uppercase italic mb-2">Error</h2>
                <p className="text-slate-500 font-bold text-sm mb-8">{error || 'La orden no existe.'}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest hover:bg-black transition-all"
                >
                    Reintentar
                </button>
            </div>
        </div>
    );

    const getStatusStep = (currentStatus: string) => {
        const steps = ['Turno asignado', 'Pendiente', 'Aprobado', 'En reparación', 'Listo para entrega', 'Entregado'];
        const currentIndex = steps.indexOf(currentStatus);
        return currentIndex;
    };

    // Helper for absolute image URLs
    const getImageUrl = (path: string) => {
        if (!path) return undefined;
        if (path.startsWith('http')) return path;

        let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const serverBase = baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl;

        return `${serverBase}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    return (
        <div className="min-h-screen bg-slate-100">
            {/* Header / Logo */}
            <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {order.logo_path ? (
                            <img src={getImageUrl(order.logo_path)} className="h-10 w-auto" alt="Logo" />
                        ) : (
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl italic">
                                M
                            </div>
                        )}
                        <div>
                            <h1 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter leading-none">{order.workshop_name || 'Panel del Cliente'}</h1>
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Seguimiento de Reparación</span>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto p-6 space-y-6 lg:py-10">
                <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-xl border border-slate-100 overflow-hidden relative">
                    <div className="absolute right-0 top-0 w-64 h-64 bg-slate-50 -translate-y-1/2 translate-x-1/2 rounded-full -z-0 opacity-50" />
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                            <div>
                                <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                                    Orden #{order.id}
                                </span>
                                <h2 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter mt-4">
                                    {order.status}
                                </h2>
                                <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-wider">
                                    Actualizado: {new Date(order.updated_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="bg-slate-900 text-white p-8 rounded-[32px] shadow-2xl">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vehículo</p>
                                <h3 className="text-xl font-black italic uppercase tracking-tighter">{order.brand} {order.model}</h3>
                                <div className="flex items-center gap-2 mt-2 text-indigo-400 font-black tracking-widest uppercase">
                                    <span className="text-sm">{order.plate}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {order.appointment_date && (order.status === 'Turno asignado' || order.status === 'Pendiente') && (
                                <div className="bg-indigo-50 border border-indigo-100 rounded-[32px] p-6 flex items-center gap-6 animate-in zoom-in-95 duration-500">
                                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                        <Calendar size={32} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Fecha de tu Turno</p>
                                        <h3 className="text-xl font-black text-indigo-900 uppercase italic leading-tight">
                                            {(() => {
                                                if (!order?.appointment_date) return 'Fecha a confirmar';
                                                try {
                                                    const cleanDate = order.appointment_date.includes('T')
                                                        ? order.appointment_date
                                                        : order.appointment_date.replace(' ', 'T');
                                                    const d = new Date(cleanDate);
                                                    return !isNaN(d.getTime())
                                                        ? d.toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
                                                        : 'Fecha a confirmar';
                                                } catch (e) {
                                                    return 'Fecha a confirmar';
                                                }
                                            })()} hs.
                                        </h3>
                                        <p className="text-indigo-500 font-bold text-xs mt-1">¡Te esperamos en el taller!</p>
                                    </div>
                                </div>
                            )}

                            <div className="relative">
                                <div className="absolute top-5 left-0 w-full h-[2px] bg-slate-100 -z-0" />
                                <div className="flex justify-between relative z-10 overflow-x-auto pb-4 scrollbar-hide">
                                    {(order.enabled_modules?.includes('appointments') && order.appointment_date ? ['Turno', 'Recibido', 'Aprobado', 'Reparando', 'Listo'] : ['Recibido', 'Aprobado', 'Reparando', 'Listo']).map((step, idx) => {
                                        const currentStepIdx = getStatusStep(order.status);
                                        const isCompleted = currentStepIdx > idx || order.status === 'Entregado';
                                        const isActive = currentStepIdx === idx && order.status !== 'Entregado';

                                        return (
                                            <div key={idx} className="flex flex-col items-center gap-3 min-w-[80px]">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${isCompleted ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 scale-110' :
                                                    isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 animate-pulse scale-110' :
                                                        'bg-white border-2 border-slate-100 text-slate-300'
                                                    }`}>
                                                    {isCompleted ? <CheckCircle2 size={20} /> : <div className="font-black text-xs">{idx + 1}</div>}
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${isCompleted || isActive ? 'text-slate-900' : 'text-slate-300'}`}>
                                                    {step}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-[40px] p-8 shadow-lg border border-slate-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                <FileText size={20} />
                            </div>
                            <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">Trabajos Detallados</h4>
                        </div>
                        <ul className="space-y-4">
                            {order.items?.map((item: any, idx: number) => (
                                <li key={idx} className="flex items-start gap-3 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                                    <span className="text-sm font-bold text-slate-600 leading-relaxed">{item.description}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-white rounded-[40px] p-8 shadow-lg border border-slate-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                                <HistoryIcon size={20} />
                            </div>
                            <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">Cronología</h4>
                        </div>
                        <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100">
                            {order.history?.map((h: any, idx: number) => (
                                <div key={idx} className="relative pl-8">
                                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${idx === 0 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                                    <p className={`text-xs font-black uppercase italic ${idx === 0 ? 'text-slate-900' : 'text-slate-500'}`}>{h.status}</p>
                                    <p className="text-[11px] text-slate-400 font-bold mb-1">{h.notes}</p>
                                    <p className="text-[9px] font-black text-slate-300 uppercase letter-spacing-widest">
                                        {new Date(h.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-[40px] p-8 md:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="text-center md:text-left">
                        <h4 className="text-xl font-black italic uppercase tracking-tighter mb-2">{order.workshop_name}</h4>
                        <div className="flex flex-col gap-2 opacity-60">
                            <div className="flex items-center justify-center md:justify-start gap-2">
                                <MapPin size={14} />
                                <span className="text-[11px] font-bold uppercase tracking-wider">{order.workshop_address || 'Sin dirección registrada'}</span>
                            </div>
                            <div className="flex items-center justify-center md:justify-start gap-2">
                                <Phone size={14} />
                                <span className="text-[11px] font-bold uppercase tracking-wider">{order.workshop_phone || 'Sin teléfono'}</span>
                            </div>
                        </div>
                    </div>
                    <a
                        href={`https://wa.me/${order.workshop_phone?.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all flex items-center gap-2"
                    >
                        <MessageSquare size={18} className="text-emerald-500" /> Hablar con el taller
                    </a>
                </div>
            </main>

            <footer className="py-10 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Potenciado por MechHub</p>
            </footer>
        </div>
    );
}
