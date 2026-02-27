'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { LogIn, Car, Wrench, UserPlus, MapPin, Clock, Instagram, Phone, MessageCircle } from 'lucide-react';
import { useConfig } from '@/lib/config';
import { useTranslation } from '@/lib/i18n';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

export default function ClientLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<any>(null);
    const { config: globalConfig } = useConfig();
    const { clientLogin, clientUser, loading: authLoading } = useAuth();
    const { t, setLanguage } = useTranslation();
    const router = useRouter();
    const params = useParams();
    const slug = params?.slug as string || 'demo';

    useEffect(() => {
        if (!authLoading && clientUser) {
            const slug = typeof window !== 'undefined' ? localStorage.getItem('current_slug') : 'demo';
            router.push(`/${slug}/client`);
        }
    }, [clientUser, authLoading, router]);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await api.get('/config');
                if (res.data && typeof res.data.business_hours === 'string') {
                    res.data.business_hours = JSON.parse(res.data.business_hours);
                }
                setConfig(res.data);
                if (res.data.client_portal_language) {
                    setLanguage(res.data.client_portal_language);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchConfig();
    }, [setLanguage]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/login', { username, password });
            clientLogin(response.data.token, response.data.user);
        } catch (err: any) {
            setError(err.response?.data?.message || t('email_password_incorrect'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row items-center justify-center min-h-[calc(100vh-160px)] p-4 bg-[var(--bg-base)] gap-8">
            {/* Workshop Info Card */}
            <div className="w-full max-w-md rounded-[40px] shadow-sm border border-[var(--border)] p-10 space-y-8 hidden lg:block bg-[var(--bg-surface)]">
                <header className="flex flex-col gap-4">
                    {config?.logo_path ? (
                        <div className="w-24 h-24 bg-white rounded-3xl p-1 shadow-sm border border-[var(--border)] overflow-hidden">
                            <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}`.replace(/\/api\/?$/, '') + config.logo_path} alt="Logo" className="w-full h-full object-cover rounded-2xl" />
                        </div>
                    ) : (
                        <div className="w-24 h-24 bg-[var(--accent)] text-white rounded-3xl p-1 shadow-sm border border-[var(--border)] flex items-center justify-center">
                            <Car size={40} />
                        </div>
                    )}
                    <div>
                        <h2 className="text-3xl font-black text-[var(--accent)] leading-tight italic uppercase tracking-tighter">{t('welcome_to')} {config?.workshop_name || 'MechHub'}</h2>
                        <p className="text-[var(--text-muted)] font-bold text-xs uppercase tracking-widest mt-2 italic">{t('excellence_automotive')}</p>
                    </div>
                </header>

                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="p-3 rounded-2xl shrink-0 h-fit" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
                            <MapPin size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">{t('location')}</p>
                            <p className="font-bold text-[var(--text-primary)] leading-relaxed">{config?.address || t('loading')}</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="p-3 rounded-2xl shrink-0 h-fit" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">{t('business_hours_title')}</p>
                            <div className="space-y-1">
                                {config?.business_hours?.mon_fri && (
                                    <p className="text-sm font-bold text-[var(--text-muted)]">{t('mon_fri_label')}: <span className="text-[var(--text-primary)]">{config.business_hours.mon_fri}</span></p>
                                )}
                                {config?.business_hours?.sat && (
                                    <p className="text-sm font-bold text-[var(--text-muted)]">{t('sat_label')}: <span className="text-[var(--text-primary)]">{config.business_hours.sat}</span></p>
                                )}
                                {config?.business_hours?.sun && (
                                    <p className="text-sm font-bold text-[var(--text-muted)]">{t('sun_label')}: <span className="text-[var(--text-primary)]">{config.business_hours.sun}</span></p>
                                )}
                            </div>
                        </div>
                    </div>

                    {(config?.phone || config?.whatsapp) && (
                        <div className="flex gap-4">
                            <div className="p-3 rounded-2xl shrink-0 h-fit" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
                                <Phone size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">{t('direct_contact')}</p>
                                <div className="space-y-1">
                                    {config?.whatsapp && (
                                        <div className="flex items-center gap-2">
                                            <MessageCircle size={14} className="text-emerald-500" />
                                            <a href={`https://wa.me/${config.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                                                +{config.whatsapp}
                                            </a>
                                        </div>
                                    )}
                                    {config?.phone && (
                                        <div className="flex items-center gap-2">
                                            <Phone size={14} className="text-[var(--text-muted)]" />
                                            <a href={`tel:${config.phone}`} className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                                                {config.phone}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-8 border-t border-[var(--border)] flex items-center gap-4 text-[var(--text-muted)]">
                    <div className="bg-[var(--bg-card)] p-2 rounded-lg hover:text-[var(--text-primary)] transition-colors cursor-pointer"><Instagram size={20} /></div>
                    <p className="text-xs font-bold uppercase tracking-widest">{t('follow_us')}</p>
                </div>
            </div>

            {/* Login Card */}
            <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-[40px] shadow-2xl overflow-hidden border border-[var(--border)]">
                <div className="p-10 text-center relative overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl" style={{ backgroundColor: 'var(--accent)' }}></div>
                    </div>

                    <div className="flex justify-center mb-6 relative z-10">
                        <div className="p-4 rounded-2xl shadow-xl" style={{ backgroundColor: 'var(--accent)' }}>
                            <Car size={32} className="text-white" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-black italic tracking-tighter relative z-10 uppercase text-[var(--text-primary)]">{t('client_portal_title')}</h1>
                    <p className="mt-2 font-black text-[10px] relative z-10 tracking-widest uppercase text-[var(--text-muted)]">{t('manage_vehicles_desc')}</p>
                </div>

                <div className="p-8 space-y-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>
                                <span className="font-bold">{error}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-black text-[var(--text-primary)] ml-1 uppercase tracking-widest">{t('your_email')}</label>
                            <input
                                type="email"
                                required
                                className="w-full px-5 py-4 rounded-2xl border border-[var(--border)] focus:ring-4 focus:ring-[var(--accent)]/10 focus:border-[var(--accent)] outline-none transition-all bg-[var(--bg-card)] text-[var(--text-primary)] font-bold placeholder-[var(--text-muted)]"
                                placeholder="ejemplo@email.com"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-[var(--text-primary)] ml-1 uppercase tracking-widest">{t('password')}</label>
                            <input
                                type="password"
                                required
                                className="w-full px-5 py-4 rounded-2xl border border-[var(--border)] focus:ring-4 focus:ring-[var(--accent)]/10 focus:border-[var(--accent)] outline-none transition-all bg-[var(--bg-card)] text-[var(--text-primary)] font-bold placeholder-[var(--text-muted)]"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full text-white font-black py-5 rounded-2xl shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 group uppercase tracking-widest opacity-90 hover:opacity-100"
                            style={{ backgroundColor: 'var(--accent)' }}
                        >
                            {loading ? t('logging_in') : (
                                <>
                                    <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                                    {t('login_button')}
                                </>
                            )}
                        </button>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[var(--border)]"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase">
                            <span className="bg-[var(--bg-surface)] px-4 text-[var(--text-muted)] font-black tracking-widest">{t('other_options')}</span>
                        </div>
                    </div>

                    <div className={globalConfig?.allow_new_registrations !== 'false' ? "grid grid-cols-2 gap-4" : "grid grid-cols-1"}>
                        {globalConfig?.allow_new_registrations !== 'false' && (
                            <Link
                                href={`/${slug}/register`}
                                className="flex flex-col items-center justify-center p-4 rounded-2xl border border-[var(--border)] hover:border-[var(--accent)] transition-all group"
                            >
                                <UserPlus size={24} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] mb-2 transition-colors" />
                                <span className="text-[10px] font-black text-[var(--text-muted)] group-hover:text-[var(--accent)] uppercase">{t('create_account')}</span>
                            </Link>
                        )}

                        <Link
                            href={`/${slug}/login`}
                            className="flex flex-col items-center justify-center p-4 rounded-2xl border border-[var(--border)] hover:border-[var(--text-primary)] transition-all group"
                        >
                            <Wrench size={24} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] mb-2 transition-colors" />
                            <span className="text-[10px] font-black text-[var(--text-muted)] group-hover:text-[var(--text-primary)] uppercase">{t('i_am_mechanic')}</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
