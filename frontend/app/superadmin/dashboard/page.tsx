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
    Car,
    Palette,
    Archive,
    Download,
    Upload
} from 'lucide-react';
import { THEMES, applyTheme } from '@/lib/theme';

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
    error_count?: number;
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
    const [showLogsModal, setShowLogsModal] = useState<Workshop | null>(null);
    const [systemLogs, setSystemLogs] = useState<any[]>([]);
    const [fileLogs, setFileLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
    const [logLevelFilter, setLogLevelFilter] = useState('all');
    const [logSearchFilter, setLogSearchFilter] = useState('');
    const [showThemeSelector, setShowThemeSelector] = useState(false);
    const [workshopBackups, setWorkshopBackups] = useState<any[]>([]);
    const [loadingBackups, setLoadingBackups] = useState(false);
    const [restoreOptions, setRestoreOptions] = useState({ db: true, uploads: true });
    const backupInputRef = useRef<HTMLInputElement>(null);
    const { config } = useConfig();
    const { notify } = useNotification();
    const router = useRouter();

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (showManageModal) {
            fetchWorkshopBackups(showManageModal.slug);
        }
    }, [showManageModal]);

    const fetchWorkshopBackups = async (slug: string) => {
        setLoadingBackups(true);
        try {
            const res = await superApi.get(`/workshops/${slug}/backups`);
            setWorkshopBackups(res.data);
        } catch (err) {
            console.error('Error fetching backups', err);
        } finally {
            setLoadingBackups(false);
        }
    };

    const handleCreateServerBackup = async (slug: string) => {
        notify('info', 'Generando backup en servidor...');
        try {
            await superApi.post(`/workshops/${slug}/backups/create`);
            notify('success', 'Backup guardado en servidor');
            fetchWorkshopBackups(slug);
        } catch (err) {
            notify('error', 'Error al crear backup');
        }
    };

    const handleRestoreWorkshop = async (slug: string, source: 'upload' | 'file', filename?: string) => {
        if (!restoreOptions.db && !restoreOptions.uploads) {
            return notify('warning', 'Selecciona al menos qué restaurar (Base o Archivos)');
        }

        const msg = source === 'upload'
            ? '¿Estás SEGURO? Los datos actuales del taller serán SOBRESCRITOS por el archivo seleccionado.'
            : `¿Estás SEGURO de restaurar desde "${filename}"? Los datos actuales serán SOBRESCRITOS.`;

        if (!confirm(msg)) return;

        const formData = new FormData();
        formData.append('restoreDb', String(restoreOptions.db));
        formData.append('restoreUploads', String(restoreOptions.uploads));

        if (source === 'upload') {
            const file = backupInputRef.current?.files?.[0];
            if (!file) return notify('error', 'Selección de archivo inválida');
            formData.append('backup', file);
        } else {
            if (!filename) return;
            formData.append('filename', filename);
        }

        notify('info', 'Iniciando restauración...');
        try {
            await superApi.post(`/workshops/${slug}/restore`, formData);
            notify('success', 'Taller restaurado con éxito');
            fetchData();
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error en la restauración');
        }
    };

    const handleDeleteBackup = async (slug: string, filename: string) => {
        if (!confirm(`¿Estás seguro de eliminar permanentemente el respaldo "${filename}"?`)) return;

        try {
            await superApi.delete(`/workshops/${slug}/backups/${filename}`);
            notify('success', 'Respaldo eliminado');
            fetchWorkshopBackups(slug);
        } catch (err) {
            notify('error', 'Error al eliminar respaldo');
        }
    };

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

    const fetchWorkshopLogs = async (slug: string) => {
        setLoadingLogs(true);
        setSelectedLogs([]); // Reset selection when refreshing or loading new
        try {
            const [dbRes, fileRes] = await Promise.all([
                superApi.get(`/workshops/${slug}/logs`),
                superApi.get(`/workshops/${slug}/logs/file`)
            ]);
            setSystemLogs(dbRes.data);
            setFileLogs(fileRes.data);
        } catch (err) {
            notify('error', 'Error al cargar logs del taller');
        } finally {
            setLoadingLogs(false);
        }
    };

    const handlePurgeWorkshopLogs = async (slug: string, mode: 'all' | 'old') => {
        const msg = mode === 'all' ? '¿Desea eliminar TODOS los logs?' : '¿Desea eliminar logs de más de 30 días?';
        if (!confirm(msg)) return;
        try {
            await superApi.delete(`/workshops/${slug}/logs?mode=${mode}`);
            notify('success', 'Logs purgados');
            fetchWorkshopLogs(slug);
            fetchData(); // Update the error_count in the main list
        } catch (err) {
            notify('error', 'Error al purgar logs');
        }
    };

    const handleDeleteWorkshopLogs = async (slug: string, ids: number[]) => {
        if (!confirm(`¿Eliminar ${ids.length} registros seleccionados?`)) return;
        try {
            await superApi.delete(`/workshops/${slug}/logs?ids=${ids.join(',')}`);
            notify('success', 'Registros eliminados');
            setSelectedLogs([]);
            fetchWorkshopLogs(slug);
            fetchData();
        } catch (err) {
            notify('error', 'Error al eliminar registros');
        }
    };

    useEffect(() => {
        if (showLogsModal) {
            fetchWorkshopLogs(showLogsModal.slug);
        } else {
            setLogLevelFilter('all');
            setLogSearchFilter('');
        }
    }, [showLogsModal]);

    const filteredSystemLogs = systemLogs.filter(log => {
        const matchesLevel = logLevelFilter === 'all' || log.level === logLevelFilter;
        const matchesSearch = log.message.toLowerCase().includes(logSearchFilter.toLowerCase()) ||
            (log.path && log.path.toLowerCase().includes(logSearchFilter.toLowerCase()));
        return matchesLevel && matchesSearch;
    });

    const filteredFileLogs = fileLogs.filter(log => {
        return log.message.toLowerCase().includes(logSearchFilter.toLowerCase());
    });

    const handleDownloadBackup = async (slug?: string) => {
        try {
            const url = slug ? `/workshops/${slug}/backup` : '/system/backup';
            const response = await superApi.get(url, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/zip' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            const date = new Date().toISOString().split('T')[0];
            link.setAttribute('download', slug ? `backup-${slug}-${date}.zip` : `system-backup-${date}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            notify('success', 'Respaldo generado correctamente');
        } catch (err) {
            notify('error', 'Error al generar respaldo');
        }
    };

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
                        <div className="relative">
                            <button
                                onClick={() => setShowThemeSelector(!showThemeSelector)}
                                className={`p-2.5 rounded-xl transition-all group border ${showThemeSelector ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white hover:border-indigo-500/50'}`}
                                title="Cambiar Tema"
                            >
                                <Palette size={20} />
                            </button>

                            {showThemeSelector && (
                                <>
                                    <div className="fixed inset-0 z-[60]" onClick={() => setShowThemeSelector(false)} />
                                    <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-[70] animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-3 mb-2 border-b border-slate-800">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Temas Disponibles</p>
                                        </div>
                                        <div className="grid grid-cols-1 gap-1">
                                            {THEMES.map(theme => (
                                                <button
                                                    key={theme.id}
                                                    onClick={async () => {
                                                        applyTheme(theme.id);
                                                        localStorage.setItem('mechub-super-theme', theme.id);
                                                        try {
                                                            await superApi.post('/settings', { superadmin_theme: theme.id });
                                                        } catch (e) { }
                                                        setShowThemeSelector(false);
                                                    }}
                                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 transition-all text-left group"
                                                >
                                                    <span className="text-xl">{theme.emoji}</span>
                                                    <div className="flex-grow">
                                                        <p className="text-xs font-black uppercase italic tracking-tighter group-hover:text-indigo-400">{theme.name}</p>
                                                        <div className="flex gap-1 mt-1">
                                                            <div className="w-3 h-1 rounded-full" style={{ backgroundColor: theme.preview.bg }}></div>
                                                            <div className="w-3 h-1 rounded-full" style={{ backgroundColor: theme.preview.accent }}></div>
                                                        </div>
                                                    </div>
                                                    {localStorage.getItem('mechub-super-theme') === theme.id && (
                                                        <Check size={14} className="text-indigo-500" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => handleDownloadBackup()}
                            className="bg-slate-800 hover:bg-emerald-600 p-2.5 rounded-xl transition-all group border border-slate-700 hover:border-emerald-500/50"
                            title="Respaldar TODO el Sistema"
                        >
                            <Archive size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                        </button>

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
                                <div className="absolute top-0 right-0 p-8 flex gap-2">
                                    <button
                                        onClick={() => setShowLogsModal(w)}
                                        className={`p-3 rounded-2xl transition-all border flex items-center gap-2 ${(w.error_count || 0) > 0
                                            ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border-red-100'
                                            : 'bg-slate-50 text-slate-300 hover:bg-slate-100 hover:text-slate-500 border-slate-100'
                                            }`}
                                        title="Ver Logs de Sistema"
                                    >
                                        <Activity size={20} />
                                        <span className="text-xs font-black">{w.error_count || 0}</span>
                                    </button>
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

                                    {/* Advanced Backup & Restore System */}
                                    <div className="bg-slate-50/50 rounded-[3rem] p-8 border border-slate-100 space-y-6">
                                        <div className="flex items-center justify-between px-2">
                                            <div>
                                                <h3 className="text-slate-900 font-black text-sm uppercase tracking-widest italic leading-none">Gestión de Datos</h3>
                                                <p className="text-slate-400 text-[9px] font-bold uppercase mt-1 tracking-widest">Respaldo y Restauración</p>
                                            </div>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={restoreOptions.db}
                                                        onChange={(e) => setRestoreOptions({ ...restoreOptions, db: e.target.checked })}
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-slate-900 transition-colors">Base</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={restoreOptions.uploads}
                                                        onChange={(e) => setRestoreOptions({ ...restoreOptions, uploads: e.target.checked })}
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-slate-900 transition-colors">Archivos</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => handleDownloadBackup(showManageModal.slug)}
                                                className="bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 p-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 border border-slate-100 shadow-sm"
                                            >
                                                <Download size={18} />
                                                Descargar ZIP
                                            </button>

                                            <div className="relative">
                                                <button
                                                    onClick={() => backupInputRef.current?.click()}
                                                    className="w-full bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 p-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 border border-slate-100 shadow-sm"
                                                >
                                                    <Upload size={18} />
                                                    Subir y Pisar
                                                </button>
                                                <input
                                                    type="file"
                                                    ref={backupInputRef}
                                                    className="hidden"
                                                    accept=".zip"
                                                    onChange={() => handleRestoreWorkshop(showManageModal.slug, 'upload')}
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-white/80 rounded-[2.5rem] p-6 border border-slate-100/50 space-y-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Historial en Servidor</h4>
                                                <button
                                                    onClick={() => handleCreateServerBackup(showManageModal.slug)}
                                                    className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-2"
                                                >
                                                    <RefreshCw size={12} />
                                                    Nuevo Punto
                                                </button>
                                            </div>

                                            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                                {loadingBackups ? (
                                                    <div className="flex justify-center py-4">
                                                        <RefreshCw className="animate-spin text-slate-300" size={20} />
                                                    </div>
                                                ) : workshopBackups.length > 0 ? (
                                                    workshopBackups.map((bk, i) => (
                                                        <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-indigo-100 transition-all">
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-700 italic">{bk.name}</p>
                                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                                    {new Date(bk.created_at).toLocaleString()} • {(bk.size / 1024 / 1024).toFixed(2)} MB
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleRestoreWorkshop(showManageModal.slug, 'file', bk.name)}
                                                                    title="Restaurar este punto"
                                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                >
                                                                    <RefreshCw size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteBackup(showManageModal.slug, bk.name)}
                                                                    title="Eliminar respaldo"
                                                                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-center py-6 text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Sin respaldos locales</p>
                                                )}
                                            </div>
                                        </div>

                                        {showManageModal.environment === 'dev' && (
                                            <div className="pt-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-2">Peligro: Limpieza Dev</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <button
                                                        onClick={() => handleClearData(showManageModal.slug)}
                                                        className="bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white p-3 rounded-2xl font-black text-[8px] uppercase tracking-widest transition-all border border-rose-100"
                                                        title="Borrrar todo (Datos)"
                                                    >
                                                        Limpiar Base
                                                    </button>
                                                    <button
                                                        onClick={() => handleSeedData(showManageModal.slug)}
                                                        className="bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white p-3 rounded-2xl font-black text-[8px] uppercase tracking-widest transition-all border border-indigo-100"
                                                        title="Generar Clientes/Órdenes"
                                                    >
                                                        Sembrar Mock
                                                    </button>
                                                    <button
                                                        onClick={() => handleReseedTemplates(showManageModal.slug)}
                                                        className="bg-amber-50 hover:bg-amber-600 text-amber-600 hover:text-white p-3 rounded-2xl font-black text-[8px] uppercase tracking-widest transition-all border border-amber-100"
                                                        title="Resetear Plantillas Mensajes"
                                                    >
                                                        Resetear Msg
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

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

                                    <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] border border-indigo-100 flex items-center justify-between">
                                        <div>
                                            <h4 className="text-[11px] font-black text-indigo-900 uppercase tracking-widest leading-none">Generar Log de Prueba</h4>
                                            <p className="text-[9px] text-indigo-400 font-bold mt-1 uppercase">Validar sistema de reporte de errores</p>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await superApi.post(`/workshops/${showManageModal.slug}/test-error`);
                                                    notify('success', 'Error de prueba registrado');
                                                    fetchData();
                                                } catch (e) {
                                                    notify('error', 'Fallo al generar error');
                                                }
                                            }}
                                            className="px-6 py-3 bg-slate-900 hover:bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase italic tracking-widest transition-all"
                                        >
                                            Disparar Error
                                        </button>
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
                                    { key: 'turnos', label: 'Turnos / Calendario' },
                                    { key: 'proveedores', label: 'Gestión de Proveedores' }
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

            {/* Workshop Logs Modal */}
            {showLogsModal && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[120] flex items-center justify-center p-4 overflow-hidden">
                    <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[4rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-500">
                        <div className="p-10 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-red-50 text-red-600 rounded-[1.5rem]">
                                    <Activity size={32} />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Logs de Sistema</h2>
                                    <p className="text-slate-400 font-bold text-xs mt-2 uppercase tracking-widest leading-none">Taller: {showLogsModal.name} ({showLogsModal.slug})</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => fetchWorkshopLogs(showLogsModal.slug)}
                                    className="p-4 bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-2xl transition-all"
                                    title="Refrescar"
                                >
                                    <RefreshCw size={24} className={loadingLogs ? 'animate-spin' : ''} />
                                </button>
                                {selectedLogs.length > 0 && (
                                    <button
                                        onClick={() => handlePurgeWorkshopLogs(showLogsModal.slug, 'all')}
                                        className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                                    >
                                        Purgar Todo
                                    </button>
                                )}
                                {selectedLogs.length > 0 && (
                                    <button
                                        onClick={() => handleDeleteWorkshopLogs(showLogsModal.slug, selectedLogs)}
                                        className="bg-slate-900 text-white hover:bg-black px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                                    >
                                        <Trash2 size={14} />
                                        Eliminar Seleccionados ({selectedLogs.length})
                                    </button>
                                )}
                                {selectedLogs.length === 0 && (
                                    <button
                                        onClick={() => handlePurgeWorkshopLogs(showLogsModal.slug, 'all')}
                                        className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                                    >
                                        Purgar Todo
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowLogsModal(null)}
                                    className="bg-slate-100 p-4 rounded-2xl text-slate-400 hover:text-slate-900 transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-grow overflow-y-auto p-10 space-y-12">
                            {/* Log Filters */}
                            <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                                <div className="flex-grow relative w-full">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Filtrar por mensaje o ruta..."
                                        value={logSearchFilter}
                                        onChange={(e) => setLogSearchFilter(e.target.value)}
                                        className="bg-white border-2 border-slate-100 pl-12 pr-6 py-3 rounded-2xl w-full font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    {['all', 'info', 'warn', 'error'].map(level => (
                                        <button
                                            key={level}
                                            onClick={() => setLogLevelFilter(level)}
                                            className={`px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${logLevelFilter === level
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200'
                                                : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                                                }`}
                                        >
                                            {level === 'all' ? 'Todos' : level}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* DB Logs */}
                            <section className="space-y-6">
                                <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-widest flex items-center gap-2">
                                    <Database size={20} className="text-indigo-500" />
                                    Registros de Base de Datos
                                </h3>
                                <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                                    {filteredSystemLogs.length === 0 ? (
                                        <div className="p-20 text-center">
                                            <p className="text-slate-400 font-bold italic">No hay logs que coincidan con los filtros.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                                        <th className="px-6 py-4 w-10">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                checked={filteredSystemLogs.length > 0 && selectedLogs.length === filteredSystemLogs.length}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedLogs(filteredSystemLogs.map(l => l.id));
                                                                    } else {
                                                                        setSelectedLogs([]);
                                                                    }
                                                                }}
                                                            />
                                                        </th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nivel</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mensaje</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ruta / Método</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario</th>
                                                        <th className="px-6 py-4 text-right"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {filteredSystemLogs.map((log, i) => (
                                                        <tr key={i} className={`hover:bg-slate-50/50 transition-colors group ${selectedLogs.includes(log.id) ? 'bg-indigo-50/30' : ''}`}>
                                                            <td className="px-6 py-4">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                    checked={selectedLogs.includes(log.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setSelectedLogs([...selectedLogs, log.id]);
                                                                        } else {
                                                                            setSelectedLogs(selectedLogs.filter(id => id !== log.id));
                                                                        }
                                                                    }}
                                                                />
                                                            </td>
                                                            <td className="px-6 py-4 text-[10px] font-black text-slate-500 tabular-nums">
                                                                {new Date(log.created_at).toLocaleString()}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${log.level === 'error' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                                    {log.level}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className="text-xs font-bold text-slate-800">{log.message}</p>
                                                                {log.stack_trace && (
                                                                    <details className="mt-2">
                                                                        <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-indigo-500 font-bold uppercase tracking-widest">Stack Trace</summary>
                                                                        <pre className="mt-2 p-4 bg-slate-900 text-slate-300 text-[10px] rounded-xl overflow-x-auto font-mono max-h-40">
                                                                            {log.stack_trace}
                                                                        </pre>
                                                                    </details>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[9px] font-black bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{log.method}</span>
                                                                    <span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">{log.path}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-xs font-bold text-slate-500">
                                                                {log.user_name || 'Sistema'}
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <button
                                                                    onClick={() => handleDeleteWorkshopLogs(showLogsModal.slug, [log.id])}
                                                                    className="p-2 text-slate-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* File Logs */}
                            <section className="space-y-6">
                                <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-widest flex items-center gap-2">
                                    <AlertCircle size={20} className="text-red-500" />
                                    Logs de Emergencia (Archivo)
                                </h3>
                                <div className="space-y-4">
                                    {filteredFileLogs.length === 0 ? (
                                        <div className="bg-white p-10 rounded-[2rem] border border-slate-100 text-center">
                                            <p className="text-slate-400 font-bold italic">No hay logs de emergencia que coincidan.</p>
                                        </div>
                                    ) : (
                                        filteredFileLogs.map((log, i) => (
                                            <div key={i} className="bg-slate-900 rounded-3xl p-6 border border-slate-800 group hover:border-red-500/50 transition-all">
                                                <div className="flex justify-between items-start mb-4">
                                                    <span className="px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-[9px] font-black uppercase tracking-widest">Critico - Error de Archivo</span>
                                                    <span className="text-[10px] font-black text-slate-500 tabular-nums">{new Date(log.timestamp).toLocaleString()}</span>
                                                </div>
                                                <p className="text-red-400 font-black text-sm mb-4 leading-relaxed">{log.message}</p>
                                                <pre className="p-4 bg-black/50 rounded-2xl text-[10px] text-slate-500 font-mono overflow-x-auto whitespace-pre-wrap">
                                                    {log.stack}
                                                </pre>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
