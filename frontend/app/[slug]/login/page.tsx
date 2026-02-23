'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { LogIn, Wrench, Car } from 'lucide-react';
import { useConfig } from '@/lib/config';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const { config: globalConfig } = useConfig();
    const [tenantConfig, setTenantConfig] = useState<any>(null);

    React.useEffect(() => {
        api.get('/config').then(res => setTenantConfig(res.data)).catch(() => { });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/login', { username, password });
            login(response.data.token, response.data.user);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-slate-900 p-8 text-center text-white">
                    <div className="flex justify-center mb-4">
                        {tenantConfig?.logo_path ? (
                            <div className="bg-white rounded-xl shadow-lg border border-slate-700 overflow-hidden w-16 h-16">
                                <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}`.replace('/api', '') + tenantConfig.logo_path} alt="Logo" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="bg-blue-600 p-3 rounded-xl shadow-lg">
                                <Car size={32} />
                            </div>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold">{tenantConfig?.workshop_name || globalConfig.product_name}</h1>
                    <p className="text-slate-400 mt-1">Gestión de Taller Mecánico</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 italic">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 block">Usuario</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="admin"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 block">Contraseña</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? 'Cargando...' : (
                            <>
                                <LogIn size={20} />
                                Iniciar Sesión
                            </>
                        )}
                    </button>
                </form>

                <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-400">
                        {globalConfig.product_name} v1.0.0
                    </p>
                </div>
            </div>
        </div>
    );
}
