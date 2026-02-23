'use client';
import { useSlug } from '@/lib/slug';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { UserPlus, Mail, Phone, Lock, User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
    const { slug } = useSlug();
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/client/register', formData);
            router.push('/client/login?registered=true');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al crear la cuenta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-160px)] p-4 bg-slate-50">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                <div className="p-10 space-y-8">
                    <div className="flex items-center justify-between">
                        <Link href={`/${slug}/client/login`} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <ArrowLeft size={24} />
                        </Link>
                        <div className="text-right">
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight tracking-tight uppercase">Crear Cuenta</h1>
                            <p className="text-slate-500 mt-1 uppercase text-xs font-bold tracking-widest">Portal Clientes MechHub</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-900 uppercase tracking-widest ml-1">Primer Nombre</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="text"
                                        required
                                        className="w-full pl-11 pr-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all bg-slate-50/50 text-slate-900 font-bold"
                                        placeholder="Juan"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-900 uppercase tracking-widest ml-1">Apellido</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="text"
                                        required
                                        className="w-full pl-11 pr-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all bg-slate-50/50 text-slate-900 font-bold"
                                        placeholder="Pérez"
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-900 uppercase tracking-widest ml-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="email"
                                        required
                                        className="w-full pl-11 pr-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all bg-slate-50/50 text-slate-900 font-bold"
                                        placeholder="tu@email.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-900 uppercase tracking-widest ml-1">Teléfono</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="tel"
                                        required
                                        className="w-full pl-11 pr-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all bg-slate-50/50 text-slate-900 font-bold"
                                        placeholder="11 1234 5678"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-900 uppercase tracking-widest ml-1">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input
                                    type="password"
                                    required
                                    className="w-full pl-11 pr-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all bg-slate-50/50 text-slate-900 font-bold"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-slate-900 hover:bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4 uppercase tracking-widest"
                        >
                            {loading ? 'Procesando...' : (
                                <>
                                    <UserPlus size={20} />
                                    CONFIRMAR REGISTRO
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-slate-500 text-sm font-medium">
                        ¿Ya tenés cuenta? <Link href={`/${slug}/client/login`} className="text-blue-600 hover:underline">Iniciá sesión acá</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
