import React from 'react';
import { Wrench, Clock, ArrowRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface Props {
    order: any;
    onClick: () => void;
    vehicleModel?: string;
}

const CrossChainHistoryItem = ({ order, onClick, vehicleModel }: Props) => {
    const { t } = useTranslation();

    const getStatusStyle = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'delivered' || s === 'entregado') return 'bg-slate-900 text-white border-transparent';
        if (s === 'finalizado' || s === 'ready' || s === 'listo para retiro') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
        if (s === 'aprobado' || s === 'approved' || s === 'in_progress' || s === 'in_repair' || s === 'en proceso') return 'bg-blue-50 text-blue-600 border-blue-100';
        if (s === 'presupuestado' || s === 'quoted') return 'bg-amber-50 text-amber-600 border-amber-100';
        return 'bg-slate-50 text-slate-400 border-slate-100';
    };

    return (
        <button
            onClick={onClick}
            className="w-full text-left flex items-center justify-between p-6 bg-slate-50/50 hover:bg-white border border-slate-100 rounded-3xl transition-all group"
        >
            <div className="flex items-center gap-6">
                <div className="bg-white p-3 rounded-2xl text-slate-400 shadow-sm group-hover:text-blue-600 transition-all">
                    <Wrench size={24} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{order.id} - {order.plate}</span>
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">{order.workshop_name}</span>
                    </div>
                    <h4 className="font-bold text-slate-800 uppercase italic leading-tight mt-0.5">{order.description || 'Consulta Técnica'}</h4>
                    <div className="flex items-center gap-4 mt-1.5">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                            <Clock size={12} /> {new Date(order.created_at).toLocaleDateString('es-AR')}
                        </span>
                        {vehicleModel && (
                            <span className="text-[9px] font-black text-slate-300 uppercase italic">/ {vehicleModel}</span>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(order.status)}`}>
                    {t(order.status)}
                </span>
                <ArrowRight size={18} className="text-slate-300 group-hover:text-slate-900 transform group-hover:translate-x-1 transition-all" />
            </div>
        </button>
    );
};

export default CrossChainHistoryItem;
