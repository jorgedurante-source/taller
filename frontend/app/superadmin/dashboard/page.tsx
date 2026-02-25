'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { superApi } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { useNotification } from '@/lib/notification';
import {
    LayoutGrid,
    Plus,
    Search,
    Settings,
    ExternalLink,
    Database,
    Users,
    ClipboardList,
    Activity,
    LogOut,
    PlusCircle,
    CheckCircle2,
    Trash2,
    ShieldCheck,
    RefreshCw,
    Image as ImageIcon,
    AlertCircle,
    MessageSquare,
    X,
    Eye,
    EyeOff,
    Settings2,
    ToggleLeft,
    ToggleRight,
    Copy,
    Check,
    Key,
    Car
} from 'lucide-react';

interface Workshop {
    id: number;
    slug: string;
    name: string;
    status: string;
    created_at: string;
    active_orders: number;
    total_clients: number;
    api_token?: string;
    logo_path?: string;
    environment?: string;
    enabled_modules?: string[];
}

interface Stats {
    total_workshops: number;
    active_workshops: number;
    total_orders: number;
    total_clients: number;
    total_vehicles: number;
}

export default function SuperAdminDashboard() {
    const [workshops, setWorkshops] = useState<Workshop[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState<Workshop | null>(null);
    const [showModulesModal, setShowModulesModal] = useState<Workshop | null>(null);
    const [newWorkshop, setNewWorkshop] = useState({ name: '', slug: '' });
    const [showToken, setShowToken] = useState(false);
    const [copied, setCopied] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [adminPassword, setAdminPassword] = useState('');
    const [updatingModules, setUpdatingModules] = useState(false);
    const { config } = useConfig();
    const { notify } = useNotification();
    const router = useRouter();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [wResponse, sResponse] = await Promise.all([
                superApi.get('/workshops'),
                superApi.get('/stats')
            ]);
            setWorkshops(wResponse.data);
            setStats(sResponse.data);

            // If the manage modal is open, update its data too
            if (showManageModal && Array.isArray(wResponse.data)) {
                const updated = wResponse.data.find((w: Workshop) => w.slug === showManageModal.slug);
                if (updated) setShowManageModal(updated);
            }
            if (showModulesModal && Array.isArray(wResponse.data)) {
                const updated = wResponse.data.find((w: Workshop) => w.slug === showModulesModal.slug);
                if (updated) setShowModulesModal(updated);
            }
        } catch (err) {
            console.error('Failed to fetch superadmin data:', err);
            // Optionally check if it's a 401/403 to avoid redirecting on temporary network errors
            if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
                router.push('/superadmin/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWorkshop = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await superApi.post('/workshops', newWorkshop);
            setShowCreateModal(false);
            setNewWorkshop({ name: '', slug: '' });
            fetchData();
            notify('success', 'Taller desplegado correctamente');
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al crear taller');
        }
    };

    const handleUpdateWorkshop = async (slug: string, updates: Partial<Workshop>) => {
        // Confirmation for environment change
        if (updates.environment) {
            const isToProd = updates.environment === 'prod';
            const msg = isToProd
                ? '¿Estás seguro de pasar a PRODUCCIÓN? Se desactivarán las herramientas de limpieza y generación de datos de prueba.'
                : '¿Pasar a modo DESARROLLO? Se habilitarán herramientas para sembrar datos de prueba y limpiar la base de datos.';
            if (!confirm(msg)) return;
        }

        try {
            await superApi.patch(`/workshops/${slug}`, updates);
            fetchData();
            notify('success', 'Información actualizada');
        } catch (err) {
            notify('error', 'Error al actualizar taller');
        }
    };

    const handleUpdateModules = async (slug: string, modules: string[]) => {
        setUpdatingModules(true);
        try {
            await superApi.patch(`/workshops/${slug}`, { enabled_modules: modules });
            await fetchData();
            notify('success', 'Módulos actualizados');
        } catch (err) {
            notify('error', 'Error al actualizar módulos');
        } finally {
            setUpdatingModules(false);
        }
    };

    const handleRegenerateToken = async (slug: string) => {
        if (!confirm('¿Regenerar Token? El anterior dejará de funcionar inmediatamente.')) return;
        try {
            await superApi.post(`/workshops/${slug}/token`);
            fetchData();
            setShowToken(true);
            notify('success', 'Token regenerado');
        } catch (err) {
            notify('error', 'Error al regenerar token');
        }
    };

    const handleCopyToken = () => {
        if (showManageModal?.api_token) {
            navigator.clipboard.writeText(showManageModal.api_token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, slug: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('logo', file);

        setLogoUploading(true);
        try {
            await superApi.post(`/workshops/${slug}/logo`, formData);
            fetchData();
            notify('success', 'Logo actualizado');
        } catch (err) {
            notify('error', 'Error al subir logo');
        } finally {
            setLogoUploading(false);
        }
    };

    const handleImpersonate = async (slug: string) => {
        try {
            const res = await superApi.post(`/impersonate/${slug}`);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            localStorage.setItem('current_slug', slug);
            window.location.href = `/${slug}/dashboard`;
        } catch (err) {
            notify('error', 'Error al conectar con el taller');
        }
    };

    const handleResetAdminPassword = async (slug: string) => {
        if (!adminPassword) return notify('warning', 'Debes ingresar una contraseña');
        if (!confirm('¿Cambiar la contraseña del administrador del taller?')) return;

        try {
            await superApi.post(`/workshops/${slug}/admin-password`, { password: adminPassword });
            notify('success', 'Contraseña actualizada correctamente');
            setAdminPassword('');
        } catch (err) {
            notify('error', 'Error al actualizar contraseña');
        }
    };

    const handleSeedData = async (slug: string) => {
        if (!confirm('¿Insertar datos de prueba? Esto agregará clientes y órdenes ficticias.')) return;
        try {
            await superApi.post(`/workshops/${slug}/seed`);
            notify('success', 'Datos sembrados correctamente');
            fetchData();
        } catch (err) {
            notify('error', 'Error al sembrar datos');
        }
    };

    const handleClearData = async (slug: string) => {
        if (!showManageModal || showManageModal.environment === 'prod') return;

        const confirm1 = confirm('¿LIMPIAR BASE DE DATOS? Se borrarán todas las órdenes, clientes y vehículos.');
        if (!confirm1) return;

        const confirm2 = confirm('ADVERTENCIA: Esta acción es IRREVERSIBLE. Se borrarán todos los registros operativos del taller. ¿Estás SEGURO de continuar?');
        if (!confirm2) return;

        try {
            await superApi.post(`/workshops/${slug}/clear`);
            notify('success', 'Base de datos limpia correctamente');
            fetchData();
        } catch (err) {
            notify('error', 'Error al limpiar base de datos');
        }
    };

    const handleReseedTemplates = async (slug: string) => {
        if (!confirm('¿RESETEAR PLANTILLAS? Esto borrará todos los mensajes actuales del taller y restaurará las plantillas maestras por defecto.')) return;
        try {
            await superApi.post(`/workshops/${slug}/reseed-templates`);
            notify('success', 'Plantillas restauradas correctamente');
            fetchData();
        } catch (err) {
            notify('error', 'Error al restaurar plantillas');
        }
    };

    const handleDeleteWorkshop = async (slug: string) => {
        const confirm1 = confirm(`¿Estás SEGURO de que quieres eliminar COMPLETAMENTE el taller "${slug}"?`);
        if (!confirm1) return;

        const confirm2 = confirm(`ADVERTENCIA: Esta acción eliminará permanentemente la base de datos y todos los archivos subidos del taller "${slug}". Esta acción NO SE PUEDE DESHACER.\n\n¿Proceder con la eliminación total?`);
        if (!confirm2) return;

        try {
            await superApi.delete(`/workshops/${slug}`);
            fetchData();
            setShowManageModal(null);
            notify('success', 'Taller eliminado permanentemente');
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al eliminar taller');
        }
    };

    const filteredWorkshops = workshops.filter(w =>
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.slug.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    return (
        <div className="min-h-screen">
            {/* Top Navigation */}
            <nav className="bg-slate-900 border-b border-slate-800 text-white p-4 sticky top-0 z-50">
                <div className="max-w-[1600px] mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 p-2 rounded-xl">
                            <LayoutGrid size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tighter italic">{config.product_name} <span className="text-indigo-400">Central</span></h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Global Control Plane</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/superadmin/settings')}
                            className="bg-slate-800 hover:bg-slate-700 p-2.5 rounded-xl transition-all group border border-slate-700 hover:border-indigo-500/50"
                        >
                            <Settings size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                        </button>
                        <div className="w-[1px] h-8 bg-slate-800 mx-2" />
                        <button
                            onClick={() => {
                                localStorage.removeItem('super_token');
                                router.push('/superadmin/login');
                            }}
                            className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold transition-colors"
                        >
                            <LogOut size={18} />
                            Desconectarse
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-[1600px] mx-auto p-8 pt-10">
                {/* Global Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Talleres</p>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">{stats?.total_workshops}</h2>
                        <div className="mt-4 flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{stats?.active_workshops} Activos</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Órdenes Totales</p>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">{stats?.total_orders}</h2>
                        <div className="mt-4 flex items-center gap-2 text-indigo-600">
                            <Activity size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">En toda la red</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Clientes</p>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">{stats?.total_clients}</h2>
                        <div className="mt-4 flex items-center gap-2 text-purple-600">
                            <Users size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Base unificada</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Vehículos</p>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic">{stats?.total_vehicles}</h2>
                        <div className="mt-4 flex items-center gap-2 text-amber-600">
                            <Database size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Activos</span>
                        </div>
                    </div>
                    <div
                        onClick={() => setShowCreateModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 p-6 rounded-[32px] shadow-xl shadow-indigo-500/20 cursor-pointer transition-all group overflow-hidden relative"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                            <PlusCircle size={80} />
                        </div>
                        <p className="text-indigo-100 font-black text-[10px] uppercase tracking-widest mb-1">Nueva Conexión</p>
                        <h2 className="text-4xl font-black text-white tracking-tighter italic uppercase">Crear</h2>
                        <div className="mt-4 flex items-center gap-2 text-white/80">
                            <Plus size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest underline">Procesar Taller</span>
                        </div>
                    </div>
                </div>

                {/* Workshops List Section */}
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tight">Ecosistema de Talleres</h3>
                            <p className="text-slate-500 font-bold text-sm tracking-wide">Gestiona el estado, branding y seguridad de cada instancia.</p>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o slug..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-white border-2 border-slate-100 pl-12 pr-6 py-4 rounded-3xl w-full md:w-96 font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredWorkshops.map(w => (
                            <div key={w.id} className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8">
                                    <button
                                        onClick={() => { setShowManageModal(w); setShowToken(false); }}
                                        className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100"
                                    >
                                        <Settings2 size={20} />
                                    </button>
                                </div>

                                <div className="flex items-start gap-4 mb-6">
                                    <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all overflow-hidden shrink-0">
                                        {w.logo_path ? (
                                            <img src={(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '') + w.logo_path} alt={w.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Car size={32} />
                                        )}
                                    </div>
                                    <div className="pt-1">
                                        <h4 className="text-2xl font-black text-slate-900 tracking-tighter italic leading-tight line-clamp-1 pr-6">{w.name}</h4>
                                        <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mt-2 border ${w.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                                            }`}>
                                            {w.status === 'active' ? 'Operativo' : 'Inactivo'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 group-hover:bg-white transition-colors">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Órdenes Activas</p>
                                        <div className="flex items-center gap-2">
                                            <Activity size={14} className="text-indigo-400" />
                                            <p className="text-xl font-black text-slate-900">{w.active_orders}</p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 group-hover:bg-white transition-colors">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Clientes</p>
                                        <div className="flex items-center gap-2">
                                            <Users size={14} className="text-purple-400" />
                                            <p className="text-xl font-black text-slate-900">{w.total_clients}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-8 px-1">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Panel Administrativo</p>
                                        <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100/50 group/link">
                                            <code className="text-[10px] text-slate-500 font-bold truncate">/{w.slug}/login</code>
                                            <button
                                                onClick={() => window.open(`${window.location.origin}/${w.slug}/login`, '_blank')}
                                                className="text-indigo-600 hover:text-indigo-700 transition-colors"
                                            >
                                                <ExternalLink size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Portal de Clientes</p>
                                        <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100/50 group/link">
                                            <code className="text-[10px] text-slate-500 font-bold truncate">/{w.slug}/client</code>
                                            <button
                                                onClick={() => window.open(`${window.location.origin}/${w.slug}/client`, '_blank')}
                                                className="text-emerald-600 hover:text-emerald-700 transition-colors"
                                            >
                                                <ExternalLink size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleImpersonate(w.slug)}
                                        disabled={w.status === 'inactive'}
                                        className={`flex-grow bg-slate-900 hover:bg-black text-white font-black py-4 rounded-[1.5rem] transition-all text-[11px] uppercase flex items-center justify-center gap-2 italic tracking-tight ${w.status === 'inactive' ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    >
                                        <ExternalLink size={16} />
                                        Acceder al Panel
                                    </button>
                                    <button
                                        onClick={() => setShowModulesModal(w)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-4 rounded-[1.5rem] transition-all"
                                        title="Gestionar Módulos"
                                    >
                                        <ShieldCheck size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Create Workshop Modal */}
            {
                showCreateModal && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-12 relative overflow-hidden animate-in fade-in zoom-in duration-300">
                            <div className="absolute top-0 left-0 w-full h-3 bg-indigo-600" />

                            <div className="flex justify-between items-start mb-10">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Nueva Conexión</h2>
                                    <p className="text-slate-400 font-black text-[10px] mt-3 uppercase tracking-[0.2em]">Provisionar nueva infraestructura de taller</p>
                                </div>
                                <button onClick={() => setShowCreateModal(false)} className="bg-slate-50 p-3 rounded-2xl text-slate-400 hover:text-slate-900 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateWorkshop} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Comercial del Taller</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Taller Mecánico"
                                        value={newWorkshop.name}
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            setNewWorkshop(prev => ({
                                                ...prev,
                                                name,
                                                slug: prev.slug || name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
                                            }));
                                        }}
                                        className="w-full bg-slate-50 border-2 border-slate-100 text-slate-900 p-5 rounded-2xl font-black focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-200 text-lg"
                                        required
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Identificador de Sistema (Slug)</label>
                                    <div className="flex items-center gap-3 bg-slate-50 p-5 rounded-2xl border-2 border-slate-100">
                                        <span className="text-slate-400 font-black text-sm uppercase italic tracking-widest">/</span>
                                        <input
                                            type="text"
                                            placeholder="mi-taller"
                                            value={newWorkshop.slug}
                                            onChange={(e) => setNewWorkshop(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/ /g, '-') }))}
                                            className="flex-grow bg-transparent border-none text-slate-900 p-0 font-black focus:ring-0 placeholder:text-slate-200 text-lg tracking-tight"
                                            required
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold italic ml-1">* El slug es permanente y define la ruta de acceso y la base de datos.</p>
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button type="button" onClick={() => setShowCreateModal(false)} className="flex-grow font-black py-5 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all uppercase text-[10px] tracking-widest">Descartar</button>
                                    <button type="submit" className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-500/30 transition-all uppercase text-[10px] italic tracking-[0.1em]">Confirmar y Desplegar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Manage Workshop Modal */}
            {
                showManageModal && (
                    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[100] flex items-start justify-center p-4 overflow-y-auto">
                        <div className="bg-white w-full max-w-2xl rounded-[4rem] shadow-2xl overflow-hidden my-8 animate-in fade-in slide-in-from-bottom-12 duration-500">
                            <div className="p-12 relative">
                                <button
                                    onClick={() => { setShowManageModal(null); setShowToken(false); }}
                                    className="absolute top-10 right-10 bg-slate-50 p-4 rounded-3xl text-slate-400 hover:text-slate-900 transition-all hover:rotate-90"
                                >
                                    <X size={24} />
                                </button>

                                <div className="flex items-center gap-6 mb-12">
                                    <div className="relative group">
                                        <div className="w-24 h-24 bg-slate-50 border-2 border-slate-100 rounded-[2rem] flex items-center justify-center text-slate-400 overflow-hidden shrink-0 transition-all group-hover:scale-105 border-dashed border-indigo-200">
                                            {showManageModal.logo_path ? (
                                                <img src={(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '') + showManageModal.logo_path} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon size={32} className="opacity-20" />
                                            )}
                                            {logoUploading && (
                                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                                    <RefreshCw size={24} className="animate-spin text-indigo-600" />
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => logoInputRef.current?.click()}
                                            className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-3 rounded-2xl shadow-xl hover:scale-110 active:scale-90 transition-all"
                                        >
                                            <ImageIcon size={16} />
                                        </button>
                                        <input
                                            type="file"
                                            ref={logoInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleLogoUpload(e, showManageModal.slug)}
                                        />
                                    </div>
                                    <div className="shrink">
                                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none">{showManageModal.name}</h2>
                                        <p className="text-slate-400 font-bold text-xs mt-3 flex items-center gap-2">
                                            <Database size={14} className="text-indigo-400" />
                                            /{showManageModal.slug}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    {/* Workshop Name and Status */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Comercial</label>
                                            <input
                                                type="text"
                                                value={showManageModal.name}
                                                onChange={(e) => handleUpdateWorkshop(showManageModal.slug, { name: e.target.value })}
                                                className="w-full bg-slate-50 border-none rounded-3xl p-5 font-black text-slate-800 text-lg hover:bg-slate-100 transition-colors focus:ring-4 focus:ring-indigo-100"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Estado Operativo</label>
                                            <button
                                                onClick={() => handleUpdateWorkshop(showManageModal.slug, { status: showManageModal.status === 'active' ? 'inactive' : 'active' })}
                                                className={`w-full p-5 rounded-3xl flex items-center justify-between transition-all duration-500 ${showManageModal.status === 'active'
                                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-lg shadow-emerald-600/5'
                                                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                                                    }`}
                                            >
                                                <span className="font-black text-lg italic uppercase tracking-tighter">
                                                    {showManageModal.status === 'active' ? 'Activo' : 'Desactivado'}
                                                </span>
                                                {showManageModal.status === 'active' ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Environment Toggle */}
                                    <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] border border-indigo-100 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-[11px] font-black text-indigo-900 uppercase tracking-widest leading-none">Modo de Entorno</h4>
                                            <p className="text-[9px] text-indigo-400 font-bold mt-1 uppercase">Dev vs Prod Control</p>
                                        </div>
                                        <button
                                            onClick={() => handleUpdateWorkshop(showManageModal.slug, { environment: showManageModal.environment === 'dev' ? 'prod' : 'dev' })}
                                            className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase italic tracking-widest transition-all ${showManageModal.environment === 'dev'
                                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                                : 'bg-slate-900 text-white'
                                                }`}
                                        >
                                            {showManageModal.environment === 'dev' ? 'Modo Desarrollo' : 'Modo Producción'}
                                        </button>
                                    </div>

                                    {/* Data Management Section */}
                                    {showManageModal.environment === 'dev' && (
                                        <div className="grid grid-cols-2 gap-6 animate-in fade-in zoom-in duration-300">
                                            <div className="space-y-3">
                                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Datos de Prueba</label>
                                                <button
                                                    onClick={() => handleSeedData(showManageModal.slug)}
                                                    className="w-full bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 p-5 rounded-3xl font-black text-sm transition-all flex items-center justify-center gap-2 border border-slate-100"
                                                >
                                                    <Database size={18} />
                                                    Sembrar Datos
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Mantenimiento</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => handleClearData(showManageModal.slug)}
                                                        className="w-full bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 p-5 rounded-3xl font-black text-[10px] transition-all flex flex-col items-center justify-center gap-2 border border-slate-100"
                                                    >
                                                        <RefreshCw size={18} />
                                                        LIMPIAR DB
                                                    </button>
                                                    <button
                                                        onClick={() => handleReseedTemplates(showManageModal.slug)}
                                                        className="w-full bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-600 p-5 rounded-3xl font-black text-[10px] transition-all flex flex-col items-center justify-center gap-2 border border-slate-100 uppercase italic"
                                                    >
                                                        <MessageSquare size={18} />
                                                        Reseed Mensajes
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* API Security Token */}
                                    <div className="bg-slate-950 rounded-[3rem] p-10 space-y-5 border border-slate-800 relative overflow-hidden group/tokenbox">
                                        <div className="absolute top-0 right-0 p-8 opacity-5">
                                            <ShieldCheck size={120} className="text-white" />
                                        </div>

                                        <div className="flex justify-between items-center relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">
                                                    <ShieldCheck size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="text-white font-black text-sm uppercase tracking-widest italic leading-none">Slug API Token</h3>
                                                    <p className="text-slate-500 text-[9px] font-bold uppercase mt-1 tracking-widest">Authentication Key</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRegenerateToken(showManageModal.slug)}
                                                className="bg-slate-800/50 hover:bg-white hover:text-slate-950 p-2.5 rounded-xl transition-all group flex items-center gap-2"
                                            >
                                                <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-700" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">Rotar</span>
                                            </button>
                                        </div>

                                        <div className="flex gap-3 relative z-10">
                                            <div className="flex-grow bg-slate-900 border-2 border-slate-800 p-5 rounded-[1.5rem] font-mono text-[10px] break-all leading-tight text-slate-300 shadow-inner group-hover/tokenbox:border-indigo-500/30 transition-all flex items-center min-h-[64px]">
                                                {showToken ? (
                                                    <span className="animate-in fade-in duration-300">{showManageModal.api_token}</span>
                                                ) : (
                                                    <span className="tracking-[0.5em] text-slate-700 uppercase font-black text-xs mr-auto">Hidden Token</span>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => setShowToken(!showToken)}
                                                    className={`p-5 rounded-2xl transition-all ${showToken ? 'bg-indigo-600 text-white' : 'bg-slate-900 border-2 border-slate-800 text-slate-500 hover:text-white'}`}
                                                >
                                                    {showToken ? <EyeOff size={20} /> : <Eye size={20} />}
                                                </button>
                                                <button
                                                    onClick={handleCopyToken}
                                                    className={`p-5 rounded-2xl transition-all border-2 ${copied ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                                                >
                                                    {copied ? <Check size={20} /> : <Copy size={20} />}
                                                </button>
                                            </div>
                                        </div>

                                        <p className="text-[10px] text-slate-600 italic ml-1 relative z-10 underline decoration-slate-800">
                                            Advertencia: La regeneración invalidará todas las integraciones actuales.
                                        </p>
                                    </div>

                                    <div className="space-y-6 pt-6 border-t-2 border-slate-50 relative">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
                                                <Key size={14} />
                                            </div>
                                            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest italic">Acceso Maestro (Admin)</h4>
                                        </div>

                                        <div className="flex gap-3">
                                            <input
                                                type="password"
                                                placeholder="Nueva clave para 'admin'..."
                                                value={adminPassword}
                                                onChange={(e) => setAdminPassword(e.target.value)}
                                                className="flex-grow bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm focus:outline-none focus:border-amber-500 transition-all placeholder:text-slate-300"
                                            />
                                            <button
                                                onClick={() => handleResetAdminPassword(showManageModal.slug)}
                                                className="bg-slate-900 hover:bg-amber-500 text-white font-black px-6 py-4 rounded-2xl transition-all text-[10px] uppercase italic tracking-widest flex items-center gap-2"
                                            >
                                                Actualizar
                                            </button>
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-bold ml-1 uppercase">Solo afecta al usuario 'admin' de este taller específico.</p>
                                    </div>

                                    <div className="pt-10 flex gap-4">
                                        <button
                                            onClick={() => { setShowManageModal(null); setShowToken(false); }}
                                            className="flex-grow font-black py-6 rounded-[2rem] bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all uppercase text-[10px] tracking-widest"
                                        >
                                            Cerrar
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm('¿ESTÁS ABSOLUTAMENTE SEGURO? Los datos se borrarán permanentemente.')) {
                                                    handleDeleteWorkshop(showManageModal.slug);
                                                }
                                            }}
                                            className="flex-grow bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white font-black py-6 rounded-[2rem] transition-all uppercase text-[10px] italic tracking-[0.1em]"
                                        >
                                            Eliminar Taller
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modules Management Modal */}
            {
                showModulesModal && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[110] flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 animate-in fade-in zoom-in duration-300">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Módulos Habilitados</h2>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">{showModulesModal.name}</p>
                                </div>
                                <button onClick={() => setShowModulesModal(null)} className="bg-slate-50 p-2.5 rounded-2xl text-slate-400 hover:text-slate-900">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4 mb-10">
                                {[
                                    { key: 'dashboard', label: 'Dashboard / Estadísticas' },
                                    { key: 'clientes', label: 'Gestión de Clientes' },
                                    { key: 'vehiculos', label: 'Gestión de Vehículos' },
                                    { key: 'ordenes', label: 'Gestión de Órdenes / OT' },
                                    { key: 'ingresos', label: 'Reportes de Ingresos' },
                                    { key: 'configuracion', label: 'Configuración Interna' },
                                    { key: 'usuarios', label: 'Gestión de Usuarios' },
                                    { key: 'roles', label: 'Gestión de Roles' },
                                    { key: 'recordatorios', label: 'Seguimientos / Recordatorios' },
                                    { key: 'turnos', label: 'Turnos / Calendario' }
                                ].map(module => {
                                    // Assume enabled_modules is an array, it might be a JSON string if not enriched properly but we enriched it
                                    const isEnabled = Array.isArray(showModulesModal.enabled_modules) && showModulesModal.enabled_modules.includes(module.key);
                                    return (
                                        <label key={module.key} className={`flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer transition-all border border-slate-100 ${updatingModules ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <span className="text-sm font-bold text-slate-700">{module.label}</span>
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={isEnabled}
                                                    disabled={updatingModules}
                                                    onChange={(e) => {
                                                        const current = Array.isArray(showModulesModal.enabled_modules)
                                                            ? showModulesModal.enabled_modules
                                                            : [];
                                                        const next = e.target.checked
                                                            ? [...current, module.key]
                                                            : current.filter(k => k !== module.key);
                                                        handleUpdateModules(showModulesModal.slug, next);
                                                    }}
                                                />
                                                <div className={`w-10 h-5 rounded-full transition-colors ${isEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                                    {updatingModules && isEnabled && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <RefreshCw size={10} className="animate-spin text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-5' : ''}`}></div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => setShowModulesModal(null)}
                                className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest transition-all"
                            >
                                Cerrar y Actualizar
                            </button>
                        </div>
                    </div>
                )}
        </div>
    );
}
