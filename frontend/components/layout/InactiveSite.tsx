'use client';

import React from 'react';
import { AlertTriangle, Home, Mail } from 'lucide-react';
import Link from 'next/link';

export default function InactiveSite({ slug, details }: { slug: string, details?: string }) {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 p-10 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 mx-auto mb-8 shadow-inner">
                    <AlertTriangle size={40} />
                </div>

                <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter mb-4">
                    Sitio Desactivado
                </h1>

                <p className="text-slate-500 font-bold mb-8 leading-relaxed">
                    {details || `El acceso al taller "${slug}" ha sido suspendido temporalmente por el administrador del sistema.`}
                </p>

                <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3 text-left">
                        <Mail className="text-slate-400 shrink-0" size={18} />
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Soporte Técnico</p>
                            <p className="text-sm font-bold text-slate-700">soporte@surforge.com</p>
                        </div>
                    </div>
                </div>

                <div className="mt-10 pt-8 border-t border-slate-50">
                    <Link
                        href="/"
                        className="flex items-center justify-center gap-2 text-slate-400 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest transition-colors"
                    >
                        <Home size={14} /> Volver al Inicio
                    </Link>
                </div>
            </div>
        </div>
    );
}
