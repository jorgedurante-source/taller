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
    Calendar as CalendarIcon
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
        return <div className="flex items-center justify-center min-h-screen">Cargando {config.product_name || '...'}</div>;
    }

    const handleSwitchWorkshop = async (targetSlug: string) => {
        if (targetSlug === slug) return;
        try {
            const res = await superApi.post(`/impersonate/${targetSlug}`);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            localStorage.setItem('current_slug', targetSlug);
            window.location.href = `/${targetSlug}/dashboard`;
        } catch (err) {
            notify('error', 'Error al cambiar de taller');
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
                                        <p className="text-[9px] font-black text-slate-500 uppercase p-2 tracking-[0.2em]">Seleccionar Taller</p>
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
                                            Panel Central
                                        </div>
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <nav className="flex-grow p-4 space-y-2">
                    {hasPermission('dashboard') && <NavItem href={`/${slug}/dashboard`} icon={<LayoutDashboard size={20} />} label="Dashboard" />}
                    {hasPermission('clientes') && <NavItem href={`/${slug}/dashboard/clients`} icon={<Users size={20} />} label="Clientes" />}
                    {hasPermission('vehiculos') && <NavItem href={`/${slug}/dashboard/vehicles`} icon={<Car size={20} />} label="Vehículos" />}
                    {hasPermission('ordenes') && (
                        <>
                            <NavItem href={`/${slug}/dashboard/orders`} icon={<ClipboardList size={20} />} label="Órdenes" />
                            <NavItem href={`/${slug}/dashboard/orders/create`} icon={<Plus size={20} />} label="Nueva Orden" />
                        </>
                    )}
                    {hasPermission('turnos') && <NavItem href={`/${slug}/dashboard/appointments`} icon={<CalendarIcon size={20} />} label="Turnos" />}
                    {hasPermission('ingresos') && <NavItem href={`/${slug}/dashboard/income`} icon={<TrendingUp size={20} />} label="Ingresos" />}
                    {hasPermission('recordatorios') && <NavItem href={`/${slug}/dashboard/reminders`} icon={<Bell size={20} />} label="Recordatorios" />}
                    {hasPermission('configuracion') && <NavItem href={`/${slug}/dashboard/settings`} icon={<Settings size={20} />} label="Configuración" />}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    {user?.isSuperuser && (
                        <Link href="/superadmin/dashboard">
                            <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 transition-all cursor-pointer">
                                <ShieldCheck size={20} />
                                <span className="font-bold text-xs uppercase italic">SuperAdmin</span>
                            </div>
                        </Link>
                    )}
                    <button
                        onClick={() => {
                            logout();
                            router.push(`/${slug}/login`);
                        }}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-lg hover:bg-slate-800 transition-all text-slate-400 hover:text-white"
                    >
                        <LogOut size={20} />
                        <span className="font-bold text-xs uppercase tracking-widest">Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Dev Mode Banner (Fixed Top) */}
            {tenantConfig?.environment === 'dev' && (
                <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white py-1 px-4 flex items-center justify-center gap-4 shadow-lg border-b border-amber-600 animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-2">
                        <Settings size={14} className="animate-spin" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">Entorno de Desarrollo</span>
                    </div>
                    <div className="h-3 w-[1px] bg-white/30 hidden sm:block" />
                    <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:block">Los datos sembrados son ficticios y solo para pruebas</span>
                    <div className="flex items-center gap-1.5 bg-white/20 px-2 py-0.5 rounded-full">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        <span className="text-[9px] font-black uppercase">Modo Dev</span>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className={`flex-grow md:ml-64 p-8 ${tenantConfig?.environment === 'dev' ? 'pt-12' : ''}`}>
                {/* Global Announcement */}
                {config.system_announcement && (
                    <div className="mb-8 bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-4 text-amber-900 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
                            <ShieldCheck size={20} />
                        </div>
                        <div className="flex-grow">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-0.5">Comunicado Oficial</p>
                            <p className="text-sm font-bold leading-tight">{config.system_announcement}</p>
                        </div>
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
