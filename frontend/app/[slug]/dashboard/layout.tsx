'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { useSlug } from '@/lib/slug';
import { superApi } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { useNotification } from '@/lib/notification';
import { useTranslation } from '@/lib/i18n';
import {
    Users,
    Car,
    ClipboardList,
    TrendingUp,
    LayoutDashboard,
    Settings,
    LogOut,
    Plus,
    ShieldCheck,
    ChevronDown,
    Building2,
    Bell,
    Calendar as CalendarIcon,
    Truck,
    Megaphone,
    AlertTriangle,
    Info,
    CheckCircle,
    LifeBuoy,
    BarChart3
} from 'lucide-react';

interface Workshop {
    slug: string;
    name: string;
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, logout, loading, hasPermission } = useAuth();
    const { notify } = useNotification();
    const { t, language, setLanguage } = useTranslation();
    const { slug } = useSlug();
    const router = useRouter();
    const pathname = usePathname();
    const { config, loading: configLoading } = useConfig();
    const [workshops, setWorkshops] = useState<Workshop[]>([]);
    const [showWorkshopSwitcher, setShowWorkshopSwitcher] = useState(false);
    const [tenantConfig, setTenantConfig] = useState<any>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push(`/${slug || 'demo'}/login`);
        }
    }, [user, loading, router, slug]);

    // Fetch workshops if superuser to show switcher
    useEffect(() => {
        if (user?.isSuperuser) {
            superApi.get('/workshops').then(res => setWorkshops(res.data)).catch(() => { });
        }
    }, [user]);

    useEffect(() => {
        if (slug) {
            axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/${slug}/config`)
                .then(res => {
                    console.log(`[layout] Config for ${slug}:`, res.data);
                    setTenantConfig(res.data);
                })
                .catch(() => { });
        }
    }, [slug]);

    if (loading || !user || configLoading) {
        return <div className="flex items-center justify-center min-h-screen">{t('loading_app')} {config.product_name || '...'}</div>;
    }

    const handleSwitchWorkshop = async (targetSlug: string) => {
        if (targetSlug === slug) return;
        try {
            const res = await superApi.post(`/impersonate/${targetSlug}`);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            localStorage.setItem('current_slug', targetSlug);
            if (res.data.user.language) {
                localStorage.setItem('language', res.data.user.language);
            }
            window.location.href = `/${targetSlug}/dashboard`;
        } catch (err) {
            notify('error', t('error'));
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar */}
            <aside className="sidebar-themed w-64 hidden md:flex flex-col fixed inset-y-0">
                <div className="p-6 text-white flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        {tenantConfig?.logo_path ? (
                            <img src={(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '') + tenantConfig.logo_path} alt="Logo" className="w-16 h-16 xl:w-20 xl:h-20 object-cover rounded-xl bg-white" />
                        ) : (
                            <div className="p-3 bg-white/10 rounded-xl">
                                <Car size={32} />
                            </div>
                        )}
                        <span className="font-black text-xl italic uppercase tracking-tighter line-clamp-2 leading-tight">{tenantConfig?.workshop_name || config.product_name}</span>
                    </div>

                    {/* Workshop Selector for Superadmins */}
                    {user?.isSuperuser && (
                        <div className="relative mt-4">
                            <button
                                onClick={() => setShowWorkshopSwitcher(!showWorkshopSwitcher)}
                                className="w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700 p-3 rounded-xl flex items-center justify-between transition-all group"
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Building2 size={14} className="text-blue-400 shrink-0" />
                                    <span className="text-[10px] font-black uppercase truncate tracking-widest">{slug}</span>
                                </div>
                                <ChevronDown size={14} className={`text-slate-500 transition-transform ${showWorkshopSwitcher ? 'rotate-180' : ''}`} />
                            </button>

                            {showWorkshopSwitcher && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-2 max-h-48 overflow-y-auto">
                                        <p className="text-[9px] font-black text-slate-500 uppercase p-2 tracking-[0.2em]">{t('select_workshop')}</p>
                                        {workshops.map(w => (
                                            <button
                                                key={w.slug}
                                                onClick={() => handleSwitchWorkshop(w.slug)}
                                                className={`w-full text-left p-2.5 rounded-lg text-xs font-bold transition-colors mb-1 ${w.slug === slug ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                                                    }`}
                                            >
                                                {w.name}
                                            </button>
                                        ))}
                                    </div>
                                    <Link href="/superadmin/dashboard">
                                        <div className="bg-slate-800 p-3 flex items-center gap-2 text-[10px] font-black uppercase text-blue-400 hover:bg-slate-700 transition-colors border-t border-slate-700 cursor-pointer">
                                            <ShieldCheck size={14} />
                                            {t('central_panel')}
                                        </div>
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <nav className="flex-grow p-4 space-y-1">
                    {hasPermission('dashboard') && <NavItem href={`/${slug}/dashboard`} icon={<LayoutDashboard size={18} />} label={t('dashboard')} />}
                    {hasPermission('clients') && <NavItem href={`/${slug}/dashboard/clients`} icon={<Users size={18} />} label={t('clients')} />}
                    {hasPermission('vehicles') && <NavItem href={`/${slug}/dashboard/vehicles`} icon={<Car size={18} />} label={t('vehicles')} />}
                    {hasPermission('orders') && <NavItem href={`/${slug}/dashboard/orders`} icon={<ClipboardList size={18} />} label={t('orders')} />}
                    {hasPermission('appointments') && <NavItem href={`/${slug}/dashboard/appointments`} icon={<CalendarIcon size={18} />} label={t('appointments')} />}
                    {hasPermission('income') && <NavItem href={`/${slug}/dashboard/income`} icon={<TrendingUp size={18} />} label={t('income')} />}
                    {hasPermission('reminders') && <NavItem href={`/${slug}/dashboard/reminders`} icon={<Bell size={18} />} label={t('reminders')} />}
                    {hasPermission('suppliers') && <NavItem href={`/${slug}/dashboard/suppliers`} icon={<Truck size={18} />} label={t('suppliers')} />}
                    {hasPermission('reports') && <NavItem href={`/${slug}/dashboard/reports`} icon={<BarChart3 size={18} />} label={t('reports')} />}
                    {hasPermission('settings') && <NavItem href={`/${slug}/dashboard/settings`} icon={<Settings size={18} />} label={t('settings')} />}
                </nav>

                <div className="p-4 border-t border-slate-800 space-y-2">
                    {user?.isSuperuser && (
                        <Link href="/superadmin/dashboard">
                            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 transition-all cursor-pointer">
                                <ShieldCheck size={18} />
                                <span className="font-bold text-xs uppercase italic">SuperAdmin</span>
                            </div>
                        </Link>
                    )}
                    <button
                        onClick={() => {
                            logout();
                            router.push(`/${slug}/login`);
                        }}
                        className="flex items-center gap-3 px-4 py-2 w-full rounded-lg hover:bg-slate-800 transition-all text-slate-400 hover:text-white"
                    >
                        <LogOut size={18} />
                        <span className="font-bold text-[10px] uppercase tracking-widest">{t('logout')}</span>
                    </button>

                    <Link href={`/${slug}/dashboard/support`}>
                        <div className="flex items-center gap-3 px-4 py-2 w-full rounded-lg hover:bg-slate-800/50 transition-all text-slate-500 hover:text-blue-400 group cursor-pointer">
                            <LifeBuoy size={14} className="group-hover:animate-spin-slow" />
                            <span className="font-bold text-[9px] uppercase tracking-[0.2em]">{t('support')}</span>
                        </div>
                    </Link>
                </div>
            </aside>

            {tenantConfig?.environment === 'dev' && (
                <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white py-1 px-4 flex items-center justify-center gap-4 shadow-lg border-b border-amber-600 animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-2">
                        <Settings size={14} className="animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">{t('dev_environment')}</span>
                    </div>
                    <div className="h-3 w-[1px] bg-white/30 hidden sm:block" />
                    <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:block">{t('dev_data_warning')}</span>
                    <div className="flex items-center gap-1.5 bg-white/20 px-2 py-0.5 rounded-full">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        <span className="text-[9px] font-black uppercase">{t('dev_mode')}</span>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className={`flex-grow md:ml-64 p-8 ${tenantConfig?.environment === 'dev' ? 'pt-12' : ''}`}>
                {/* Global Announcements from Superadmin */}
                {config.announcements && config.announcements.length > 0 && (
                    <div className="mb-8 space-y-4 animate-in slide-in-from-top-4 duration-500">
                        {config.announcements.map((ann) => (
                            <div
                                key={ann.id}
                                className={`p-6 rounded-[2.5rem] border flex items-center gap-6 shadow-sm transition-all hover:shadow-md ${ann.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-900' :
                                    ann.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-900' :
                                        ann.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
                                            'bg-blue-50 border-blue-100 text-blue-900'
                                    }`}
                            >
                                <div className={`p-4 rounded-3xl ${ann.type === 'error' ? 'bg-rose-600 text-white' :
                                    ann.type === 'warning' ? 'bg-amber-600 text-white' :
                                        ann.type === 'success' ? 'bg-emerald-600 text-white' :
                                            'bg-blue-600 text-white'
                                    }`}>
                                    {ann.type === 'error' ? <AlertTriangle size={24} /> :
                                        ann.type === 'warning' ? <Megaphone size={24} /> :
                                            ann.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}
                                </div>
                                <div className="flex-grow">
                                    <h4 className="font-black uppercase tracking-tighter text-lg leading-none mb-1 italic">{ann.title}</h4>
                                    <p className="text-sm font-bold opacity-80">{ann.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {children}
            </main>
        </div>
    );
}

function NavItem({ icon, label, href }: { icon: React.ReactNode, label: string, href: string }) {
    const pathname = usePathname();
    const active = pathname === href;

    return (
        <Link href={href}>
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all border ${active
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}>
                {icon}
                <span className="font-bold text-sm tracking-tight">{label}</span>
            </div>
        </Link>
    );
}
