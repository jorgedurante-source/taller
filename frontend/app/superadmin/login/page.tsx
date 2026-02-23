'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { superApi } from '@/lib/api';
import { LayoutGrid, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export default function SuperAdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await superApi.post('/login', { username, password });
            localStorage.setItem('super_token', response.data.token);
            localStorage.setItem('super_user', JSON.stringify(response.data.user));
            router.push('/superadmin/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-20">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-500/20">
                        <LayoutGrid className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic">
                        Mech<span className="text-blue-500 italic">Hub</span>
                    </h1>
                    <p className="text-slate-400 font-bold text-sm mt-2 uppercase tracking-widest">SuperAdmin Control Panel</p>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-[32px] shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500 text-sm font-bold animate-shake">
                                <AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-wider">Usuario Master</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-slate-950 border-2 border-slate-800 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-slate-700"
                                    placeholder="Ingrese alias"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-wider">Contraseña</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-950 border-2 border-slate-800 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-slate-700"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-tight italic"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                "Acceder al Sistema Central"
                            )}
                        </button>
                    </form>
                </div>

                <div className="text-center mt-8 text-slate-600 font-bold text-xs uppercase tracking-widest">
                    &copy; {new Date().getFullYear()} MechHub Multi-Tenant Engineering
                </div>
            </div>
        </div>
    );
}
