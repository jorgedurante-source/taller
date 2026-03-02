import React from 'react';
import { X, Clock } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    detail: any;
    loading: boolean;
}

const CrossChainOrderDetailModal = ({ isOpen, onClose, detail, loading }: Props) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    const getStatusStyle = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'delivered' || s === 'entregado') return 'bg-slate-900 text-white border-transparent';
        if (s === 'finalizado' || s === 'ready' || s === 'listo para retiro') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
        if (s === 'aprobado' || s === 'approved' || s === 'in_progress' || s === 'in_repair' || s === 'en proceso') return 'bg-blue-50 text-blue-600 border-blue-100';
        if (s === 'presupuestado' || s === 'quoted') return 'bg-amber-50 text-amber-600 border-amber-100';
        return 'bg-slate-50 text-slate-500 border-slate-100';
    };

    const formatNotes = (notes: string) => {
        if (!notes) return '';
        let formatted = notes;
        const statuses = [
            'appointment', 'pending', 'quoted', 'approved',
            'in_progress', 'in_repair', 'waiting_parts',
            'ready', 'delivered', 'cancelled'
        ];

        statuses.forEach(status => {
            const regex = new RegExp(`\\b${status}\\b`, 'gi');
            if (formatted.match(regex)) {
                formatted = formatted.replace(regex, t(status));
            }
        });
        return formatted;
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-2xl p-8 max-h-[85vh] overflow-y-auto shadow-2xl relative">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">
                            {loading ? 'Consultando Taller...' : 'Detalle de Orden Remota'}
                        </h3>
                        {!loading && detail && (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                Orden #{detail.order.id} · {detail.workshop_name}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-900 bg-slate-50 p-2 rounded-xl transition-all">
                        <X size={24} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Consultando taller remoto...</p>
                    </div>
                ) : detail ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Estado</label>
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(detail.order.status)}`}>
                                    {t(detail.order.status)}
                                </span>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Fecha Entrada</label>
                                <span className="text-sm font-bold text-slate-700">
                                    {new Date(detail.order.created_at).toLocaleDateString('es-AR')}
                                </span>
                            </div>
                        </div>

                        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Trabajos Realizados</label>
                            <ul className="space-y-3">
                                {detail.items.map((item: any, idx: number) => (
                                    <li key={idx} className="flex justify-between items-center text-xs font-bold border-b border-white/10 pb-2 last:border-0 last:pb-0">
                                        <span className="uppercase tracking-tight italic">{item.description}</span>
                                    </li>
                                ))}
                                {detail.items.length === 0 && <li className="text-slate-500 italic text-xs">No hay servicios detallados registrados.</li>}
                            </ul>
                        </div>

                        <div className="space-y-4">
                            <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-400">Historia de la Orden</h4>
                            <div className="space-y-3">
                                {detail.history.map((h: any, idx: number) => (
                                    <div key={idx} className="flex gap-4 items-start pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                                        <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shadow-sm shrink-0"></div>
                                        <div>
                                            <p className="text-xs font-black text-slate-800 uppercase leading-none">{t(h.status)}</p>
                                            {h.notes && <p className="text-[11px] text-slate-500 mt-1 italic">"{formatNotes(h.notes)}"</p>}
                                            <p className="text-[9px] font-bold text-slate-300 uppercase mt-1">{new Date(h.created_at).toLocaleString('es-AR')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-20 text-slate-400">
                        No se pudo cargar la información.
                    </div>
                )}
            </div>
        </div>
    );
};

export default CrossChainOrderDetailModal;
