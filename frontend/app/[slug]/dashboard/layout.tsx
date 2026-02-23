'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSlug } from '@/lib/slug';
import { superApi } from '@/lib/api';
import { useConfig } from '@/lib/config';
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
    Building2
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
    const { slug } = useSlug();
    const router = useRouter();
    const pathname = usePathname();
    const { config, loading: configLoading } = useConfig();
    const [workshops, setWorkshops] = useState<Workshop[]>([]);
    const [showWorkshopSwitcher, setShowWorkshopSwitcher] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push(`/${slug || 'kabul'}/login`);
        }
    }, [user, loading, router, slug]);

    // Fetch workshops if superuser to show switcher
    useEffect(() => {
        if (user?.isSuperuser) {
            superApi.get('/workshops').then(res => setWorkshops(res.data)).catch(() => { });
        }
    }, [user]);

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
            alert('Error al cambiar de taller');
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar */}
            <aside className="sidebar-themed w-64 hidden md:flex flex-col fixed inset-y-0">
                <div className="p-6 text-white flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2">
                        </div>
                        <span className="font-black text-xl italic uppercase tracking-tighter">{config.product_name}</span>
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
                    {hasPermission('clients') && <NavItem href={`/${slug}/dashboard/clients`} icon={<Users size={20} />} label="Clientes" />}
                    {hasPermission('vehicles') && <NavItem href={`/${slug}/dashboard/vehicles`} icon={<Car size={20} />} label="Vehículos" />}
                    {hasPermission('orders') && (
                        <>
                            <NavItem href={`/${slug}/dashboard/orders`} icon={<ClipboardList size={20} />} label="Órdenes" />
                            <NavItem href={`/${slug}/dashboard/orders/create`} icon={<Plus size={20} />} label="Nueva Orden" />
                        </>
                    )}
                    {hasPermission('income') && <NavItem href={`/${slug}/dashboard/income`} icon={<TrendingUp size={20} />} label="Ingresos" />}
                    {hasPermission('settings') && <NavItem href={`/${slug}/dashboard/settings`} icon={<Settings size={20} />} label="Configuración" />}
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

            {/* Main Content */}
            <main className="flex-grow md:ml-64 p-8">
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
