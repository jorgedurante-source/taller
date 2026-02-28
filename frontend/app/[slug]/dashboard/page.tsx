'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useSlug } from '@/lib/slug';
import api from '@/lib/api';
import Link from 'next/link';
import {
    Users,
    Car,
    ClipboardList,
    TrendingUp,
    Plus,
    ChevronRight,
    Eye,
    EyeOff,
    Bell,
    Settings,
    Clock,
    MessageSquare,
    Megaphone,
    AlertTriangle,
    Info,
    CheckCircle
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useConfig } from '@/lib/config';
import { useTranslation } from '@/lib/i18n';

export default function DashboardPage() {
    const { user, hasPermission } = useAuth();
    const { t } = useTranslation();
    const { slug } = useSlug();
    const { config } = useConfig();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showTotals, setShowTotals] = useState(true);

    if (!hasPermission('dashboard')) {
        return (
            <div className="min-h-[70vh] bg-slate-900 rounded-[3rem] flex flex-col items-center justify-center text-center p-12 shadow-2xl border border-slate-800 animate-in fade-in zoom-in duration-500">
                <div className="bg-blue-600/20 p-8 rounded-[2.5rem] mb-8 ring-1 ring-blue-500/30">
                    <EyeOff size={64} className="text-blue-400" />
                </div>
                <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4 placeholder:">{t('restricted_panel')}</h2>
                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[11px] max-w-md mx-auto leading-loose opacity-70">
                    {t('restricted_panel_desc')}
                </p>
                <div className="mt-12 group cursor-pointer" onClick={() => window.location.reload()}>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] group-hover:text-blue-400 transition-colors">{t('try_again')}</p>
                    <div className="h-[2px] w-12 bg-blue-600 mx-auto mt-2 group-hover:w-20 transition-all duration-500" />
                </div>
            </div>
        );
    }

    useEffect(() => {
        const savedPrivacy = localStorage.getItem('hide_income_totals');
        if (savedPrivacy === 'true') setShowTotals(false);
    }, []);

    const togglePrivacy = () => {
        const newVal = !showTotals;
        setShowTotals(newVal);
        localStorage.setItem('hide_income_totals', String(!newVal));
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await api.get('/reports/dashboard');
                setData(response.data);
            } catch (err) {
                console.error('Error fetching dashboard data', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchData();
        }
    }, [user]);

    if (loading) {
        return <div style={{ color: 'var(--text-muted)' }} className="p-8 font-bold uppercase tracking-widest text-xs">{t('loading_stats')}</div>;
    }

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    // Use accent color from CSS var for chart ticks
    const tickStyle = { fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' };
    const gridColor = '#f1f5f9';

    return (
        <div className="space-y-10 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                        {t('dashboard')}
                    </h2>
                    <p className="text-slate-500 font-bold tracking-wider uppercase text-xs mt-1">
                        {t('welcome')}, {user?.username} · {t('operational_summary')} {slug}
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {hasPermission('income') && (
                        <button
                            onClick={togglePrivacy}
                            className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-slate-400 hover:text-slate-900"
                        >
                            {showTotals ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    )}
                    <Link href={`/${slug}/dashboard/orders/create`} className="flex-1 md:flex-none">
                        <button className="w-full bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all text-xs font-black uppercase tracking-widest">
                            <Plus size={20} />
                            {t('create_order')}
                        </button>
                    </Link>
                </div>
            </header>

            {/* Main Stats Grid - All 6 in one line */}
            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4`}>
                <StatCard
                    title={t('active_orders')}
                    value={data?.ordersByStatus
                        .filter((item: any) => !['pending', 'delivered', 'appointment'].includes(item.status))
                        .reduce((acc: number, item: any) => acc + item.count, 0) || 0}
                    icon={<ClipboardList size={20} />}
                    color="blue"
                    description={t('work_in_progress')}
                    onClick={() => router.push(`/${slug}/dashboard/orders`)}
                />
                <StatCard
                    title={t('new_clients')}
                    value={data?.newClientsThisMonth || 0}
                    icon={<Users size={20} />}
                    color="amber"
                    description={t('registered_this_month')}
                    onClick={() => router.push(`/${slug}/dashboard/clients`)}
                />
                <StatCard
                    title={t('waiting_budget')}
                    value={data?.ordersByStatus.find((s: any) => s.status === 'pending')?.count || 0}
                    icon={<Clock size={20} />}
                    color="indigo"
                    description={t('new_budgets')}
                    onClick={() => router.push(`/${slug}/dashboard/orders?status=pending`)}
                />
                <StatCard
                    title={t('assigned_appointments')}
                    value={data?.assignedAppointmentsCount || 0}
                    icon={<Bell size={20} />}
                    color="purple"
                    description={t('scheduled_appointments')}
                    onClick={() => router.push(`/${slug}/dashboard/appointments`)}
                />
                <StatCard
                    title={t('new_messages')}
                    value={data?.unreadMessagesCount || 0}
                    icon={<MessageSquare size={20} />}
                    color={data?.unreadMessagesCount > 0 ? "orange" : "slate"}
                    description={t('unread_replies')}
                    onClick={() => router.push(`/${slug}/dashboard/orders?filter=unread`)}
                />
                <StatCard
                    title={t('ready_for_delivery')}
                    value={data?.ordersByStatus.find((s: any) => s.status === 'ready')?.count || 0}
                    icon={<Car size={20} />}
                    color="emerald"
                    description={t('finished_vehicles')}
                    onClick={() => router.push(`/${slug}/dashboard/orders?status=ready`)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-center pt-4">
                {/* Left Shortcuts */}
                <div className="md:col-span-1 flex flex-col gap-4">
                    <ShortcutCard
                        href={`/${slug}/dashboard/orders?filter=active_work`}
                        title={t('tracking')}
                        subtitle={t('units_in_workshop')}
                        icon={<Car className="text-blue-500" />}
                    />
                    <ShortcutCard
                        href={`/${slug}/dashboard/reports`}
                        title={t('reports')}
                        subtitle={t('income_and_reports')}
                        icon={<TrendingUp className="text-indigo-500" />}
                    />
                </div>

                {/* Status Distribution - Centered */}
                <div className="md:col-span-2 bg-white p-6 rounded-[40px] shadow-sm border border-slate-100 flex flex-col items-center">
                    <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tight mb-4 self-start">{t('workshop_status')}</h3>
                    <div className="h-[200px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.ordersByStatus}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={8}
                                    dataKey="count"
                                    nameKey="status"
                                    stroke="none"
                                >
                                    {data?.ordersByStatus.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', color: '#000' }}
                                    itemStyle={{ color: '#000' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-black text-slate-900">
                                {data?.ordersByStatus.reduce((acc: number, item: any) => acc + item.count, 0) || 0}
                            </span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('orders')}</span>
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 w-full">
                        {data?.ordersByStatus.map((item: any, index: number) => (
                            <div key={item.status} className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 px-2 py-1 rounded-lg transition-all" onClick={() => router.push(`/${slug}/dashboard/orders?status=${item.status}`)}>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="text-[9px] font-bold text-slate-500 group-hover:text-slate-900 transition-colors uppercase">{t(item.status)}</span>
                                </div>
                                <span className="text-[9px] font-black text-slate-900">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Shortcuts */}
                <div className="md:col-span-1 flex flex-col gap-4">
                    <ShortcutCard
                        href={`/${slug}/dashboard/reminders`}
                        title={t('reminders')}
                        subtitle={t('preventive_maintenance')}
                        icon={<Bell className="text-emerald-500" />}
                    />
                    <ShortcutCard
                        href={`/${slug}/dashboard/settings`}
                        title={t('settings')}
                        subtitle={t('workshop_configuration')}
                        icon={<Settings className="text-slate-500" />}
                    />
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color, description, onClick }: { title: string, value: string | number, icon: React.ReactNode, color: string, description: string, onClick?: () => void }) {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
        slate: 'bg-slate-50 text-slate-400 border-slate-100'
    };

    return (
        <div
            onClick={onClick}
            className={`bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border ${colorClasses[color]}`}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                <div className="flex items-center justify-between group-hover:pr-2 transition-all">
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">{value}</p>
                    {onClick && <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />}
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">{description}</p>
            </div>
        </div>
    );
}

function ShortcutCard({ href, title, subtitle, icon }: { href: string, title: string, subtitle: string, icon: React.ReactNode }) {
    return (
        <Link href={href}>
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all h-full group flex flex-col items-center text-center">
                <div className="p-3 rounded-2xl bg-slate-50 group-hover:scale-110 transition-transform w-fit mb-4">
                    {icon}
                </div>
                <h4 className="font-black text-slate-900 uppercase italic text-[11px] tracking-tight">{title}</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{subtitle}</p>
            </div>
        </Link>
    );
}

