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
    CheckCircle, // Added CheckCircle
    Trash2,
    ShieldCheck,
    RefreshCw,
    Image as ImageIcon,
    AlertCircle,
    MessageSquare,
    X,
    Eye,
    EyeOff,
    LifeBuoy,
    Send,
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
    Upload,
    History,
    Calendar,
    Globe,
    ChevronDown,
    Zap,
    Thermometer,
    HardDrive,
    Cpu,
    Server,
    Clock,
    Mail,
    Wand2,
    Bell,
    Megaphone,
    AlertTriangle,
    Info,
    CalendarCheck,
    BarChart3,
    Activity as ActivityIcon
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
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
    const [showWorkshopAuditModal, setShowWorkshopAuditModal] = useState<Workshop | null>(null);
    const [workshopAuditLogs, setWorkshopAuditLogs] = useState<any[]>([]);
    const [loadingWorkshopAudit, setLoadingWorkshopAudit] = useState(false);
    const [expandedAuditIds, setExpandedAuditIds] = useState<number[]>([]);
    const [systemHealth, setSystemHealth] = useState<any>(null);
    const [showHealthMonitor, setShowHealthMonitor] = useState(false);
    const [workshopEmailStatus, setWorkshopEmailStatus] = useState<Record<string, any>>({});
    const [runningMigration, setRunningMigration] = useState(false);
    const [anomalies, setAnomalies] = useState<any[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
    const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', type: 'info' });
    const [tickets, setTickets] = useState<any[]>([]);
    const [showTicketsModal, setShowTicketsModal] = useState(false);
    const [showOrderDetailModal, setShowOrderDetailModal] = useState<any>(null); // Simplified
    const [chainSyncStatus, setChainSyncStatus] = useState<Record<number, any>>({});
    const [showSyncErrorsModal, setShowSyncErrorsModal] = useState<number | null>(null);
    const [pollingSync, setPollingSync] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [replyText, setReplyText] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
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
    const [showReportsModal, setShowReportsModal] = useState(false);
    const [globalReports, setGlobalReports] = useState<any>(null);
    const [loadingGlobalReports, setLoadingGlobalReports] = useState(false);
    const [comparisonSort, setComparisonSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'orders_this_month', dir: 'desc' });
    const [chains, setChains] = useState<any[]>([]);
    const [expandedChains, setExpandedChains] = useState<Set<number>>(new Set());
    const [showNewChainModal, setShowNewChainModal] = useState(false);
    const [newChain, setNewChain] = useState({ name: '', slug: '', visibility_level: 'summary', tenant_slugs: [] as string[] });
    const [newChainUser, setNewChainUser] = useState({ name: '', email: '', password: '', can_see_financials: false });
    const [chainUserTarget, setChainUserTarget] = useState<number | null>(null);
    const [savingChain, setSavingChain] = useState(false);
    const [selectedChainFilter, setSelectedChainFilter] = useState('all');
    const { config } = useConfig();
    const { notify } = useNotification();
    const router = useRouter();

    useEffect(() => {
        fetchData();
        fetchTickets();
    }, []);

    useEffect(() => {
        if (showManageModal) {
            fetchWorkshopBackups(showManageModal.slug);
        }
    }, [showManageModal]);

    const fetchGlobalReports = async () => {
        setLoadingGlobalReports(true);
        try {
            const res = await superApi.get('/reports');
            setGlobalReports(res.data);
            setShowReportsModal(true);
        } catch (err) {
            notify('error', 'Error al cargar reporte global');
        } finally {
            setLoadingGlobalReports(false);
        }
    };

    const fetchTickets = async () => {
        try {
            const res = await superApi.get('/tickets');
            setTickets(res.data);
        } catch (err) {
            console.error('Error fetching tickets:', err);
        }
    };

    const handleReplyTicket = async (ticketId: number) => {
        if (!replyText) return notify('warning', 'Escribe una respuesta');
        setSendingReply(true);
        try {
            await superApi.post(`/tickets/${ticketId}/reply`, { reply: replyText });
            notify('success', 'Respuesta enviada correctamente');
            setReplyText('');
            setSelectedTicket(null);
            fetchTickets();
        } catch (err) {
            notify('error', 'Error al enviar respuesta');
        } finally {
            setSendingReply(false);
        }
    };

    const handleUpdateTicketStatus = async (ticketId: number, status: string) => {
        try {
            await superApi.put(`/tickets/${ticketId}/status`, { status });
            notify('success', 'Estado actualizado');
            fetchTickets();
            if (selectedTicket?.id === ticketId) {
                setSelectedTicket({ ...selectedTicket, status });
            }
        } catch (err) {
            notify('error', 'Error al actualizar estado');
        }
    };

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

    const fetchChainSyncStatus = async (chainId: number) => {
        try {
            const res = await superApi.get(`/chains/${chainId}/sync-status`);
            setChainSyncStatus(prev => ({ ...prev, [chainId]: res.data }));
        } catch (e) {
            console.error('Error fetching sync status', e);
        }
    };

    useEffect(() => {
        // Fetch all chains sync status initially
        chains.forEach(c => fetchChainSyncStatus(c.id));

        const interval = setInterval(() => {
            // Poll all chains that have pending jobs OR are expanded
            chains.forEach(c => {
                const status = chainSyncStatus[c.id];
                if (expandedChains.has(c.id) || (status && status.pending > 0)) {
                    fetchChainSyncStatus(c.id);
                }
            });
        }, 5000);
        return () => clearInterval(interval);
    }, [chains, expandedChains, chainSyncStatus]);

    const fetchData = async () => {
        try {
            const [wResponse, sResponse, hResponse, aResponse, annResponse, chainsRes] = await Promise.all([
                superApi.get('/workshops'),
                superApi.get('/stats'),
                superApi.get('/health'),
                superApi.get('/anomalies'),
                superApi.get('/announcements'),
                superApi.get('/chains').catch(() => ({ data: [] }))
            ]);
            setWorkshops(wResponse.data);
            setStats(sResponse.data);
            setSystemHealth(hResponse.data);
            setAnomalies(aResponse.data);
            setAnnouncements(annResponse.data);
            setChains(chainsRes.data || []);

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

    const toggleChain = (chainId: number) => {
        setExpandedChains(prev => {
            const next = new Set(prev);
            if (next.has(chainId)) {
                next.delete(chainId);
            } else {
                next.add(chainId);
            }
            return next;
        });
    };

    const handleCreateChain = async () => {
        if (!newChain.name || !newChain.slug) return notify('warning', 'Nombre y slug requeridos');
        setSavingChain(true);
        try {
            await superApi.post('/chains', newChain);
            setShowNewChainModal(false);
            setNewChain({ name: '', slug: '', visibility_level: 'summary', tenant_slugs: [] });
            const res = await superApi.get('/chains');
            setChains(res.data);
            notify('success', 'Cadena creada');
        } catch (err) {
            notify('error', 'Error al crear cadena');
        } finally {
            setSavingChain(false);
        }
    };

    const handleDecoupleWorkshop = async (chainId: number, slug: string, workshopName: string) => {
        try {
            const preview = await superApi.delete(`/chains/${chainId}/members/${slug}?preview=true`);
            const { to_keep, to_lose } = preview.data;
            if (!confirm(`Desacoplar "${workshopName}"?\n\n✅ Retiene: ${to_keep} clientes\n❌ Pierde: ${to_lose} clientes\n\n¿Confirmar?`)) return;
            await superApi.delete(`/chains/${chainId}/members/${slug}`);
            const res = await superApi.get('/chains');
            setChains(res.data);
            fetchData();
            notify('success', 'Taller desacoplado');
        } catch (err) {
            notify('error', 'Error al desacoplar');
        }
    };

    const handleAddToChain = async (chainId: number, slug: string) => {
        if (!slug) return;
        try {
            await superApi.post(`/chains/${chainId}/members`, { tenant_slug: slug });
            const res = await superApi.get('/chains');
            setChains(res.data);
            fetchData();
            notify('success', 'Taller agregado a la cadena');
        } catch (err) {
            notify('error', 'Error al agregar taller');
        }
    };

    const handleResyncChain = async (chainId: number) => {
        try {
            const res = await superApi.post(`/chains/${chainId}/resync`);
            notify('success', `Resincronización iniciada para ${res.data.members} talleres.`);
        } catch (err) {
            notify('error', 'Error al iniciar resincronización');
        }
    };

    const handleCreateChainUser = async (chainId: number) => {
        if (!newChainUser.name || !newChainUser.email || !newChainUser.password)
            return notify('warning', 'Completá todos los campos');
        try {
            await superApi.post(`/chains/${chainId}/users`, newChainUser);
            setNewChainUser({ name: '', email: '', password: '', can_see_financials: false });
            setChainUserTarget(null);
            const res = await superApi.get('/chains');
            setChains(res.data);
            notify('success', 'Usuario creado');
        } catch (err) {
            notify('error', 'El email ya existe en esta cadena');
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
            if (res.data.user.language) {
                localStorage.setItem('language', res.data.user.language);
            }
            window.location.href = `/${slug}/dashboard`;
        } catch (err) {
            notify('error', 'Error al conectar con el taller');
        }
    };

    const handleGoToAudit = async (slug: string) => {
        try {
            const res = await superApi.post(`/impersonate/${slug}`);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            localStorage.setItem('current_slug', slug);
            window.location.href = `/${slug}/dashboard/settings?tab=audit`;
        } catch (err) {
            notify('error', 'Error al conectar con la auditoría del taller');
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

    const handleDataOperation = async (slug: string, op: 'clear' | 'seed', type: 'operational' | 'users' | 'templates') => {
        let msg = '';
        if (op === 'clear') {
            if (type === 'operational') msg = '¿ESTÁS SEGURO? Esto borrará todos los datos operativos (órdenes, clientes, etc.).';
            if (type === 'users') msg = '¿ESTÁS SEGURO? Esto borrará todos los usuarios y roles (excepto el administrador).';
            if (type === 'templates') msg = '¿ESTÁS SEGURO? Esto reseteará todas las plantillas de mensajes.';
        } else {
            if (type === 'operational') msg = '¿Generar datos de prueba operativos?';
            if (type === 'users') msg = '¿Generar usuario mecánico de prueba?';
        }

        if (msg && !confirm(msg)) return;

        try {
            await superApi.post(`/workshops/${slug}/${op}`, { type });
            notify('success', 'Operación completada con éxito');
            fetchData();
        } catch (err) {
            notify('error', 'Error al ejecutar operación');
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

    const filteredWorkshops = workshops.filter(w => {
        const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase()) ||
            w.slug.toLowerCase().includes(search.toLowerCase());

        const matchesChain = selectedChainFilter === 'all' || (() => {
            const chain = chains.find(c => c.id === parseInt(selectedChainFilter));
            return chain?.members?.some((m: any) => m.tenant_slug === w.slug);
        })();

        return matchesSearch && matchesChain;
    });

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

    const fetchWorkshopAuditLogs = async (slug: string) => {
        setLoadingWorkshopAudit(true);
        setExpandedAuditIds([]);
        try {
            const res = await superApi.get(`/workshops/${slug}/audit`);
            setWorkshopAuditLogs(res.data);
        } catch (err) {
            notify('error', 'Error al cargar auditoría del taller');
        } finally {
            setLoadingWorkshopAudit(false);
        }
    };

    const toggleExpandAudit = (id: number) => {
        setExpandedAuditIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const checkWorkshopEmail = async (slug: string) => {
        setWorkshopEmailStatus(prev => ({ ...prev, [slug]: { loading: true } }));
        try {
            const res = await superApi.get(`/workshops/${slug}/email-check`);
            setWorkshopEmailStatus(prev => ({ ...prev, [slug]: { ...res.data, loading: false } }));
        } catch (err) {
            setWorkshopEmailStatus(prev => ({ ...prev, [slug]: { error: true, loading: false } }));
        }
    };

    useEffect(() => {
        if (showWorkshopAuditModal) {
            fetchWorkshopAuditLogs(showWorkshopAuditModal.slug);
        }
    }, [showWorkshopAuditModal]);

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

    const handleCreateAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await superApi.post('/announcements', newAnnouncement);
            setNewAnnouncement({ title: '', content: '', type: 'info' });
            fetchData();
            notify('success', 'Anuncio publicado correctamente');
        } catch (err) {
            notify('error', 'Error al publicar anuncio');
        }
    };

    const handleToggleAnnouncement = async (id: number) => {
        try {
            await superApi.put(`/announcements/${id}/toggle`);
            fetchData();
        } catch (err) {
            notify('error', 'Error al modificar anuncio');
        }
    };

    const handleDeleteAnnouncement = async (id: number) => {
        if (!confirm('¿Eliminar este anuncio permanentemente?')) return;
        try {
            await superApi.delete(`/announcements/${id}`);
            fetchData();
            notify('success', 'Anuncio eliminado');
        } catch (err) {
            notify('error', 'Error al eliminar anuncio');
        }
    };

    const handleMigrateAll = async () => {
        if (!confirm('¿Desea propagar cambios de estructura a TODOS los talleres? Esta operación inicializará todas las bases de datos con las últimas migraciones.')) return;
        setRunningMigration(true);
        try {
            const res = await superApi.post('/workshops/migrate');
            notify('success', `Migración completada: ${res.data.success} talleres actualizados.`);
            if (res.data.failed > 0) {
                notify('warning', `${res.data.failed} talleres fallaron al migrar.`);
            }
            fetchData();
        } catch (err) {
            notify('error', 'Error al ejecutar la migración maestra');
        } finally {
            setRunningMigration(false);
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
                            onClick={() => setShowAnnouncementsModal(true)}
                            className="bg-slate-800 hover:bg-rose-600 p-2.5 rounded-xl transition-all group border border-slate-700 hover:border-rose-500/50 relative"
                            title="Gestionar Anuncios Globales"
                        >
                            <Bell size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                            {announcements.filter(a => a.is_active).length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full animate-bounce">
                                    {announcements.filter(a => a.is_active).length}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => setShowTicketsModal(true)}
                            className="bg-slate-800 hover:bg-blue-600 p-2.5 rounded-xl transition-all group border border-slate-700 hover:border-blue-500/50 relative"
                            title="Reportes de Problemas de Talleres"
                        >
                            <LifeBuoy size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                            {tickets.filter(t => t.status === 'open').length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[10px] font-black flex items-center justify-center rounded-full animate-pulse">
                                    {tickets.filter(t => t.status === 'open').length}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => fetchGlobalReports()}
                            disabled={loadingGlobalReports}
                            className={`p-2.5 rounded-xl transition-all group border ${showReportsModal ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white hover:border-indigo-500/50'}`}
                            title="Analytics & Dashboard Global"
                        >
                            {loadingGlobalReports ? <RefreshCw className="animate-spin" size={20} /> : <BarChart3 size={20} />}
                        </button>

                        <button
                            onClick={() => setShowHealthMonitor(!showHealthMonitor)}
                            className={`p-2.5 rounded-xl transition-all group border ${showHealthMonitor ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white hover:border-emerald-500/50'}`}
                            title="Monitoreo de Salud del Sistema"
                        >
                            <Activity size={20} className={showHealthMonitor ? 'animate-pulse' : ''} />
                        </button>

                        <button
                            onClick={() => handleMigrateAll()}
                            disabled={runningMigration}
                            className={`bg-slate-800 hover:bg-amber-600 p-2.5 rounded-xl transition-all group border border-slate-700 hover:border-amber-500/50 ${runningMigration ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Propagar Estructura de DB (Migraciones)"
                        >
                            <Wand2 size={20} className={`text-slate-400 group-hover:text-white transition-colors ${runningMigration ? 'animate-spin' : ''}`} />
                        </button>

                        <button
                            onClick={() => handleDownloadBackup()}
                            className="bg-slate-800 hover:bg-emerald-600 p-2.5 rounded-xl transition-all group border border-slate-700 hover:border-emerald-500/50"
                            title="Respaldar TODO el Sistema"
                        >
                            <Archive size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                        </button>

                        <button
                            onClick={() => router.push('/superadmin/audit')}
                            className="bg-slate-800 hover:bg-indigo-600 p-2.5 rounded-xl transition-all group border border-slate-700 hover:border-indigo-500/50"
                            title="Auditoría de Sistema"
                        >
                            <ShieldCheck size={20} className="text-slate-400 group-hover:text-white transition-colors" />
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
                {/* System Vital Signs */}
                {showHealthMonitor && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-px flex-grow bg-slate-100"></div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
                                <Activity size={14} className="text-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Monitoreo de Infraestructura en Tiempo Real</span>
                            </div>
                            <div className="h-px flex-grow bg-slate-100"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                                <div className="absolute -right-4 -top-4 text-indigo-50 group-hover:text-indigo-100 transition-colors -rotate-12">
                                    <Cpu size={100} />
                                </div>
                                <div className="relative z-10">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Carga del Procesador</p>
                                    <div className="flex items-end gap-2 mb-2">
                                        <h4 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
                                            {((systemHealth?.system?.cpuLoad?.[0] || 0) * 10).toFixed(1)}%
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-400 mb-1">/ {systemHealth?.system?.cpus || 0} Cores</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${(systemHealth?.system?.cpuLoad?.[0] || 0) * 10 > 80 ? 'bg-red-500' : 'bg-indigo-600'}`}
                                            style={{ width: `${Math.min(((systemHealth?.system?.cpuLoad?.[0] || 0) * 10), 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                                <div className="absolute -right-4 -top-4 text-emerald-50 group-hover:text-emerald-100 transition-colors -rotate-12">
                                    <Zap size={100} />
                                </div>
                                <div className="relative z-10">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Memoria del Sistema</p>
                                    <div className="flex items-end gap-2 mb-2">
                                        <h4 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
                                            {(systemHealth?.system?.memory?.used / 1024 / 1024 / 1024 || 0).toFixed(1)} GB
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-400 mb-1">Uso Actual</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-1000"
                                            style={{ width: `${systemHealth?.system?.memory?.percent || 0}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                                <div className="absolute -right-4 -top-4 text-amber-50 group-hover:text-amber-100 transition-colors -rotate-12">
                                    <HardDrive size={100} />
                                </div>
                                <div className="relative z-10">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Bases de Datos y Archivos</p>
                                    <div className="flex items-end gap-2 mb-2">
                                        <h4 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
                                            {(systemHealth?.storage?.total / 1024 / 1024 || 0).toFixed(1)} MB
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-400 mb-1">Ocupado</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                                            <span className="text-[9px] font-bold text-slate-500 uppercase">Tenants: {(systemHealth?.storage?.tenants / 1024 / 1024 || 0).toFixed(0)}MB</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                            <span className="text-[9px] font-bold text-slate-500 uppercase">Backup: {(systemHealth?.storage?.backups / 1024 / 1024 || 0).toFixed(0)}MB</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                                <div className="absolute -right-4 -top-4 text-sky-50 group-hover:text-sky-100 transition-colors -rotate-12">
                                    <Server size={100} />
                                </div>
                                <div className="relative z-10">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Estabilidad del Servidor</p>
                                    <div className="flex items-end gap-2 mb-2">
                                        <h4 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
                                            {Math.floor((systemHealth?.system?.uptime || 0) / 3600)}h {Math.floor(((systemHealth?.system?.uptime || 0) % 3600) / 60)}m
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-400 mb-1">Uptime</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Servidor Online</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Anomalies & Critical Alerts */}
                {anomalies.length > 0 && (
                    <div className="mb-12 animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle size={18} className="text-rose-500" />
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest italic">Alertas de Seguridad y Salud</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {anomalies.map((a, idx) => (
                                <div key={idx} className="bg-rose-50 border border-rose-100 p-4 rounded-3xl flex items-start gap-4 hover:shadow-lg hover:shadow-rose-500/10 transition-all cursor-default">
                                    <div className={`p-2 rounded-xl ${a.severity === 'warning' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'}`}>
                                        {a.type === 'inactivity' ? <Clock size={16} /> : a.type === 'storage' ? <HardDrive size={16} /> : <AlertCircle size={16} />}
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{a.name}</h4>
                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">/{a.slug}</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-widest">{a.message}</p>
                                        {a.last_seen && (
                                            <p className="text-[9px] text-slate-400 mt-2 font-black italic">Visto por última vez: {new Date(a.last_seen).toLocaleDateString()}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

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

                {/* ── Sección de Cadenas ───────────────────────────────────────── */}
                {
                    chains.length > 0 && (
                        <div className="space-y-4 mb-12">
                            {/* Header de sección */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 w-full">
                                    <div className="h-px w-8 bg-violet-300" />
                                    <h3 className="text-[10px] font-black text-violet-600 uppercase tracking-[0.3em] whitespace-nowrap">
                                        Cadenas Multi-Sucursal
                                    </h3>
                                    <div className="h-px flex-grow bg-violet-100" />
                                    <span className="text-[9px] font-black bg-violet-100 text-violet-600 px-3 py-1 rounded-full whitespace-nowrap">
                                        {chains.length} cadena{chains.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>

                            {/* Cards de cadenas */}
                            <div className="space-y-3">
                                {chains.map(chain => {
                                    const isExpanded = expandedChains.has(chain.id);
                                    const memberSlugs = chain.members?.map((m: any) => m.tenant_slug) || [];
                                    const availableWorkshops = workshops.filter(w => !memberSlugs.includes(w.slug));

                                    return (
                                        <div key={chain.id} className={`bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-violet-200 shadow-xl shadow-violet-500/5' : 'border-slate-100 shadow-sm hover:border-violet-100'}`}>

                                            {/* Header de la cadena — clickeable para expandir */}
                                            <div
                                                className="p-6 flex items-center justify-between cursor-pointer group"
                                                onClick={() => toggleChain(chain.id)}
                                            >
                                                <div className="flex items-center gap-5">
                                                    {/* Ícono cadena */}
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isExpanded ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-600 group-hover:bg-violet-100'}`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                                                            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-3">
                                                            <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">{chain.name}</h4>
                                                            <span className="text-[9px] font-black bg-violet-100 text-violet-600 px-2 py-1 rounded-lg uppercase tracking-widest">
                                                                /{chain.slug}
                                                            </span>
                                                            <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg uppercase tracking-widest">
                                                                {chain.visibility_level === 'summary' ? 'Solo resumen' : chain.visibility_level === 'no_prices' ? 'Sin precios' : 'Completo'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                                                            {chain.members?.map((m: any) => (
                                                                <span key={m.tenant_slug} className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
                                                                    {m.workshop_name || m.tenant_slug}
                                                                </span>
                                                            ))}
                                                            {chain.members?.length === 0 && (
                                                                <span className="text-[10px] font-bold text-slate-300 italic">Sin talleres aún</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {chainSyncStatus[chain.id]?.pending > 0 && (
                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse border border-amber-100">
                                                            <Activity size={10} /> {chainSyncStatus[chain.id].pending} Pendientes
                                                        </div>
                                                    )}
                                                    {chainSyncStatus[chain.id]?.failed > 0 && (
                                                        <div
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                setShowSyncErrorsModal(chain.id);
                                                            }}
                                                            className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                                                        >
                                                            <AlertTriangle size={10} /> {chainSyncStatus[chain.id].failed} Error
                                                        </div>
                                                    )}
                                                    {chainSyncStatus[chain.id] && chainSyncStatus[chain.id].pending === 0 && chainSyncStatus[chain.id].failed === 0 && (
                                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                                                            <Check size={10} /> Sincronizado
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            handleResyncChain(chain.id);
                                                        }}
                                                        className="px-4 py-2 bg-slate-50 text-slate-500 hover:bg-indigo-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                                                        title="Sincronizar clientes y vehículos en toda la cadena"
                                                    >
                                                        <RefreshCw size={12} className={expandedChains.has(chain.id) && (chainSyncStatus[chain.id]?.pending > 0) ? 'animate-spin' : ''} /> Sync
                                                    </button>
                                                    <a
                                                        href={`/chain/${chain.slug}/dashboard`}
                                                        target="_blank"
                                                        onClick={e => e.stopPropagation()}
                                                        className="px-4 py-2 bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                                                    >
                                                        <ExternalLink size={12} /> Panel
                                                    </a>
                                                    <div className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-violet-100 text-violet-600' : 'bg-slate-50 text-slate-400'}`}>
                                                        <ChevronDown size={18} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Panel expandible */}
                                            {isExpanded && (
                                                <div className="border-t border-violet-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

                                                        {/* ── Talleres miembros ── */}
                                                        <div className="space-y-4">
                                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                Talleres en esta cadena
                                                            </h5>

                                                            <div className="space-y-2">
                                                                {chain.members?.map((m: any) => (
                                                                    <div key={m.tenant_slug} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group/member">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
                                                                                <span className="text-[8px] font-black text-violet-600 uppercase">{m.tenant_slug.charAt(0)}</span>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-black text-slate-900 uppercase italic leading-tight">{m.workshop_name || m.tenant_slug}</p>
                                                                                <p className="text-[9px] font-bold text-slate-400">/{m.tenant_slug}</p>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleDecoupleWorkshop(chain.id, m.tenant_slug, m.workshop_name || m.tenant_slug)}
                                                                            className="opacity-0 group-hover/member:opacity-100 transition-opacity text-[9px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest px-3 py-1.5 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all font-bold"
                                                                        >
                                                                            Desacoplar
                                                                        </button>
                                                                    </div>
                                                                ))}

                                                                {/* Agregar taller existente */}
                                                                {availableWorkshops.length > 0 && (
                                                                    <select
                                                                        defaultValue=""
                                                                        onChange={e => { handleAddToChain(chain.id, e.target.value); e.target.value = ''; }}
                                                                        className="w-full bg-violet-50 border-2 border-violet-100 border-dashed rounded-2xl px-4 py-3 text-[10px] font-black text-violet-600 uppercase tracking-widest focus:outline-none focus:border-violet-400 transition-all cursor-pointer"
                                                                    >
                                                                        <option value="" disabled>+ Agregar taller a esta cadena</option>
                                                                        {availableWorkshops.map(w => (
                                                                            <option key={w.slug} value={w.slug}>{w.name} (/{w.slug})</option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                                                {availableWorkshops.length === 0 && (
                                                                    <p className="text-[10px] font-bold text-slate-300 italic text-center py-2">
                                                                        Todos los talleres ya pertenecen a esta cadena
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Visibilidad */}
                                                            <div className="pt-4 border-t border-slate-100">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Visibilidad cruzada entre talleres</p>
                                                                <div className="flex gap-2">
                                                                    {([['summary', 'Solo resumen'], ['no_prices', 'Sin precios'], ['full', 'Completo']] as const).map(([val, label]) => (
                                                                        <button
                                                                            key={val}
                                                                            onClick={async () => {
                                                                                await superApi.patch(`/chains/${chain.id}`, { visibility_level: val });
                                                                                const res = await superApi.get('/chains');
                                                                                setChains(res.data);
                                                                                notify('success', 'Visibilidad actualizada');
                                                                            }}
                                                                            className={`flex-grow py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${chain.visibility_level === val ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-400 border-slate-200 hover:border-violet-300 hover:text-violet-600'}`}
                                                                        >
                                                                            {label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* ── Usuarios del panel chain ── */}
                                                        <div className="space-y-4">
                                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                Usuarios del panel chain
                                                            </h5>

                                                            <div className="space-y-2">
                                                                {chain.users?.length === 0 && (
                                                                    <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                                        <p className="text-[10px] font-bold text-slate-300 uppercase">Sin usuarios aún</p>
                                                                    </div>
                                                                )}
                                                                {chain.users?.map((u: any) => (
                                                                    <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group/user">
                                                                        <div>
                                                                            <p className="text-sm font-black text-slate-900 uppercase italic leading-tight">{u.name}</p>
                                                                            <p className="text-[9px] font-bold text-slate-400">{u.email}</p>
                                                                            {u.can_see_financials ? (
                                                                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Ve ingresos</span>
                                                                            ) : (
                                                                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Sin ingresos</span>
                                                                            )}
                                                                        </div>
                                                                        <button
                                                                            onClick={async () => {
                                                                                if (!confirm(`¿Eliminar usuario ${u.name}?`)) return;
                                                                                await superApi.delete(`/chains/${chain.id}/users/${u.id}`);
                                                                                const res = await superApi.get('/chains');
                                                                                setChains(res.data);
                                                                                notify('success', 'Usuario eliminado');
                                                                            }}
                                                                            className="opacity-0 group-hover/user:opacity-100 transition-opacity p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Formulario nuevo usuario */}
                                                            {chainUserTarget === chain.id ? (
                                                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nuevo usuario</p>
                                                                    <input
                                                                        placeholder="Nombre completo"
                                                                        value={newChainUser.name}
                                                                        onChange={e => setNewChainUser({ ...newChainUser, name: e.target.value })}
                                                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-violet-400 transition-all font-bold"
                                                                    />
                                                                    <input
                                                                        type="email"
                                                                        placeholder="Email"
                                                                        value={newChainUser.email}
                                                                        onChange={e => setNewChainUser({ ...newChainUser, email: e.target.value })}
                                                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-violet-400 transition-all font-bold"
                                                                    />
                                                                    <input
                                                                        type="password"
                                                                        placeholder="Contraseña"
                                                                        value={newChainUser.password}
                                                                        onChange={e => setNewChainUser({ ...newChainUser, password: e.target.value })}
                                                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-violet-400 transition-all font-bold"
                                                                    />
                                                                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-white rounded-xl border border-slate-200">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={newChainUser.can_see_financials}
                                                                            onChange={e => setNewChainUser({ ...newChainUser, can_see_financials: e.target.checked })}
                                                                            className="w-4 h-4 rounded text-violet-600"
                                                                        />
                                                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Puede ver ingresos financieros</span>
                                                                    </label>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => { setChainUserTarget(null); setNewChainUser({ name: '', email: '', password: '', can_see_financials: false }); }}
                                                                            className="flex-grow py-2.5 rounded-xl bg-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 transition-all"
                                                                        >
                                                                            Cancelar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleCreateChainUser(chain.id)}
                                                                            className="flex-[2] py-2.5 rounded-xl bg-violet-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/20"
                                                                        >
                                                                            Crear Usuario
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setChainUserTarget(chain.id)}
                                                                    className="w-full py-3 bg-violet-50 border-2 border-violet-100 border-dashed rounded-2xl text-[10px] font-black text-violet-600 uppercase tracking-widest hover:bg-violet-100 transition-all flex items-center justify-center gap-2"
                                                                >
                                                                    <Plus size={14} /> Agregar Usuario
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )
                }

                {/* Workshops List Section */}
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tight">Ecosistema de Talleres</h3>
                            <p className="text-slate-500 font-bold text-sm tracking-wide">Gestiona el estado, branding y seguridad de cada instancia.</p>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <select
                                value={selectedChainFilter}
                                onChange={(e) => setSelectedChainFilter(e.target.value)}
                                className="bg-white border-2 border-slate-100 px-6 py-4 rounded-3xl w-full md:w-64 font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer appearance-none"
                            >
                                <option value="all">Ver todas las cadenas</option>
                                {chains.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>

                            <button
                                onClick={() => setShowNewChainModal(true)}
                                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-violet-500/20 w-full md:w-auto"
                            >
                                <Plus size={16} /> Nueva Cadena
                            </button>
                            <div className="relative w-full md:w-auto">
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
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredWorkshops.map(w => {
                            const chain = chains.find(c => c.members?.some((m: any) => m.tenant_slug === w.slug));
                            return (
                                <div key={w.id} className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden">
                                    {chain && (
                                        <div className="absolute top-0 left-0 w-full bg-violet-600 py-1.5 px-8 flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                                            <span className="text-[8px] font-black text-white uppercase tracking-widest">Sucursal de {chain.name}</span>
                                        </div>
                                    )}
                                    <div className={`absolute ${chain ? 'top-6' : 'top-0'} right-0 p-8 flex gap-2`}>
                                        <button
                                            onClick={() => setShowWorkshopAuditModal(w)}
                                            className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-slate-100"
                                            title="Ver Auditoría del Taller"
                                        >
                                            <History size={20} />
                                        </button>
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
                                        <div className="pt-1 flex-grow">
                                            <div className="flex justify-between items-start">
                                                <h4 className="text-2xl font-black text-slate-900 tracking-tighter italic leading-tight line-clamp-1 pr-6">{w.name}</h4>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); checkWorkshopEmail(w.slug); }}
                                                    className={`p-2 rounded-xl transition-all ${workshopEmailStatus[w.slug]?.loading
                                                        ? 'bg-slate-100 text-slate-400 animate-spin'
                                                        : workshopEmailStatus[w.slug]?.smtp?.status === 'ok' && workshopEmailStatus[w.slug]?.imap?.status === 'ok'
                                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                            : workshopEmailStatus[w.slug]?.smtp?.status === 'error' || workshopEmailStatus[w.slug]?.imap?.status === 'error'
                                                                ? 'bg-red-50 text-red-600 border border-red-100'
                                                                : 'bg-slate-50 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100'
                                                        }`}
                                                    title="Verificar Conexión de Email"
                                                >
                                                    <Mail size={16} />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${w.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                                                    }`}>
                                                    {w.status === 'active' ? 'Operativo' : 'Inactivo'}
                                                </span>
                                                {(() => {
                                                    const chain = chains.find(c => c.members?.some((m: any) => m.tenant_slug === w.slug));
                                                    if (!chain) return null;
                                                    return (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 border border-violet-200">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                                                            {chain.name}
                                                        </span>
                                                    );
                                                })()}
                                                {workshopEmailStatus[w.slug] && !workshopEmailStatus[w.slug].loading && !workshopEmailStatus[w.slug].error && (
                                                    <div className="flex gap-1">
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${workshopEmailStatus[w.slug].smtp.status === 'ok' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>SMTP</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${workshopEmailStatus[w.slug].imap.status === 'ok' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>IMAP</span>
                                                    </div>
                                                )}
                                            </div>
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
                            );
                        })}
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
                                            <div className="pt-4 space-y-4">
                                                <div className="flex items-center gap-2 px-2">
                                                    <Wand2 size={14} className="text-indigo-500" />
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Herramientas de Datos (Modo Dev)</label>
                                                </div>

                                                <div className="grid grid-cols-1 gap-4">
                                                    {/* Row 1: Clear */}
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Limpiar (Wipe)</p>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <button
                                                                onClick={() => handleDataOperation(showManageModal.slug, 'clear', 'operational')}
                                                                className="bg-white hover:bg-rose-500 text-rose-500 hover:text-white p-2.5 rounded-xl font-black text-[9px] uppercase tracking-tighter transition-all border border-rose-100 shadow-sm"
                                                            >
                                                                Operativos
                                                            </button>
                                                            <button
                                                                onClick={() => handleDataOperation(showManageModal.slug, 'clear', 'users')}
                                                                className="bg-white hover:bg-rose-500 text-rose-500 hover:text-white p-2.5 rounded-xl font-black text-[9px] uppercase tracking-tighter transition-all border border-rose-100 shadow-sm"
                                                            >
                                                                Usuarios
                                                            </button>
                                                            <button
                                                                onClick={() => handleDataOperation(showManageModal.slug, 'clear', 'templates')}
                                                                className="bg-white hover:bg-amber-500 text-amber-500 hover:text-white p-2.5 rounded-xl font-black text-[9px] uppercase tracking-tighter transition-all border border-amber-100 shadow-sm"
                                                            >
                                                                Plantillas
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Row 2: Seed */}
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Sembrar (Seed)</p>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <button
                                                                onClick={() => handleDataOperation(showManageModal.slug, 'seed', 'operational')}
                                                                className="bg-white hover:bg-indigo-600 text-indigo-600 hover:text-white p-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border border-indigo-100 shadow-sm flex items-center justify-center gap-2"
                                                            >
                                                                <Database size={14} />
                                                                Clientes/Órdenes
                                                            </button>
                                                            <button
                                                                onClick={() => handleDataOperation(showManageModal.slug, 'seed', 'users')}
                                                                className="bg-white hover:bg-blue-600 text-blue-600 hover:text-white p-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all border border-blue-100 shadow-sm flex items-center justify-center gap-2"
                                                            >
                                                                <Users size={14} />
                                                                Mecánicos
                                                            </button>
                                                        </div>
                                                    </div>
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

                            <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    {[
                                        { key: 'dashboard', label: 'Dashboard / Estadísticas' },
                                        { key: 'clients', label: 'Gestión de Clientes' },
                                        { key: 'vehicles', label: 'Gestión de Vehículos' },
                                        { key: 'orders', label: 'Gestión de Órdenes / OT' },
                                        { key: 'income', label: 'Reportes de Ingresos' },
                                        { key: 'reports', label: 'Reportes Avanzados / BI' },
                                        { key: 'settings', label: 'Configuración Interna' },
                                        { key: 'users', label: 'Gestión de Usuarios' },
                                        { key: 'roles', label: 'Gestión de Roles' },
                                        { key: 'reminders', label: 'Seguimientos / Recordatorios' },
                                        { key: 'appointments', label: 'Turnos / Calendario' },
                                        { key: 'suppliers', label: 'Gestión de Proveedores' },
                                        { key: 'audit', label: 'Historial de Auditoría / Logs' }
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
                            </div>

                            <div className="mt-8 pt-8 border-t border-slate-50">
                                <button
                                    onClick={() => setShowModulesModal(null)}
                                    className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-95 transition-all text-[10px] uppercase tracking-widest italic"
                                >
                                    Finalizar Configuración
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Workshop Logs Modal */}
            {
                showLogsModal && (
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
                )
            }

            {
                showWorkshopAuditModal && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
                        <div className="bg-slate-50 w-full max-w-5xl h-[85vh] rounded-[4rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-20 duration-500">
                            {/* Header */}
                            <div className="bg-white p-10 border-b border-slate-100 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-3xl">
                                        <History size={32} />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">
                                            Auditoría: {showWorkshopAuditModal.name}
                                        </h2>
                                        <p className="text-slate-400 font-bold text-xs mt-3 uppercase tracking-widest flex items-center gap-2">
                                            <Database size={14} className="text-emerald-400" />
                                            Movimientos registrados en la base del taller
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowWorkshopAuditModal(null)}
                                    className="bg-slate-50 p-4 rounded-3xl text-slate-400 hover:text-slate-900 transition-all hover:rotate-90"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-grow overflow-y-auto p-10">
                                {loadingWorkshopAudit ? (
                                    <div className="h-full flex flex-col items-center justify-center gap-6 text-slate-400">
                                        <RefreshCw size={48} className="animate-spin text-emerald-500" />
                                        <p className="font-black uppercase tracking-[0.3em] text-[10px]">Accediendo a la base de datos distribuida...</p>
                                    </div>
                                ) : workshopAuditLogs.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-300">
                                        <Search size={64} className="opacity-20" />
                                        <p className="font-bold italic">No se encontraron registros de auditoría en este taller.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {workshopAuditLogs.map((log) => {
                                            const isExpanded = expandedAuditIds.includes(log.id);
                                            const actionColors: any = {
                                                'UPDATE_ORDER_ITEM': 'bg-amber-100 text-amber-700 border-amber-200',
                                                'ADD_ORDER_ITEMS': 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                                'CREATE_ORDER': 'bg-blue-100 text-blue-700 border-blue-200',
                                                'DELETE': 'bg-red-100 text-red-700 border-red-200'
                                            };
                                            const colorClass = actionColors[log.action] || 'bg-slate-100 text-slate-700 border-slate-200';

                                            return (
                                                <div
                                                    key={log.id}
                                                    className={`bg-white rounded-[2rem] border transition-all duration-300 ${isExpanded ? 'border-emerald-200 shadow-xl' : 'border-slate-100 shadow-sm hover:border-emerald-100'}`}
                                                >
                                                    <div
                                                        className="p-6 cursor-pointer flex items-center justify-between gap-4"
                                                        onClick={() => toggleExpandAudit(log.id)}
                                                    >
                                                        <div className="flex items-center gap-6 flex-grow">
                                                            <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${colorClass}`}>
                                                                {log.action.replace(/_/g, ' ')}
                                                            </div>
                                                            <div className="space-y-1 flex-grow">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-sm font-black text-slate-800 uppercase italic">
                                                                        {log.user_display_name}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                                        {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(log.created_at).toLocaleString()}</span>
                                                                    <span className="flex items-center gap-1"><Globe size={12} /> {log.ip_address || 'Local'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className={`p-2 rounded-full transition-transform ${isExpanded ? 'bg-emerald-600 text-white rotate-180' : 'bg-slate-50 text-slate-400'}`}>
                                                            <ChevronDown size={18} />
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="px-6 pb-6 pt-2 border-t border-slate-50 animate-in fade-in slide-in-from-top-2 duration-300">
                                                            <div className="mt-4">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Detalle del Evento</p>
                                                                <div className="bg-slate-900 p-5 rounded-2xl overflow-x-auto border border-white/5 shadow-inner">
                                                                    <pre className="text-[11px] font-mono text-emerald-400 leading-relaxed">
                                                                        {(() => {
                                                                            try {
                                                                                const parsed = JSON.parse(log.details);
                                                                                return JSON.stringify(parsed, null, 2);
                                                                            } catch (e) {
                                                                                return log.details;
                                                                            }
                                                                        })()}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Global Announcements Modal */}
            {
                showAnnouncementsModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-end p-6 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="w-full max-w-xl h-full bg-white rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-500">
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-rose-600 text-white">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                                        <Megaphone size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black uppercase tracking-tighter italic">Central de Comunicaciones</h2>
                                        <p className="text-[10px] font-black text-rose-100 uppercase tracking-widest mt-1">Anuncios en Tiempo Real</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAnnouncementsModal(false)}
                                    className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-grow overflow-y-auto p-8 space-y-8">
                                {/* Create New Announcement */}
                                <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 italic flex items-center gap-2">
                                        <PlusCircle size={16} className="text-rose-600" />
                                        Nuevo Anuncio Global
                                    </h3>
                                    <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                                        <input
                                            type="text"
                                            value={newAnnouncement.title}
                                            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                                            placeholder="Título del anuncio..."
                                            className="w-full bg-white border-2 border-slate-100 p-4 rounded-2xl font-black text-sm uppercase tracking-tight focus:border-rose-500 outline-none transition-all"
                                            required
                                        />
                                        <textarea
                                            value={newAnnouncement.content}
                                            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                                            placeholder="Contenido del mensaje..."
                                            className="w-full bg-white border-2 border-slate-100 p-4 rounded-2xl font-bold text-xs focus:border-rose-500 outline-none transition-all min-h-[100px]"
                                            required
                                        />
                                        <div className="flex gap-2">
                                            {['info', 'warning', 'success', 'error'].map(t => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => setNewAnnouncement({ ...newAnnouncement, type: t })}
                                                    className={`flex-grow p-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${newAnnouncement.type === t
                                                        ? 'bg-slate-900 text-white border-slate-900'
                                                        : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'
                                                        }`}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            type="submit"
                                            className="w-full bg-rose-600 hover:bg-rose-700 text-white p-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-rose-500/20"
                                        >
                                            Publicar en toda la Red
                                        </button>
                                    </form>
                                </div>

                                {/* Existing Announcements */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 italic">Historial de Anuncios</h3>
                                    {announcements.length === 0 ? (
                                        <div className="text-center p-12 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                                            <Info size={32} className="mx-auto text-slate-300 mb-2" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No hay anuncios registrados</p>
                                        </div>
                                    ) : (
                                        announcements.map((a: any) => (
                                            <div key={a.id} className={`p-5 rounded-[2rem] border transition-all ${a.is_active ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent grayscale opacity-60'}`}>
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="flex-grow">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`w-2 h-2 rounded-full ${a.type === 'error' ? 'bg-rose-500' :
                                                                a.type === 'warning' ? 'bg-amber-500' :
                                                                    a.type === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'
                                                                }`}></span>
                                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{a.title}</h4>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-600 line-clamp-2">{a.content}</p>
                                                        <p className="text-[8px] font-black text-slate-400 uppercase mt-2 tracking-widest">{new Date(a.created_at).toLocaleString()}</p>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <button
                                                            onClick={() => handleToggleAnnouncement(a.id)}
                                                            className={`p-2 rounded-xl transition-all ${a.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}
                                                            title={a.is_active ? "Desactivar" : "Activar"}
                                                        >
                                                            {a.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAnnouncement(a.id)}
                                                            className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Support Tickets Modal */}
            {
                showTicketsModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-end p-6 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="w-full max-w-4xl h-full bg-white rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-500">
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-blue-600 text-white">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                                        <LifeBuoy size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black uppercase tracking-tighter italic">Centro de Soporte</h2>
                                        <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest mt-1">Gestión de Problemas Reportados</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowTicketsModal(false)}
                                    className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-grow flex overflow-hidden">
                                {/* Tickets List */}
                                <div className="w-1/2 border-r border-slate-100 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Listado de Reportes</p>
                                    {tickets.length === 0 ? (
                                        <div className="text-center py-20">
                                            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sin reportes pendientes</p>
                                        </div>
                                    ) : (
                                        tickets.map((t: any) => (
                                            <div
                                                key={t.id}
                                                onClick={() => {
                                                    setSelectedTicket(t);
                                                    setReplyText(t.reply || '');
                                                }}
                                                className={`p-5 rounded-[2rem] border transition-all cursor-pointer ${selectedTicket?.id === t.id
                                                    ? 'bg-white border-blue-200 shadow-xl shadow-blue-500/5 ring-1 ring-blue-100'
                                                    : 'bg-white/50 border-slate-100 hover:border-blue-100 hover:bg-white'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${t.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                                        }`}>
                                                        {t.status === 'open' ? 'Abierto' : 'Resuelto'}
                                                    </span>
                                                    <span className="text-[8px] font-black text-slate-300 uppercase">{new Date(t.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <h4 className="text-xs font-black text-slate-900 uppercase italic truncate">{t.subject}</h4>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 truncate">De: {t.workshop_slug} ({t.user_name})</p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Ticket Detail & Reply */}
                                <div className="w-1/2 p-10 overflow-y-auto">
                                    {selectedTicket ? (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-6 bg-slate-900 rounded-full" />
                                                    <h3 className="text-lg font-black text-slate-900 uppercase italic">{selectedTicket.subject}</h3>
                                                </div>
                                                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                                    <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                                                        "{selectedTicket.message}"
                                                    </p>
                                                    <div className="flex justify-end mt-4">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{selectedTicket.workshop_name} · {selectedTicket.user_name}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-6 bg-slate-400 rounded-full" />
                                                    <h3 className="text-sm font-black text-slate-900 uppercase italic">Gestión de Estado</h3>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'resolved')}
                                                        className={`p-4 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedTicket.status === 'resolved'
                                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white'
                                                            }`}
                                                    >
                                                        <CheckCircle2 size={16} />
                                                        Marcar Solucionado
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateTicketStatus(selectedTicket.id, 'open')}
                                                        className={`p-4 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedTicket.status === 'open'
                                                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                                            : 'bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-500 hover:text-white'
                                                            }`}
                                                    >
                                                        <Clock size={16} />
                                                        Marcar Pendiente
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                                                    <h3 className="text-sm font-black text-slate-900 uppercase italic">Tu Respuesta</h3>
                                                </div>
                                                <textarea
                                                    rows={6}
                                                    value={replyText}
                                                    onChange={(e) => setReplyText(e.target.value)}
                                                    className="w-full bg-slate-50 border-none rounded-[2rem] p-6 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-100 transition-all resize-none shadow-inner"
                                                    placeholder="Escribe la solución o respuesta técnica..."
                                                />
                                                <button
                                                    onClick={() => handleReplyTicket(selectedTicket.id)}
                                                    disabled={sendingReply}
                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-blue-500/10 transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50"
                                                >
                                                    {sendingReply ? 'Enviando...' : (
                                                        <>
                                                            <Send size={18} />
                                                            Enviar Solución
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale">
                                            <LifeBuoy size={64} className="mb-4" />
                                            <p className="text-xs font-black uppercase tracking-[0.2em]">Selecciona un reporte<br />para gestionar</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Global Reports Modal */}
            {
                showReportsModal && globalReports && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-900 text-white">
                                <div className="flex items-center gap-4">
                                    <div className="bg-indigo-600 p-3 rounded-2xl">
                                        <BarChart3 size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black italic uppercase tracking-tight">Análisis Global</h2>
                                        <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest mt-0.5 italic">KPIs Consolidados del Sistema</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowReportsModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-grow overflow-y-auto p-8 bg-slate-50/50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Workshop Growth */}
                                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                                        <div className="flex items-center gap-3">
                                            <Globe className="text-indigo-500" size={20} />
                                            <h3 className="font-black text-slate-800 uppercase italic">Crecimiento de Talleres</h3>
                                        </div>
                                        <div className="h-[250px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={globalReports.growth}>
                                                    <defs>
                                                        <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                                    <Tooltip />
                                                    <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorGrowth)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Order Volume */}
                                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                                        <div className="flex items-center gap-3">
                                            <ClipboardList className="text-blue-500" size={20} />
                                            <h3 className="font-black text-slate-800 uppercase italic">Volumen de Órdenes</h3>
                                        </div>
                                        <div className="h-[250px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={globalReports.orders}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                                    <Tooltip />
                                                    <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Health Distribution */}
                                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                                        <div className="flex items-center gap-3">
                                            <ActivityIcon className="text-emerald-500" size={20} />
                                            <h3 className="font-black text-slate-800 uppercase italic">Estado de Talleres</h3>
                                        </div>
                                        <div className="h-[250px] w-full flex items-center">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={globalReports.health}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={90}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {globalReports.health.map((entry: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={entry.name === 'active' ? '#10b981' : '#f43f5e'} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Resource Consumption */}
                                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                                        <div className="flex items-center gap-3">
                                            <HardDrive className="text-amber-500" size={20} />
                                            <h3 className="font-black text-slate-800 uppercase italic">Consumo de Espacio (Top 5)</h3>
                                        </div>
                                        <div className="space-y-4">
                                            {globalReports.storage.map((item: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400">
                                                        #{idx + 1}
                                                    </div>
                                                    <div className="flex-grow">
                                                        <div className="flex justify-between items-end mb-1">
                                                            <span className="text-[11px] font-black text-slate-800 uppercase truncate">{item.name}</span>
                                                            <span className="text-[10px] font-bold text-slate-500">{(item.size / 1024 / 1024).toFixed(1)} MB</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-amber-400 rounded-full"
                                                                style={{ width: `${Math.min(100, (item.size / (globalReports.storage[0]?.size || 1)) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Comparador de Talleres ── */}
                                {globalReports.comparison?.length > 0 && (
                                    <div className="mt-8 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <BarChart3 className="text-indigo-500" size={20} />
                                                <div>
                                                    <h3 className="font-black text-slate-900 uppercase italic tracking-tight">Comparador de Talleres</h3>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Métricas de los últimos 30-90 días · Clic en columna para ordenar</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                                {globalReports.comparison.length} talleres
                                            </span>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-slate-100 bg-slate-50/50">
                                                        {[
                                                            { key: 'name', label: 'Taller' },
                                                            { key: 'orders_this_month', label: 'Órdenes / Mes' },
                                                            { key: 'active_orders', label: 'Activas' },
                                                            { key: 'avg_ticket', label: 'Ticket Promedio' },
                                                            { key: 'avg_repair_days', label: 'Días Promedio' },
                                                            { key: 'total_clients', label: 'Clientes' },
                                                            { key: 'return_rate', label: '% Retención' },
                                                        ].map(col => (
                                                            <th
                                                                key={col.key}
                                                                className="px-6 py-4 text-left cursor-pointer group select-none"
                                                                onClick={() => setComparisonSort(prev =>
                                                                    prev.key === col.key
                                                                        ? { key: col.key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
                                                                        : { key: col.key, dir: 'desc' }
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${comparisonSort.key === col.key ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-700'}`}>
                                                                        {col.label}
                                                                    </span>
                                                                    <span className={`text-[8px] transition-opacity ${comparisonSort.key === col.key ? 'text-indigo-400 opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                                                                        {comparisonSort.dir === 'desc' ? '↓' : '↑'}
                                                                    </span>
                                                                </div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[...globalReports.comparison]
                                                        .sort((a: any, b: any) => {
                                                            const key = comparisonSort.key as keyof typeof a;
                                                            const aVal = a[key] ?? 0;
                                                            const bVal = b[key] ?? 0;
                                                            const mult = comparisonSort.dir === 'desc' ? -1 : 1;
                                                            return typeof aVal === 'string'
                                                                ? mult * aVal.localeCompare(String(bVal))
                                                                : mult * (Number(aVal) - Number(bVal));
                                                        })
                                                        .map((w: any, idx) => {
                                                            const isTop = idx === 0 && comparisonSort.key !== 'name';
                                                            return (
                                                                <tr
                                                                    key={w.slug}
                                                                    className={`border-b border-slate-50 transition-colors ${isTop ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}
                                                                >
                                                                    {/* Taller */}
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex items-center gap-3">
                                                                            {isTop && (
                                                                                <span className="text-[9px] font-black text-indigo-500 bg-indigo-100 px-2 py-0.5 rounded-full uppercase">Top</span>
                                                                            )}
                                                                            <div>
                                                                                <p className="font-black text-slate-900 uppercase italic text-xs">{w.name}</p>
                                                                                <p className="text-[9px] font-bold text-slate-400">/{w.slug}</p>
                                                                            </div>
                                                                            <span className={`ml-auto text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${w.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-500'}`}>
                                                                                {w.status === 'active' ? 'Activo' : 'Inactivo'}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    {/* Órdenes este mes */}
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-black text-slate-900 text-sm tabular-nums">{w.orders_this_month}</span>
                                                                            {comparisonSort.key === 'orders_this_month' && w.orders_this_month > 0 && (
                                                                                <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                                                                                    <div
                                                                                        className="h-full bg-indigo-500 rounded-full"
                                                                                        style={{ width: `${Math.min(100, (w.orders_this_month / Math.max(...globalReports.comparison.map((x: any) => x.orders_this_month))) * 100)}%` }}
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    {/* Activas */}
                                                                    <td className="px-6 py-4">
                                                                        <span className={`font-black tabular-nums text-sm ${w.active_orders > 10 ? 'text-amber-600' : 'text-slate-900'}`}>
                                                                            {w.active_orders}
                                                                        </span>
                                                                    </td>
                                                                    {/* Ticket Promedio */}
                                                                    <td className="px-6 py-4">
                                                                        <span className="font-black text-slate-900 text-sm tabular-nums">
                                                                            {w.avg_ticket > 0 ? `$${Number(w.avg_ticket).toLocaleString('es-AR')}` : '—'}
                                                                        </span>
                                                                    </td>
                                                                    {/* Días promedio */}
                                                                    <td className="px-6 py-4">
                                                                        <span className={`font-black text-sm tabular-nums ${w.avg_repair_days > 7 ? 'text-rose-600' : w.avg_repair_days > 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                                            {w.avg_repair_days > 0 ? `${w.avg_repair_days}d` : '—'}
                                                                        </span>
                                                                    </td>
                                                                    {/* Total clientes */}
                                                                    <td className="px-6 py-4">
                                                                        <span className="font-black text-slate-900 text-sm tabular-nums">{w.total_clients}</span>
                                                                    </td>
                                                                    {/* Tasa de retención */}
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`font-black text-sm tabular-nums ${w.return_rate >= 50 ? 'text-emerald-600' : w.return_rate >= 25 ? 'text-amber-600' : 'text-slate-500'}`}>
                                                                                {w.return_rate > 0 ? `${w.return_rate}%` : '—'}
                                                                            </span>
                                                                            {w.return_rate > 0 && (
                                                                                <div className="h-1.5 w-12 bg-slate-100 rounded-full overflow-hidden">
                                                                                    <div
                                                                                        className={`h-full rounded-full ${w.return_rate >= 50 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                                                                        style={{ width: `${Math.min(100, w.return_rate)}%` }}
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Legend */}
                                        <div className="px-6 py-4 border-t border-slate-50 flex flex-wrap gap-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            <span><span className="text-emerald-500">Verde</span> días promedio → rápido (&lt;3d)</span>
                                            <span><span className="text-amber-500">Amarillo</span> → normal (3-7d)</span>
                                            <span><span className="text-rose-500">Rojo</span> → lento (&gt;7d)</span>
                                            <span className="ml-auto">Retención: % clientes con más de 1 orden</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal Nueva Cadena */}
            {
                showNewChainModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Nueva Cadena</h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Grupo multi-sucursal</p>
                                </div>
                                <button onClick={() => setShowNewChainModal(false)} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nombre de la cadena</label>
                                    <input
                                        placeholder="Ej: Talleres García"
                                        value={newChain.name}
                                        onChange={e => setNewChain({
                                            ...newChain,
                                            name: e.target.value,
                                            slug: newChain.slug || e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                                        })}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-800 focus:outline-none focus:border-violet-500 transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Slug (identificador único)</label>
                                    <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 focus-within:border-violet-500 transition-all">
                                        <span className="text-slate-400 font-black text-sm">/chain/</span>
                                        <input
                                            placeholder="talleres-garcia"
                                            value={newChain.slug}
                                            onChange={e => setNewChain({ ...newChain, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })}
                                            className="flex-grow bg-transparent font-bold text-slate-800 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Visibilidad cruzada entre talleres</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([['summary', 'Solo resumen', 'Fecha, desc y total'], ['no_prices', 'Sin precios', 'Servicios, sin montos'], ['full', 'Completo', 'Todo visible']] as const).map(([val, label, desc]) => (
                                            <button
                                                key={val}
                                                onClick={() => setNewChain({ ...newChain, visibility_level: val })}
                                                className={`p-3 rounded-2xl border-2 text-left transition-all ${newChain.visibility_level === val ? 'border-violet-500 bg-violet-50' : 'border-slate-100 bg-slate-50 hover:border-violet-200'}`}
                                            >
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${newChain.visibility_level === val ? 'text-violet-700' : 'text-slate-600'}`}>{label}</p>
                                                <p className="text-[8px] font-bold text-slate-400 mt-0.5">{desc}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Talleres miembros iniciales</label>
                                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border-2 border-slate-100 min-h-[60px]">
                                        {workshops.map(w => {
                                            const selected = newChain.tenant_slugs.includes(w.slug);
                                            return (
                                                <button
                                                    key={w.slug}
                                                    type="button"
                                                    onClick={() => setNewChain(prev => ({
                                                        ...prev,
                                                        tenant_slugs: selected
                                                            ? prev.tenant_slugs.filter(s => s !== w.slug)
                                                            : [...prev.tenant_slugs, w.slug]
                                                    }))}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selected ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'}`}
                                                >
                                                    {selected && <Check size={10} />}
                                                    {w.name}
                                                </button>
                                            );
                                        })}
                                        {workshops.length === 0 && (
                                            <p className="text-[10px] text-slate-300 italic font-bold">No hay talleres creados aún</p>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-bold mt-1 ml-1">Podés agregar o quitar talleres después</p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => { setShowNewChainModal(false); setNewChain({ name: '', slug: '', visibility_level: 'summary', tenant_slugs: [] }); }}
                                    className="flex-grow py-4 rounded-2xl bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all font-bold"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreateChain}
                                    disabled={savingChain || !newChain.name || !newChain.slug}
                                    className="flex-[2] py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-violet-500/20 font-bold"
                                >
                                    {savingChain ? 'Creando...' : 'Crear Cadena'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Modal de Errores de Sincronización */}
            {showSyncErrorsModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Errores de Sincronización</h3>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Últimos fallos detectados en la red</p>
                            </div>
                            <button onClick={() => setShowSyncErrorsModal(null)} className="p-3 hover:bg-white rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-4">
                                {chainSyncStatus[showSyncErrorsModal]?.recent_errors?.length > 0 ? (
                                    chainSyncStatus[showSyncErrorsModal].recent_errors.map((err: any) => (
                                        <div key={err.id} className="p-4 bg-red-50/50 border border-red-100 rounded-2xl">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-white px-2 py-1 rounded-lg shadow-sm font-mono">
                                                    {err.operation}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                    {new Date(err.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">Desde:</span>
                                                    <span className="text-[10px] font-bold text-slate-700">{err.source_slug}</span>
                                                </div>
                                                <div className="w-4 h-[1px] bg-slate-200" />
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">Hacia:</span>
                                                    <span className="text-[10px] font-bold text-slate-700">{err.target_slug}</span>
                                                </div>
                                            </div>
                                            <p className="text-sm font-bold text-red-800 italic">"{err.error_message}"</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-12 text-center">
                                        <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4 opacity-20" />
                                        <p className="text-slate-400 font-bold italic">No hay errores recientes registrados.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setShowSyncErrorsModal(null)}
                                className="px-8 py-3 bg-white text-slate-900 border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
