'use client';

import React from 'react';
import { Hammer, ShieldAlert, Clock, Mail } from 'lucide-react';

interface MaintenanceModeProps {
    supportEmail?: string;
    productName?: string;
}

export default function MaintenanceMode({ supportEmail, productName = 'MechHub' }: MaintenanceModeProps) {
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-amber-600 rounded-full blur-[150px] animate-pulse" />
                <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[150px] animate-pulse delay-700" />
            </div>

            <div className="w-full max-w-2xl text-center space-y-12">
                {/* Icon & Badge */}
                <div className="relative inline-block">
                    <div className="w-24 h-24 bg-amber-500/10 border border-amber-500/20 rounded-[2.5rem] flex items-center justify-center mx-auto animate-bounce">
                        <Hammer className="text-amber-500" size={48} />
                    </div>
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white p-2 rounded-xl shadow-lg border-4 border-slate-950">
                        <ShieldAlert size={16} />
                    </div>
                </div>

                {/* Text Content */}
                <div className="space-y-4">
                    <h1 className="text-5xl md:text-7xl font-black text-white italic uppercase tracking-tighter leading-none">
                        Fuera de <span className="text-amber-500">Servicio</span>
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-xs">Mantenimiento Programado en Curso</p>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-2xl border border-slate-800 p-8 rounded-[3rem] shadow-2xl relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="text-slate-200 text-lg font-medium leading-relaxed mb-8">
                        Estamos realizando mejoras críticas en <span className="text-white font-black italic">{productName}</span> para brindarte una mejor experiencia. Volveremos a estar en línea pronto.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-4">
                            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                                <Clock size={20} />
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estado</p>
                                <p className="text-xs font-bold text-white uppercase tracking-tight">En Progreso</p>
                            </div>
                        </div>
                        {supportEmail && (
                            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex items-center gap-4">
                                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                                    <Mail size={20} />
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Soporte</p>
                                    <p className="text-xs font-bold text-white tracking-tight">{supportEmail}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Branding */}
                <div className="pt-8 flex flex-col items-center gap-4">
                    <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
                    <div className="font-black text-slate-600 italic uppercase flex items-center gap-2 tracking-tighter">
                        <span>MECH<span className="text-amber-500/50">HUB</span></span>
                        <div className="w-1 h-1 bg-slate-800 rounded-full" />
                        <span className="text-[10px]">CORE VERSION 2.0</span>
                    </div>
                </div>
            </div>

            {/* Admin Bypass Link (Subtle) */}
            <div className="fixed bottom-4 right-4">
                <a
                    href="/superadmin/login"
                    className="text-[9px] font-black text-slate-800 hover:text-slate-600 uppercase tracking-[0.3em] transition-colors"
                >
                    System Access
                </a>
            </div>
        </div>
    );
}
