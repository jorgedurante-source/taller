'use client';

import React, { useEffect, useState } from 'react';
import { superApi } from '@/lib/api';
import { useNotification } from '@/lib/notification';
import {
    Activity,
    ArrowLeft,
    Calendar,
    Tag,
    Database,
    ChevronDown,
    ChevronUp,
    Info,
    Smartphone,
    Search,
    Lock,
    Globe,
    ExternalLink,
    Shield
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SystemAuditLog {
    id: number;
    user_id: number | null;
    user_name: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

export default function SuperAuditPage() {
    const { notify } = useNotification();
    const router = useRouter();
    const [logs, setLogs] = useState<SystemAuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await superApi.get('/audit?limit=200');
            setLogs(res.data);
        } catch (err) {
            notify('error', 'Error al cargar los logs de auditoría global');
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const formatJSON = (jsonStr: string | null) => {
        if (!jsonStr) return null;
        try {
            const obj = JSON.parse(jsonStr);
            return <pre className="bg-slate-900 p-4 rounded-xl text-[11px] font-mono text-emerald-400 overflow-auto max-h-60 border border-slate-800 mt-2 shadow-inner">
                {JSON.stringify(obj, null, 2)}
            </pre>;
        } catch (e) {
            return <p className="text-slate-500 italic mt-2 text-xs">{jsonStr}</p>;
        }
    };

    const getActionColor = (action: string) => {
        if (action.includes('DELETE')) return 'bg-red-500 text-white shadow-lg shadow-red-500/20';
        if (action.includes('CREATE') || action.includes('RESTORE')) return 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20';
        if (action.includes('UPDATE')) return 'bg-amber-500 text-white shadow-lg shadow-amber-500/20';
        if (action.includes('LOGIN')) return 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20';
        return 'bg-slate-800 text-white';
    };

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <button
                        onClick={() => router.push('/superadmin/dashboard')}
                        className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold mb-4 transition-colors group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        Volver al Dashboard
                    </button>
                    <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3 italic">
                        <Lock className="text-indigo-600" size={36} />
                        CONTROL MAESTRO: AUDITORÍA
                    </h1>
                    <p className="text-slate-500 font-bold mt-2 uppercase tracking-[0.3em] text-[10px]">Registro de actividad de superadministradores y sistema global</p>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Filtrar actividad..."
                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-black uppercase text-xs tracking-widest text-slate-900 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </header>

            {loading ? (
                <div className="bg-white p-24 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col items-center justify-center gap-6">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
                    <p className="font-black text-slate-400 uppercase tracking-[0.5em] text-[10px] animate-pulse">Analizando núcleos de datos...</p>
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="bg-white p-24 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col items-center justify-center text-center gap-6">
                    <div className="p-6 bg-slate-50 rounded-full">
                        <Info size={64} className="text-slate-200" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Sin actividad registrada</h3>
                    <p className="text-slate-400 text-sm font-bold max-w-sm uppercase tracking-widest">El registro de auditoría global está operativo pero no tiene eventos recientes.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredLogs.map(log => {
                        const isExpanded = expandedIds.includes(log.id);
                        return (
                            <div
                                key={log.id}
                                className={`bg-white rounded-[2rem] transition-all duration-500 ease-out overflow-hidden ${isExpanded ? 'ring-[6px] ring-indigo-50 shadow-2xl border-indigo-200' : 'border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200'}`}
                            >
                                <div
                                    className="p-8 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-6"
                                    onClick={() => toggleExpand(log.id)}
                                >
                                    <div className="flex items-center gap-6">
                                        <div className={`px-5 py-2.5 rounded-xl font-black text-[10px] tracking-widest uppercase text-center w-40 ${getActionColor(log.action)}`}>
                                            {log.action.replace(/_/g, ' ')}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <span className="font-black text-slate-900 text-xl tracking-tighter uppercase italic">{log.user_name}</span>
                                                <div className="h-4 w-[1px] bg-slate-200"></div>
                                                <span className="text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em]">{log.entity_type}{log.entity_id ? `:${log.entity_id}` : ''}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                                                <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-300" /> {new Date(log.created_at).toLocaleString()}</span>
                                                <span className="flex items-center gap-1.5"><Globe size={14} className="text-slate-300" /> {log.ip_address}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 self-end md:self-center">
                                        <div className={`p-2 rounded-full transition-all ${isExpanded ? 'bg-indigo-600 text-white rotate-180' : 'bg-slate-50 text-slate-400'}`}>
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-8 pb-8 pt-2 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t border-slate-50 pt-8 mt-2">
                                            <div className="space-y-5">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                                    <Smartphone size={16} className="text-indigo-400" /> Agente de Usuario
                                                </h4>
                                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-[11px] text-slate-600 font-bold leading-relaxed shadow-inner italic">
                                                    {log.user_agent || 'IDENTIFICACIÓN FALLIDA'}
                                                </div>
                                            </div>
                                            <div className="space-y-5">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                                    <Database size={16} className="text-indigo-400" /> Atributos de Sesión
                                                </h4>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {[
                                                        { label: 'System Event ID', val: `#${log.id}` },
                                                        { label: 'Entidad Afectada', val: log.entity_type.toUpperCase() },
                                                        { label: 'Referencia ID', val: log.entity_id || 'GLOBAL_SCOPE' },
                                                        { label: 'Ubicación IP', val: log.ip_address }
                                                    ].map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-center py-3 border-b border-dashed border-slate-100 last:border-0">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                                                            <span className="text-sm font-black text-slate-900 italic tracking-tighter">{item.val}</span>
                                                        </div>
                                                    ))}
                                                    <div className="mt-4">
                                                        <a
                                                            href={`https://whois.domaintools.com/${log.ip_address}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors bg-indigo-50 px-4 py-2 rounded-lg"
                                                        >
                                                            Rastrear IP de Origen <ExternalLink size={12} />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {log.details && (
                                            <div className="mt-10 pt-8 border-t border-slate-50">
                                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
                                                    <Activity size={16} className="text-indigo-600" /> Payload de Datos (JSON)
                                                </h4>
                                                {formatJSON(log.details)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <footer className="mt-20 py-10 border-t border-slate-100">
                <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-300">
                        <Shield className="fill-current" size={16} />
                        <Activity size={16} />
                        <Lock className="fill-current" size={16} />
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] text-center max-w-lg leading-loose">
                        Este registro está blindado. Cualquier intento de alteración será reportado inmediatamente al nodo maestro.
                    </p>
                    <div className="h-[1px] w-20 bg-slate-100"></div>
                    <p className="text-slate-300 text-[9px] font-bold tracking-widest">v4.2.0 SECURITY OVERRIDE</p>
                </div>
            </footer>
        </div>
    );
}
