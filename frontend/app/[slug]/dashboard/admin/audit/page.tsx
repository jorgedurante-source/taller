'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useSlug } from '@/lib/slug';
import { useNotification } from '@/lib/notification';
import { 
    Activity, 
    ArrowLeft, 
    User, 
    Calendar, 
    Tag, 
    Database, 
    ChevronDown, 
    ChevronUp,
    Info,
    Smartphone,
    Globe,
    ExternalLink,
    Search
} from 'lucide-react';
import Link from 'next/link';

interface AuditLog {
    id: number;
    user_id: number | null;
    user_name: string;
    action: string;
    entity_type: string;
    entity_id: string | number | null;
    old_values: string | null;
    new_values: string | null;
    details: string | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

export default function AuditPage() {
    const { slug } = useSlug();
    const { notify } = useNotification();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await api.get('/logs/audit?limit=200');
            setLogs(res.data);
        } catch (err) {
            notify('error', 'Error al cargar los logs de auditoría');
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
            return <pre className="bg-slate-50 p-4 rounded-xl text-[11px] font-mono text-slate-700 overflow-auto max-h-60 border border-slate-100 mt-2 shadow-inner">
                {JSON.stringify(obj, null, 2)}
            </pre>;
        } catch (e) {
            return <p className="text-slate-500 italic mt-2 text-xs">{jsonStr}</p>;
        }
    };

    const getActionColor = (action: string) => {
        if (action.includes('DELETE')) return 'bg-red-50 text-red-600 border-red-100';
        if (action.includes('CREATE') || action.includes('ADD')) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
        if (action.includes('UPDATE')) return 'bg-amber-50 text-amber-600 border-amber-100';
        if (action.includes('LOGIN')) return 'bg-blue-50 text-blue-600 border-blue-100';
        return 'bg-slate-50 text-slate-600 border-slate-100';
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
                    <Link 
                        href={`/${slug}/dashboard/settings`}
                        className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold mb-4 transition-colors group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        Volver a Configuración
                    </Link>
                    <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
                        <Activity className="text-blue-600" size={36} />
                        Historial de Auditoría
                    </h1>
                    <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-xs">Registro forense de todas las acciones críticas</p>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Buscar por usuario, acción..."
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none transition-all font-medium text-slate-900"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </header>

            {loading ? (
                <div className="bg-white p-20 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Cargando registros...</p>
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="bg-white p-20 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center gap-4">
                    <Info size={48} className="text-slate-200" />
                    <h3 className="text-xl font-black text-slate-400 uppercase italic">No se encontraron registros</h3>
                    <p className="text-slate-400 text-sm font-bold max-w-sm">Los logs de auditoría comenzarán a aparecer a medida que los usuarios realicen acciones.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredLogs.map(log => {
                        const isExpanded = expandedIds.includes(log.id);
                        return (
                            <div 
                                key={log.id}
                                className={`bg-white rounded-3xl border transition-all duration-300 ${isExpanded ? 'border-blue-200 shadow-xl shadow-blue-500/5 ring-4 ring-blue-50' : 'border-slate-100 shadow-sm hover:border-slate-300'}`}
                            >
                                <div 
                                    className="p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                                    onClick={() => toggleExpand(log.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-2xl border ${getActionColor(log.action)} font-black text-[10px] tracking-widest uppercase min-w-[140px] text-center`}>
                                            {log.action.replace(/_/g, ' ')}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-slate-900 text-lg uppercase italic tracking-tight">{log.user_name}</span>
                                                <span className="text-slate-400 text-xs font-bold">•</span>
                                                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">{log.entity_type} {log.entity_id && `#${log.entity_id}`}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                                                <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(log.created_at).toLocaleString()}</span>
                                                <span className="flex items-center gap-1"><Tag size={12} /> {log.ip_address}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 self-end md:self-center">
                                        {isExpanded ? <ChevronUp className="text-blue-500" /> : <ChevronDown className="text-slate-300" />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-6 pb-6 pt-2 border-t border-slate-50 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Smartphone size={14} /> Dispositivo y Navegador
                                                </h4>
                                                <p className="text-xs text-slate-600 font-medium bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
                                                    {log.user_agent || 'N/A'}
                                                </p>
                                            </div>
                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Database size={14} /> Datos Técnicos
                                                </h4>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-xs font-bold py-2 border-b border-dashed border-slate-100">
                                                        <span className="text-slate-400 uppercase">Audit ID</span>
                                                        <span className="text-slate-900">#{log.id}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs font-bold py-2 border-b border-dashed border-slate-100">
                                                        <span className="text-slate-400 uppercase">Entidad</span>
                                                        <span className="text-slate-900">{log.entity_type} ({log.entity_id || 'Global'})</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs font-bold py-2">
                                                        <span className="text-slate-400 uppercase">IP Origen</span>
                                                        <a 
                                                            href={`https://whois.domaintools.com/${log.ip_address}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:underline flex items-center gap-1"
                                                        >
                                                            {log.ip_address} <ExternalLink size={10} />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {(log.details || log.old_values || log.new_values) && (
                                            <div className="mt-8 pt-6 border-t border-slate-50">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Metadatos de la Acción</h4>
                                                <div className="grid grid-cols-1 gap-4">
                                                    {log.details && (
                                                        <div>
                                                            <span className="text-[9px] font-black text-slate-300 uppercase italic">Registro de Datos / Cambios:</span>
                                                            {formatJSON(log.details)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <footer className="mt-12 pt-8 border-t border-slate-100 text-center">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                    SISTEMA DE AUDITORÍA CERTIFICADO • SURFORGE SECURITY COMPLIANCE
                </p>
            </footer>
        </div>
    );
}
