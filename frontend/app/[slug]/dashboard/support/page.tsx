'use client';

import React, { useState, useEffect } from 'react';
import {
    LifeBuoy,
    Send,
    MessageSquare,
    Clock,
    CheckCircle2,
    AlertCircle,
    RotateCcw,
    XCircle
} from 'lucide-react';
import api from '@/lib/api';
import { useNotification } from '@/lib/notification';
import { useAuth } from '@/lib/auth';

interface Ticket {
    id: number;
    subject: string;
    message: string;
    reply: string | null;
    status: 'open' | 'resolved';
    created_at: string;
    updated_at: string;
}

export default function SupportPage() {
    const { user } = useAuth();
    const { notify } = useNotification();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);

    const [formData, setFormData] = useState({
        subject: '',
        message: ''
    });

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            const res = await api.get('/config/reports');
            setTickets(res.data);
        } catch (err) {
            console.error('Error fetching tickets:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.subject || !formData.message) {
            notify('warning', 'Por favor completa todos los campos');
            return;
        }

        setSending(true);
        try {
            await api.post('/config/report', formData);
            notify('success', 'Reporte enviado correctamente. El equipo técnico lo revisará pronto.');
            setFormData({ subject: '', message: '' });
            setShowForm(false);
            fetchTickets();
        } catch (err) {
            notify('error', 'Error al enviar el reporte');
        } finally {
            setSending(false);
        }
    };

    const handleUpdateStatus = async (id: number, newStatus: 'open' | 'resolved') => {
        setUpdatingStatus(id);
        try {
            await api.put(`/config/reports/${id}/status`, { status: newStatus });
            notify('success', `Reporte marcado como ${newStatus === 'resolved' ? 'solucionado' : 'sin solucionar'}`);
            fetchTickets();
        } catch (err) {
            notify('error', 'Error al actualizar el estado');
        } finally {
            setUpdatingStatus(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-4">
                        Centro de Soporte
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
                            <LifeBuoy size={24} />
                        </div>
                    </h2>
                    <p className="text-slate-500 font-bold tracking-wider uppercase text-xs mt-2 ml-1">
                        Reporte de problemas y contacto directo con el creador
                    </p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl flex items-center gap-3 shadow-xl transition-all text-xs font-black uppercase tracking-widest active:scale-95"
                    >
                        <AlertCircle size={20} />
                        Reportar un Problema
                    </button>
                )}
            </header>

            {showForm ? (
                <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl animate-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-rose-50 text-rose-600 rounded-3xl">
                                <AlertCircle size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase italic">Nuevo Reporte</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalla el inconveniente</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowForm(false)}
                            className="text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] tracking-widest"
                        >
                            Cancelar
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Asunto del Problema</label>
                            <input
                                type="text"
                                value={formData.subject}
                                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                className="w-full bg-slate-50 border-none rounded-2xl p-5 text-lg font-bold text-slate-900 focus:ring-4 focus:ring-blue-100 transition-all"
                                placeholder="Ej: Error al cargar el logo del taller"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Escribe tu mensaje</label>
                            <textarea
                                rows={6}
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                className="w-full bg-slate-50 border-none rounded-3xl p-6 text-slate-900 font-bold focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                                placeholder="Describe el error lo más detallado posible..."
                            />
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={sending}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-5 rounded-[2rem] flex items-center gap-3 shadow-2xl shadow-blue-500/20 transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50 active:scale-95"
                            >
                                {sending ? 'Enviando...' : (
                                    <>
                                        <Send size={20} />
                                        Enviar Reporte
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between px-4 mb-2">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] italic">Tus Reportes Anteriores</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Total:</span>
                                <span className="text-[10px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">{tickets.length}</span>
                            </div>
                        </div>

                        {loading ? (
                            <div className="bg-white p-20 rounded-[3rem] border border-slate-100 flex flex-col items-center justify-center text-center">
                                <div className="animate-spin text-blue-600 mb-4"><LifeBuoy size={40} /></div>
                                <p className="font-black uppercase tracking-widest text-[10px] text-slate-400 italic">Cargando Historial...</p>
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="bg-white p-20 rounded-[4rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
                                <div className="p-6 bg-slate-50 rounded-[2.5rem] mb-6">
                                    <CheckCircle2 size={48} className="text-emerald-500 opacity-20" />
                                </div>
                                <h4 className="text-xl font-black text-slate-900 uppercase italic">Sin problemas reportados</h4>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">¡Tu taller parece estar funcionando perfectamente!</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {tickets.map((ticket) => (
                                    <div key={ticket.id} className="group bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-2xl ${ticket.status === 'open' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {ticket.status === 'open' ? <Clock size={20} /> : <CheckCircle2 size={20} />}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-900 uppercase italic leading-none mb-1">{ticket.subject}</h4>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(ticket.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${ticket.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                    {ticket.status === 'open' ? 'Pendiente' : 'Solucionado'}
                                                </span>
                                            </div>
                                        </div>

                                        <p className="text-slate-600 font-medium text-sm leading-relaxed mb-6 bg-slate-50 p-4 rounded-2xl italic">
                                            "{ticket.message}"
                                        </p>

                                        {ticket.reply && (
                                            <div className="mt-6 pt-6 border-t border-slate-50">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                                                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest italic">Respuesta del Desarrollador</span>
                                                    </div>

                                                    {/* Workshop Actions */}
                                                    <div className="flex items-center gap-2">
                                                        {ticket.status === 'open' ? (
                                                            <button
                                                                onClick={() => handleUpdateStatus(ticket.id, 'resolved')}
                                                                disabled={updatingStatus === ticket.id}
                                                                className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100"
                                                            >
                                                                <CheckCircle2 size={14} />
                                                                Marcar como Solucionado
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleUpdateStatus(ticket.id, 'open')}
                                                                disabled={updatingStatus === ticket.id}
                                                                className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all border border-rose-100"
                                                            >
                                                                <RotateCcw size={14} />
                                                                Reabrir Ticket
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100/50">
                                                    <p className="text-blue-900 font-bold text-sm leading-relaxed italic">
                                                        {ticket.reply}
                                                    </p>
                                                    <div className="flex justify-end mt-2">
                                                        <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">
                                                            Actualizado el {new Date(ticket.updated_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-8">
                        {/* Info Card */}
                        <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-500">
                                <LifeBuoy size={120} />
                            </div>
                            <h4 className="text-lg font-black uppercase italic mb-4 relative z-10">¿Cómo funciona?</h4>
                            <p className="text-xs font-bold text-slate-400 leading-relaxed uppercase tracking-wide relative z-10 opacity-80">
                                Tu mensaje llegará directamente al equipo de desarrollo central. Revisamos cada reporte individualmente para asegurar la mejor calidad del software.
                            </p>
                            <div className="mt-8 space-y-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center"><Clock size={16} /></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Respuesta en 24/48hs</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center"><CheckCircle2 size={16} /></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Soluciones directas</span>
                                </div>
                            </div>
                        </div>

                        {/* Other Support Options */}
                        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm text-center">
                            <div className="p-4 bg-blue-50 text-blue-600 w-fit mx-auto rounded-3xl mb-4">
                                <MessageSquare size={24} />
                            </div>
                            <h4 className="font-black text-slate-900 uppercase italic mb-1">Contacto Alternativo</h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">¿Problemas urgentes?</p>
                            <p className="text-xs font-bold text-slate-600 bg-slate-50 py-3 px-4 rounded-xl border border-slate-100">soporte@surforge.com</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
