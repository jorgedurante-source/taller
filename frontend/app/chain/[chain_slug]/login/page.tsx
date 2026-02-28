'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api';

export default function ChainLoginPage() {
    const { chain_slug } = useParams<{ chain_slug: string }>();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await axios.post(`${BASE}/chain/login`, { email, password, chain_slug });
            localStorage.setItem('chain_token', res.data.token);
            localStorage.setItem('chain_user', JSON.stringify(res.data.user));
            localStorage.setItem('chain_slug', chain_slug);
            router.push(`/chain/${chain_slug}/dashboard`);
        } catch {
            setError('Credenciales incorrectas');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Panel de Cadena</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{chain_slug}</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Contraseña"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all"
                        required
                    />
                    {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50"
                    >
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
}
