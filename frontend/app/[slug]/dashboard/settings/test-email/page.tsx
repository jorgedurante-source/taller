'use client';

import React, { useState } from 'react';
import api from '@/lib/api';
import { Mail, Send, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function TestEmailPage() {
    const [to, setTo] = useState('');
    const [message, setMessage] = useState('Hola! Este es un mail de prueba para validar el SMTP del taller.');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; data: any } | null>(null);

    const handleSendTest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);
        try {
            const res = await api.post('/config/test-email', { to, message });
            setResult({ success: true, data: res.data });
        } catch (err: any) {
            console.error(err);
            setResult({
                success: false,
                data: err.response?.data || { message: err.message }
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-12 space-y-8">
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl space-y-6">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2.5 rounded-2xl text-white">
                        <Mail size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tight">Test de Correo SMTP</h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-0.5">Validación de servidor de salida</p>
                    </div>
                </div>

                <form onSubmit={handleSendTest} className="space-y-6">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Para (Email Destino)</label>
                        <input
                            type="email"
                            required
                            className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-900"
                            placeholder="ejemplo@correo.com"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mensaje</label>
                        <textarea
                            className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-900 min-h-[120px]"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        <Send size={20} />
                        {loading ? 'ENVIANDO...' : 'ENVIAR PRUEBA'}
                    </button>
                </form>

                {result && (
                    <div className={`p-6 rounded-2xl border ${result.success ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-red-50 border-red-100 text-red-900'}`}>
                        <div className="flex items-center gap-3 mb-3">
                            {result.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                            <h3 className="font-black uppercase italic tracking-tight">
                                {result.success ? '¡Éxito!' : 'Error detectado'}
                            </h3>
                        </div>
                        <p className="text-sm font-bold mb-4">{result.data.message}</p>
                        {!result.success && (
                            <div className="bg-white/50 p-4 rounded-xl border border-red-200 font-mono text-[10px] overflow-auto max-h-40">
                                <pre>{JSON.stringify(result.data, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                ℹ️ Esta página es temporal para pruebas tecnicas y será removida.
            </p>
        </div>
    );
}
