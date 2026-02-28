'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
    Settings as SettingsIcon,
    MapPin,
    Phone,
    Mail,
    Instagram,
    Clock,
    Globe,
    Save,
    ShieldCheck,
    Percent,
    MessageSquare,
    Wrench,
    Plus,
    Trash2,
    DollarSign,
    TrendingUp,
    FileText,
    User as UserIcon,
    Shield,
    Palette,
    Image as ImageIcon,
    Copy,
    Check,
    Link2,
    Bell,
    AlertCircle,
    RefreshCw,
    X,
    Activity,
    Database
} from 'lucide-react';
import { superApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { THEMES, applyTheme, getStoredTheme } from '@/lib/theme';
import { useSlug } from '@/lib/slug';
import Link from 'next/link';
import { useNotification } from '@/lib/notification';
import { useRouter } from 'next/navigation';
import { useTranslation, Language } from '@/lib/i18n';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('global');
    const [commsTab, setCommsTab] = useState('recordatorios');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentTheme, setCurrentTheme] = useState('default');
    const { slug } = useSlug();
    const [copiedPortal, setCopiedPortal] = useState(false);
    const { notify } = useNotification();
    const [isLogoOpen, setIsLogoOpen] = useState(false);
    const router = useRouter();

    // Load stored theme on mount
    React.useEffect(() => {
        setCurrentTheme(getStoredTheme());
    }, []);

    const handleThemeChange = async (themeId: string) => {
        applyTheme(themeId);
        setCurrentTheme(themeId);
        localStorage.setItem('mechub-theme', themeId);
        const updatedConfig = { ...config, theme_id: themeId };
        setConfig(updatedConfig);
        try {
            await api.put('/config', updatedConfig);
        } catch (error) {
            console.error('Error guardando el tema:', error);
            notify('error', 'Error al guardar el tema en el servidor.');
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('logo', file);

        try {
            const res = await api.post('/config/logo', formData);
            setConfig((prev: any) => ({ ...prev, logo_path: res.data.logo_path }));
            notify('success', 'Logo actualizado correctamente');
        } catch (err) {
            notify('error', 'Error al subir logo');
        }
    };

    // Global Config State
    const [config, setConfig] = useState<any>({
        workshop_name: '',
        address: '',
        phone: '',
        email: '',
        whatsapp: '',
        instagram: '',
        business_hours: { mon_fri: '', sat: '', sun: '' },
        tax_percentage: 21,
        income_include_parts: 1,
        parts_profit_percentage: 100,
        smtp_host: '',
        smtp_port: '',
        smtp_user: '',
        smtp_pass: '',
        theme_id: 'default',
        messages_enabled: 1
    });

    // Services Catalog State
    const [services, setServices] = useState<any[]>([]);
    const [newService, setNewService] = useState({ name: '', base_price: '' });

    // Templates State
    const [templates, setTemplates] = useState<any[]>([]);
    const [lastFocusedId, setLastFocusedId] = useState<number | null>(null);
    const [cursorPos, setCursorPos] = useState<number>(0);

    // Users and Roles State
    const { user: currentUser, hasPermission } = useAuth();
    const { t, setLanguage } = useTranslation();
    const [users, setUsers] = useState<any[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role_id: '', first_name: '', last_name: '' });
    const [permissionsBase] = useState([
        'dashboard', 'clients', 'vehicles', 'orders', 'income', 'settings', 'users', 'roles', 'reminders', 'appointments', 'suppliers', 'audit'
    ]);

    // Vehicle Reference State
    const [vehicleRefs, setVehicleRefs] = useState<any[]>([]);
    const [newRef, setNewRef] = useState({ brand: '', model: '', version: '' });

    const permissionsList = config?.enabled_modules && Array.isArray(config.enabled_modules)
        ? permissionsBase.filter(p => config.enabled_modules.includes(p))
        : permissionsBase;

    const permissionLabels: { [key: string]: string } = {
        'dashboard': t('perm_dashboard'),
        'clients': t('perm_clients'),
        'vehicles': t('perm_vehicles'),
        'orders': t('perm_orders'),
        'income': t('perm_income'),
        'settings': t('perm_settings'),
        'users': t('perm_users'),
        'roles': t('perm_roles'),
        'reminders': t('perm_reminders'),
        'appointments': t('perm_appointments'),
        'suppliers': t('perm_suppliers'),
        'audit': t('perm_audit')
    };

    // Personal State
    const [meData, setMeData] = useState<any>({ first_name: '', last_name: '', language: 'es', password: '' });

    // Logs State
    const [systemLogs, setSystemLogs] = useState<any[]>([]);
    const [fileLogs, setFileLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    const handleInsertToken = (token: string) => {
        if (lastFocusedId === null) {
            notify('info', 'Hacé clic en el mensaje donde querés insertar el token.');
            return;
        }
        let updatedTemplate: any = null;
        setTemplates(prev => prev.map(t => {
            if (t.id === lastFocusedId) {
                const before = t.content.substring(0, cursorPos);
                const after = t.content.substring(cursorPos);
                const newContent = before + token + after;
                updatedTemplate = { ...t, content: newContent };
                return updatedTemplate;
            }
            return t;
        }));

        // Immediate save to backend
        if (updatedTemplate) {
            handleUpdateTemplate(updatedTemplate.id, updatedTemplate);
        }

        setCursorPos(prev => prev + token.length);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const requests: Promise<any>[] = [
                    api.get('/config'),
                    api.get('/services'),
                    api.get('/templates'),
                    api.get('/clients/vehicle-reference')
                ];

                if (currentUser && !currentUser.isSuperuser) {
                    requests.push(api.get('/users/me'));
                }

                if (hasPermission('users')) {
                    requests.push(api.get('/users'));
                }
                if (hasPermission('roles')) {
                    requests.push(api.get('/roles'));
                }

                const responses = await Promise.all(requests);
                let currentIdx = 0;
                const configRes = responses[currentIdx++];
                const servicesRes = responses[currentIdx++];
                const templatesRes = responses[currentIdx++];
                const vehicleRefsRes = responses[currentIdx++];
                let meRes = (currentUser && !currentUser.isSuperuser) ? responses[currentIdx++] : null;
                let usersRes = hasPermission('users') ? responses[currentIdx++] : null;
                let rolesRes = hasPermission('roles') ? responses[currentIdx++] : null;

                if (configRes.data) {
                    const data = configRes.data;
                    if (typeof data.business_hours === 'string' && data.business_hours) {
                        try {
                            data.business_hours = JSON.parse(data.business_hours);
                        } catch (e) {
                            data.business_hours = { mon_fri: '', sat: '', sun: '' };
                        }
                    }
                    if (!data.business_hours) {
                        data.business_hours = { mon_fri: '', sat: '', sun: '' };
                    }
                    if (data.theme_id) {
                        applyTheme(data.theme_id);
                        setCurrentTheme(data.theme_id);
                    }
                    setConfig(data);
                }

                setServices(servicesRes.data);
                setTemplates(templatesRes.data);
                setVehicleRefs(vehicleRefsRes.data);
                if (meRes) setMeData({ ...meRes.data, password: '' });
                if (usersRes) setUsers(usersRes.data);
                if (rolesRes) setRoles(rolesRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [hasPermission]);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            await api.put('/users/me', {
                first_name: meData.first_name,
                last_name: meData.last_name,
                language: meData.language,
                ...(meData.password ? { password: meData.password } : {})
            });

            // Persist locally
            if (meData.language) {
                setLanguage(meData.language as Language);
            }

            // Update the user in localStorage to keep persistence across reloads
            const updatedUser = { ...currentUser, ...meData };
            delete updatedUser.password;
            localStorage.setItem('user', JSON.stringify(updatedUser));

            notify('success', t('profile_updated'));
            // setTimeout(() => window.location.reload(), 1500); // No longer strictly needed if we update local state
        } catch (err) {
            notify('error', t('error_updating_profile'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            await api.put('/config', config);
            notify('success', 'Configuración guardada exitosamente');
        } catch (err) {
            notify('error', 'Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    const handleAddService = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.post('/services', {
                name: newService.name,
                base_price: parseFloat(newService.base_price || '0')
            });
            setServices([...services, response.data]);
            setNewService({ name: '', base_price: '' });
            notify('success', 'Servicio agregado');
        } catch (err) {
            notify('error', 'Error al agregar servicio');
        }
    };

    const handleDeleteService = async (id: number) => {
        if (!confirm('¿Desea eliminar este servicio?')) return;
        try {
            await api.delete(`/services/${id}`);
            setServices(services.filter(s => s.id !== id));
            notify('success', 'Servicio eliminado');
        } catch (err) {
            notify('error', 'Error al eliminar el servicio');
        }
    };

    const handleUpdateUser = async (id: number, data: any) => {
        try {
            await api.put(`/users/${id}`, data);
            const res = await api.get('/users');
            setUsers(res.data);
            notify('success', 'Usuario actualizado');
        } catch (err) {
            notify('error', 'Error al actualizar usuario');
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/users', newUser);
            setNewUser({ username: '', password: '', role_id: '', first_name: '', last_name: '' });
            const res = await api.get('/users');
            setUsers(res.data);
            notify('success', 'Usuario creado con éxito');
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al crear usuario');
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm('¿Seguro que querés eliminar este usuario?')) return;
        try {
            await api.delete(`/users/${id}`);
            setUsers(users.filter(u => u.id !== id));
            notify('success', 'Usuario eliminado');
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al eliminar usuario');
        }
    };

    const handleUpdateRole = async (id: number, data: any) => {
        try {
            await api.put(`/roles/${id}`, data);
            const res = await api.get('/roles');
            setRoles(res.data);
            notify('success', 'Rol actualizado con éxito');
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al actualizar rol');
        }
    };

    const handleCreateRole = async () => {
        const name = prompt('Nombre del nuevo rol:');
        if (!name) return;
        try {
            await api.post('/roles', { name, permissions: [] });
            const res = await api.get('/roles');
            setRoles(res.data);
            notify('success', 'Rol creado');
        } catch (err) {
            notify('error', 'Error al crear rol');
        }
    };

    const handleDeleteRole = async (id: number) => {
        if (!confirm('¿Seguro que querés eliminar este rol?')) return;
        try {
            await api.delete(`/roles/${id}`);
            setRoles(roles.filter(r => r.id !== id));
            notify('success', 'Rol eliminado');
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al eliminar rol');
        }
    };

    const handleUpdateTemplate = async (id: number, data: any) => {
        try {
            await api.put(`/templates/${id}`, data);
            setTemplates(templates.map(t => t.id === id ? { ...t, ...data } : t));
            notify('success', 'Plantilla actualizada');
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al actualizar plantilla');
        }
    };

    const handleCreateTemplate = async () => {
        try {
            const name = prompt('Nombre de la nueva plantilla:');
            if (!name) return;
            const res = await api.post('/templates', {
                name,
                content: 'Hola [cliente], ...',
                trigger_status: null,
                include_pdf: 0
            });
            const templatesRes = await api.get('/templates');
            setTemplates(templatesRes.data);
            notify('success', 'Plantilla creada');
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al crear plantilla');
        }
    };

    const handleDeleteTemplate = async (id: number) => {
        if (!confirm('¿Desea eliminar esta plantilla?')) return;
        try {
            await api.delete(`/templates/${id}`);
            setTemplates(templates.filter(t => t.id !== id));
            notify('success', 'Plantilla eliminada');
        } catch (err) {
            notify('error', 'Error al eliminar plantilla');
        }
    };

    const fetchSystemLogs = async () => {
        setLoadingLogs(true);
        try {
            const [dbRes, fileRes] = await Promise.all([
                api.get('/logs'),
                api.get('/logs/file')
            ]);
            setSystemLogs(dbRes.data);
            setFileLogs(fileRes.data);
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLoadingLogs(false);
        }
    };

    const handlePurgeLogs = async (mode: 'all' | 'old') => {
        if (!confirm('¿Desea purgar los logs? Esta acción no se puede deshacer.')) return;
        try {
            await api.delete(`/logs?mode=${mode}`);
            notify('success', 'Logs purgados correctamente');
            fetchSystemLogs();
        } catch (err) {
            notify('error', 'Error al purgar logs');
        }
    };

    const handleAddVehicleRef = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.post('/clients/vehicle-reference', newRef);
            setVehicleRefs(prev => [...prev, { ...newRef, id: response.data.id }].sort((a, b) => a.brand.localeCompare(b.brand)));
            setNewRef({ brand: '', model: '', version: '' });
            notify('success', 'Referencia agregada');
        } catch (err) {
            notify('error', 'Error al agregar referencia');
        }
    };

    const handleDeleteVehicleRef = async (id: number) => {
        if (!confirm('¿Desea eliminar esta referencia?')) return;
        try {
            await api.delete(`/clients/vehicle-reference/${id}`);
            setVehicleRefs(vehicleRefs.filter(r => r.id !== id));
            notify('success', 'Referencia eliminada');
        } catch (err) {
            notify('error', 'Error al eliminar referencia');
        }
    };



    useEffect(() => {
        if (activeTab === 'logs') {
            fetchSystemLogs();
        }
    }, [activeTab]);

    if (loading) return <div className="p-8 text-slate-500 font-medium">Cargando Ajustes del Sistema...</div>;

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12 transition-all">
            <header>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t('settings_panel_title')}</h2>
                <p className="text-slate-500 mt-1">{t('settings_panel_subtitle')}</p>
            </header>

            {/* Tabs Navigation */}
            <div className="flex flex-wrap bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm w-fit gap-1">
                <TabButton active={activeTab === 'personal'} onClick={() => setActiveTab('personal')} icon={<UserIcon size={18} />} label={t('personal_settings')} />
                <TabButton active={activeTab === 'global'} onClick={() => setActiveTab('global')} icon={<Globe size={18} />} label={t('global_config')} />
                <TabButton active={activeTab === 'comms'} onClick={() => setActiveTab('comms')} icon={<MessageSquare size={18} />} label={t('portal_config')} />
                <TabButton active={activeTab === 'services'} onClick={() => setActiveTab('services')} icon={<Wrench size={18} />} label={t('services_catalog')} />
                <TabButton active={activeTab === 'vehicles'} onClick={() => setActiveTab('vehicles')} icon={<Database size={18} />} label="Modelos de Vehículos" />
                {hasPermission('users') && <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<UserIcon size={18} />} label={t('user_management')} />}
                {hasPermission('roles') && <TabButton active={activeTab === 'roles'} onClick={() => setActiveTab('roles')} icon={<Shield size={18} />} label={t('roles_and_perms')} />}
                <TabButton active={activeTab === 'appearance'} onClick={() => setActiveTab('appearance')} icon={<Palette size={18} />} label={t('theme_selection')} />
                {hasPermission('audit') && (
                    <button
                        onClick={() => router.push(`/${slug}/dashboard/admin/audit`)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    >
                        <Activity size={18} />
                        {t('audit_logs')}
                    </button>
                )}
                {currentUser?.isSuperuser && (
                    <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<Activity size={18} />} label="Logs" />
                )}

            </div>

            <div className="mt-8">
                {activeTab === 'personal' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
                            <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                                <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-xl shadow-indigo-600/10">
                                    <UserIcon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t('personal_settings')}</h3>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">{t('personal_data')}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {currentUser?.isSuperuser ? (
                                    <div className="md:col-span-2 p-6 bg-slate-50 rounded-3xl border border-slate-200 text-center">
                                        <Shield className="mx-auto text-slate-400 mb-3" size={32} />
                                        <p className="text-slate-600 font-bold uppercase text-xs tracking-widest max-w-sm mx-auto">
                                            Tu perfil como superusuario se gestiona globalmente en el panel central.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('first_name')}</label>
                                            <input
                                                type="text"
                                                className="w-full px-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-slate-50/50 text-slate-900 font-bold"
                                                value={meData.first_name || ''}
                                                onChange={(e) => setMeData({ ...meData, first_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('last_name')}</label>
                                            <input
                                                type="text"
                                                className="w-full px-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-slate-50/50 text-slate-900 font-bold"
                                                value={meData.last_name || ''}
                                                onChange={(e) => setMeData({ ...meData, last_name: e.target.value })}
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('language_personal')}</label>
                                            <select
                                                className="w-full px-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-slate-50/50 text-slate-900 font-bold appearance-none"
                                                value={meData.language || 'es'}
                                                onChange={(e) => setMeData({ ...meData, language: e.target.value })}
                                            >
                                                <option value="es">Español</option>
                                                <option value="en">English</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('new_password')}</label>
                                            <input
                                                type="password"
                                                autoComplete="new-password"
                                                className="w-full px-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-slate-50/50 text-slate-900 font-bold"
                                                placeholder={t('change_password_hint')}
                                                value={meData.password || ''}
                                                onChange={(e) => setMeData({ ...meData, password: e.target.value })}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {!currentUser?.isSuperuser && (
                                <div className="pt-6 border-t border-slate-50 flex justify-end">
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={saving}
                                        className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50 flex items-center gap-3"
                                    >
                                        {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                                        {t('save')}
                                    </button>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {activeTab === 'global' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                            <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Globe className="text-blue-500" size={24} />
                                    {t('client_portal')}
                                </h3>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
                                    <div className="flex-grow overflow-hidden">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('public_link')}</p>
                                        <div className="flex items-center gap-2 text-slate-700 font-mono text-sm truncate">
                                            <Link2 size={16} className="text-slate-400 shrink-0" />
                                            <span className="truncate">{typeof window !== 'undefined' ? `${window.location.origin}/${slug}/client/login` : `/${slug}/client/login`}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (typeof window !== 'undefined') {
                                                navigator.clipboard.writeText(`${window.location.origin}/${slug}/client/login`);
                                                setCopiedPortal(true);
                                                setTimeout(() => setCopiedPortal(false), 2000);
                                            }
                                        }}
                                        className={`shrink-0 p-3 rounded-xl transition-all font-black text-xs flex items-center gap-2 ${copiedPortal ? 'bg-emerald-50 text-emerald-600' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 shadow-sm'}`}
                                    >
                                        {copiedPortal ? <><Check size={16} /> {t('copied')}</> : <><Copy size={16} /> {t('copy_link')}</>}
                                    </button>
                                </div>

                                <div className="space-y-1 mt-6">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('client_portal_language')}</label>
                                    <select
                                        className="w-full px-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-slate-50/50 text-slate-900 font-bold appearance-none"
                                        value={config.client_portal_language || 'es'}
                                        onChange={(e) => setConfig((prev: any) => ({ ...prev, client_portal_language: e.target.value }))}
                                    >
                                        <option value="es">Español</option>
                                        <option value="en">English</option>
                                    </select>
                                    <p className="text-xs text-slate-400 mt-2 ml-1 font-bold">{t('portal_language_desc')}</p>
                                </div>
                            </section>

                            <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <SettingsIcon className="text-blue-500" size={24} />
                                    {t('workshop_identity')}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ConfigInput label={t('workshop_info')} value={config.workshop_name} onChange={(v) => setConfig((prev: any) => ({ ...prev, workshop_name: v }))} />
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('workshop_logo_hint')}</label>
                                        <div className="flex flex-col gap-4">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                                className="hidden"
                                                id="logo-upload"
                                            />
                                            {config.logo_path ? (
                                                <div className="relative w-48 h-48 group mx-auto md:mx-0">
                                                    <label htmlFor="logo-upload" className="block w-full h-full rounded-3xl border-4 border-slate-100 overflow-hidden cursor-pointer shadow-sm hover:border-indigo-400 hover:shadow-xl transition-all">
                                                        <img src={(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '') + config.logo_path} alt="Logo" className="w-full h-full object-contain bg-white" />
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <ImageIcon className="text-white" size={32} />
                                                        </div>
                                                    </label>
                                                    <button
                                                        onClick={() => setConfig((prev: any) => ({ ...prev, logo_path: '' }))}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-110"
                                                        title={t('remove_logo')}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label
                                                    htmlFor="logo-upload"
                                                    className="w-48 h-48 bg-slate-50 border-4 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-slate-400 hover:text-indigo-500 mx-auto md:mx-0"
                                                >
                                                    <ImageIcon size={48} className="mb-3" />
                                                    <span className="font-bold text-sm">{t('upload_logo')}</span>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">{t('recommended_size')}</span>
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <ConfigInput label={t('address')} icon={<MapPin size={18} />} value={config.address} onChange={(v) => setConfig((prev: any) => ({ ...prev, address: v }))} />
                            </section>

                            <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <TrendingUp className="text-indigo-500" size={24} />
                                    {t('income_calculation')}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={config.income_include_parts === 1}
                                                    onChange={(e) => setConfig((prev: any) => ({ ...prev, income_include_parts: e.target.checked ? 1 : 0 }))}
                                                />
                                                <div className={`w-12 h-6 rounded-full transition-colors ${config.income_include_parts === 1 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${config.income_include_parts === 1 ? 'translate-x-6' : ''}`}></div>
                                            </div>
                                            <div>
                                                <span className="text-sm font-bold text-slate-900 block tracking-tight">{t('add_parts_to_income')}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{t('include_parts_desc')}</span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('parts_profit_percentage')}</label>
                                        <div className="relative">
                                            <Percent size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                            <input
                                                type="number"
                                                className="w-full pl-12 pr-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-slate-50/50 text-slate-900 font-bold"
                                                value={config.parts_profit_percentage ?? ''}
                                                placeholder="100"
                                                onChange={(e) => setConfig((prev: any) => ({ ...prev, parts_profit_percentage: parseFloat(e.target.value || '0') }))}
                                            />
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase italic">{t('parts_profit_desc')}</p>
                                    </div>
                                </div>
                            </section>

                            <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Phone className="text-emerald-500" size={24} />
                                    {t('contact_and_social')}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ConfigInput label={t('whatsapp_hint')} value={config.whatsapp} onChange={(v) => setConfig((prev: any) => ({ ...prev, whatsapp: v }))} />
                                    <ConfigInput label={t('email')} icon={<Mail size={18} />} value={config.email} onChange={(v) => setConfig((prev: any) => ({ ...prev, email: v }))} />
                                    <ConfigInput label={t('tax_iva')} icon={<Percent size={18} />} type="number" value={config.tax_percentage} onChange={(v) => setConfig((prev: any) => ({ ...prev, tax_percentage: parseFloat(v) }))} />
                                </div>
                            </section>

                            <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Mail className="text-blue-500" size={24} />
                                    {t('mail_server_config')}
                                </h3>

                                <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                                    <button
                                        className={`flex-1 py-2 text-sm font-bold uppercase tracking-wide rounded-lg transition-all ${config.mail_provider === 'smtp' || !config.mail_provider ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                        onClick={() => setConfig((prev: any) => ({ ...prev, mail_provider: 'smtp' }))}
                                        type="button"
                                    >
                                        {t('traditional_smtp')}
                                    </button>
                                    <button
                                        className={`flex-1 py-2 text-sm font-bold uppercase tracking-wide rounded-lg transition-all ${config.mail_provider === 'resend' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                        onClick={() => setConfig((prev: any) => ({ ...prev, mail_provider: 'resend' }))}
                                        type="button"
                                    >
                                        Resend API
                                    </button>
                                </div>

                                {(config.mail_provider === 'smtp' || !config.mail_provider) ? (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <ConfigInput label="Servidor SMTP (Host)" value={config.smtp_host} onChange={(v) => setConfig((prev: any) => ({ ...prev, smtp_host: v }))} />
                                            <ConfigInput label="Puerto" type="number" value={config.smtp_port} onChange={(v) => setConfig((prev: any) => ({ ...prev, smtp_port: parseInt(v) || '' }))} />
                                            <ConfigInput label="Usuario (Email)" value={config.smtp_user} onChange={(v) => setConfig((prev: any) => ({ ...prev, smtp_user: v }))} />
                                            <ConfigInput label="Contraseña" type="password" value={config.smtp_pass} onChange={(v) => setConfig((prev: any) => ({ ...prev, smtp_pass: v }))} />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-loose">
                                            ℹ️ Se utiliza para enviar presupuestos automáticamente. Ej (Gmail): host: smtp.gmail.com, puerto: 465 o 587.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 gap-6">
                                            <ConfigInput
                                                label="API Key de Resend (Recomendado)"
                                                value={config.resend_api_key}
                                                type="password"
                                                onChange={(v) => setConfig((prev: any) => ({ ...prev, resend_api_key: v }))}
                                            />
                                            <ConfigInput
                                                label="Email Remitente (Debe estar verificado en Resend)"
                                                value={config.smtp_user}
                                                onChange={(v) => setConfig((prev: any) => ({ ...prev, smtp_user: v }))}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-loose">
                                            ℹ️ Resend ignora los bloqueos de puerto. Obtené tu clave en resend.com. El email remitente se guarda en el mismo campo que el "Usuario SMTP".
                                        </p>
                                    </>
                                )}

                                <div className="pt-6 border-t border-slate-100 space-y-4">
                                    <label className="flex items-center justify-between cursor-pointer group p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                                <RefreshCw size={20} />
                                            </div>
                                            <div>
                                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{t('auto_reply_reader')}</span>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{t('capture_responses_desc')}</p>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={config.imap_enabled === 1}
                                                onChange={(e) => setConfig((prev: any) => ({ ...prev, imap_enabled: e.target.checked ? 1 : 0 }))}
                                            />
                                            <div className={`w-12 h-6 rounded-full transition-colors ${config.imap_enabled === 1 ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
                                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${config.imap_enabled === 1 ? 'translate-x-6' : ''}`}></div>
                                        </div>
                                    </label>

                                    {config.imap_enabled === 1 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                                            <ConfigInput label="Servidor IMAP (Entrante)" placeholder="imap.gmail.com" value={config.imap_host} onChange={(v) => setConfig((prev: any) => ({ ...prev, imap_host: v }))} />
                                            <ConfigInput label="Puerto IMAP" type="number" placeholder="993" value={config.imap_port} onChange={(v) => setConfig((prev: any) => ({ ...prev, imap_port: parseInt(v) || '' }))} />
                                            <ConfigInput label="Usuario IMAP" placeholder="tu-email@gmail.com" value={config.imap_user} onChange={(v) => setConfig((prev: any) => ({ ...prev, imap_user: v }))} />
                                            <ConfigInput label="Contraseña IMAP / App Password" type="password" value={config.imap_pass} onChange={(v) => setConfig((prev: any) => ({ ...prev, imap_pass: v }))} />
                                            <p className="col-span-full text-[9px] text-slate-400 font-bold uppercase tracking-widest bg-blue-50/50 p-4 rounded-xl border border-blue-100/50 italic">
                                                {t('imap_gmail_tip')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </section>

                        </div>
                        <div className="space-y-8">
                            {config.logo_path && (
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vista Previa Logo</p>
                                    <img
                                        src={(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '') + config.logo_path}
                                        alt="Workshop Logo"
                                        className="max-h-32 object-contain cursor-zoom-in hover:scale-105 transition-all duration-300"
                                        onClick={() => setIsLogoOpen(true)}
                                    />
                                </div>
                            )}
                            <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Clock className="text-amber-500" size={20} /> Horarios de Atención
                                </h3>
                                <div className="space-y-6">
                                    <HourRangeSelector
                                        label="Lunes a Viernes"
                                        value={config.business_hours?.mon_fri}
                                        onChange={(v) => setConfig((prev: any) => ({ ...prev, business_hours: { ...prev.business_hours, mon_fri: v } }))}
                                    />
                                    <HourRangeSelector
                                        label="Sábado (Opcional)"
                                        value={config.business_hours?.sat}
                                        onChange={(v) => setConfig((prev: any) => ({ ...prev, business_hours: { ...prev.business_hours, sat: v } }))}
                                        optional
                                    />
                                    <HourRangeSelector
                                        label="Domingo (Opcional)"
                                        value={config.business_hours?.sun}
                                        onChange={(v) => setConfig((prev: any) => ({ ...prev, business_hours: { ...prev.business_hours, sun: v } }))}
                                        optional
                                    />
                                </div>
                            </section>
                            <button
                                onClick={handleSaveConfig}
                                disabled={saving}
                                className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                <Save size={20} />
                                {saving ? 'Guardando...' : 'Guardar Todo'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'comms' && (
                    <div className="space-y-8">
                        {/* Sub-tabs for Communications */}
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit gap-1 border border-slate-200">
                            <button
                                onClick={() => setCommsTab('recordatorios')}
                                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${commsTab === 'recordatorios' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Bell size={14} className="inline mr-2" />
                                {t('recordatorios_tab')}
                            </button>
                            <button
                                onClick={() => setCommsTab('messages')}
                                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${commsTab === 'messages' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <MessageSquare size={14} className="inline mr-2" />
                                {t('templates_tab')}
                            </button>
                        </div>

                        {commsTab === 'recordatorios' && (
                            <div className="max-w-4xl space-y-8">
                                <div className="bg-slate-900 rounded-[32px] p-10 text-white relative overflow-hidden shadow-2xl">
                                    <div className="absolute right-0 top-0 opacity-10 translate-x-1/4 -translate-y-1/4">
                                        <Bell size={240} />
                                    </div>
                                    <div className="relative z-10 space-y-8">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-500/20">
                                                <Clock size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black uppercase italic tracking-tight">{t('auto_sending_title')}</h3>
                                                <p className="text-slate-400 text-sm font-bold opacity-80 mt-1">{t('auto_sending_desc')}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 py-6 border-y border-white/10">
                                            <div className="flex items-center gap-6">
                                                <label className="flex items-center gap-4 cursor-pointer group">
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only"
                                                            checked={config.reminder_enabled === 1}
                                                            onChange={(e) => setConfig((prev: any) => ({ ...prev, reminder_enabled: e.target.checked ? 1 : 0 }))}
                                                        />
                                                        <div className={`w-14 h-7 rounded-full transition-colors ${config.reminder_enabled === 1 ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
                                                        <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${config.reminder_enabled === 1 ? 'translate-x-7' : ''}`}></div>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black uppercase tracking-widest">{t('active_service')}</span>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{t('enable_daily_cron')}</p>
                                                    </div>
                                                </label>
                                            </div>

                                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 px-6 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Clock size={18} className="text-blue-400" />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('sending_time')}</span>
                                                </div>
                                                <select
                                                    className="bg-transparent border-none outline-none text-white font-black text-xl [color-scheme:dark] cursor-pointer"
                                                    value={config.reminder_time?.split(':')[0] || '09'}
                                                    onChange={(e) => setConfig((prev: any) => ({ ...prev, reminder_time: `${e.target.value}:00` }))}
                                                >
                                                    {Array.from({ length: 24 }).map((_, i) => {
                                                        const hour = String(i).padStart(2, '0');
                                                        return (
                                                            <option key={hour} value={hour} className="bg-slate-900 text-white">
                                                                {hour}:00
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4 bg-blue-600/20 border border-blue-500/20 p-5 rounded-2xl">
                                            <AlertCircle size={20} className="text-blue-400 shrink-0 mt-0.5" />
                                            <p className="text-xs font-bold text-slate-200 uppercase leading-relaxed opacity-90">
                                                {t('reminders_processing_hint')}
                                            </p>
                                        </div>

                                        <div className="pt-4 flex justify-end">
                                            <button
                                                onClick={handleSaveConfig}
                                                disabled={saving}
                                                className="bg-white text-slate-900 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-3 disabled:opacity-50 shadow-xl"
                                            >
                                                {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                                                {saving ? t('saving_text') : t('save_config')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {commsTab === 'messages' && (
                            <div className="space-y-8">
                                <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-indigo-500 p-3 rounded-2xl shadow-lg shadow-indigo-200 text-white">
                                                <MessageSquare size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-800">{t('automated_messages')}</h3>
                                                <p className="text-slate-500 text-sm font-bold opacity-80 mt-1">{t('control_auto_sending_desc')}</p>
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-4 cursor-pointer group bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={config.messages_enabled === 1}
                                                    onChange={(e) => setConfig((prev: any) => ({ ...prev, messages_enabled: e.target.checked ? 1 : 0 }))}
                                                />
                                                <div className={`w-14 h-7 rounded-full transition-colors ${config.messages_enabled === 1 ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                                                <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${config.messages_enabled === 1 ? 'translate-x-7' : ''}`}></div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black uppercase tracking-widest text-slate-700">Estado: {config.messages_enabled === 1 ? 'Habilitados' : 'Deshabilitados'}</span>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Automáticos por estado</p>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="flex items-start gap-4 bg-amber-50 border border-amber-100 p-5 rounded-2xl">
                                        <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-xs font-bold text-amber-700 uppercase leading-relaxed">
                                            Desactivar esta opción evitará que se envíen mensajes automáticos cuando cambies el estado de una orden (ej: de Pendiente a Presupuestado). <span className="bg-amber-200/50 px-1 rounded">Esto no afecta a los recordatorios de mantenimiento programados</span>, los cuales tienen su propia configuración un paso más arriba.
                                        </p>
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <button
                                            onClick={handleSaveConfig}
                                            disabled={saving}
                                            className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {saving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                                            {t('save_message_adjustment')}
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white p-6 md:p-10 rounded-3xl border border-slate-100 shadow-sm space-y-8">
                                    <div className="flex justify-between items-end gap-4 border-b border-slate-100 pb-8">
                                        <div>
                                            <h3 className="text-2xl font-bold text-slate-800">{t('message_templates_title')}</h3>
                                            <p className="text-slate-500 mt-1">{t('personalize_templates_desc')}</p>
                                        </div>
                                        <button
                                            onClick={handleCreateTemplate}
                                            className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100 flex items-center gap-2 shrink-0"
                                        >
                                            <Plus size={16} /> {t('new_template')}
                                        </button>
                                    </div>

                                    <div className="flex flex-col xl:flex-row gap-10 items-start">
                                        <div className="flex-grow w-full space-y-8">
                                            <div className="grid grid-cols-1 gap-8">
                                                {templates.map((template) => (
                                                    <div key={template.id} className="p-6 md:p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6 shadow-sm">
                                                        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                                                            <div className="flex items-center gap-3">
                                                                <input
                                                                    className="font-black text-slate-800 uppercase tracking-tighter italic text-lg bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-100 rounded px-1"
                                                                    value={template.name}
                                                                    onChange={(e) => setTemplates(templates.map(t => t.id === template.id ? { ...t, name: e.target.value } : t))}
                                                                    onBlur={(e) => handleUpdateTemplate(template.id, { ...template, name: e.target.value })}
                                                                />
                                                                <button onClick={() => handleDeleteTemplate(template.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-4">
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Disparador</label>
                                                                    <select
                                                                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                                                                        value={template.trigger_status || ''}
                                                                        onChange={(e) => handleUpdateTemplate(template.id, { ...template, trigger_status: e.target.value, include_pdf: e.target.value ? template.include_pdf : 0 })}
                                                                    >
                                                                        <option value="">{t('manual')}</option>
                                                                        <option value="Pendiente">{t('on_create_pending')}</option>
                                                                        <option value="Turno asignado">{t('appointment')}</option>
                                                                        <option value="En proceso">{t('in_progress')}</option>
                                                                        <option value="Presupuestado">{t('quoted')}</option>
                                                                        <option value="Aprobado">{t('approved')}</option>
                                                                        <option value="En reparación">{t('in_repair')}</option>
                                                                        <option value="Listo para entrega">{t('ready')}</option>
                                                                        <option value="Entregado">{t('delivered')}</option>
                                                                        <option value="Recordatorio">{t('reminders')}</option>
                                                                    </select>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-4 bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm shrink-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            id={`email-${template.id}`}
                                                                            checked={template.send_email !== 0}
                                                                            onChange={(e) => handleUpdateTemplate(template.id, { ...template, send_email: e.target.checked ? 1 : 0 })}
                                                                            className="w-4 h-4 rounded text-blue-600 border-slate-300"
                                                                        />
                                                                        <label htmlFor={`email-${template.id}`} className="text-[10px] font-black text-slate-600 uppercase tracking-widest cursor-pointer flex items-center gap-1">
                                                                            <Mail size={12} className="text-blue-500" /> Email
                                                                        </label>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            id={`wa-${template.id}`}
                                                                            checked={template.send_whatsapp === 1}
                                                                            onChange={(e) => handleUpdateTemplate(template.id, { ...template, send_whatsapp: e.target.checked ? 1 : 0 })}
                                                                            className="w-4 h-4 rounded text-emerald-600 border-slate-300"
                                                                        />
                                                                        <label htmlFor={`wa-${template.id}`} className="text-[10px] font-black text-slate-600 uppercase tracking-widest cursor-pointer flex items-center gap-1">
                                                                            <MessageSquare size={12} className="text-emerald-500" /> WhatsApp
                                                                        </label>
                                                                    </div>
                                                                    {template.trigger_status && (
                                                                        <div className="flex items-center gap-2 pl-4 border-l border-slate-100">
                                                                            <input
                                                                                type="checkbox"
                                                                                id={`pdf-${template.id}`}
                                                                                checked={template.include_pdf === 1}
                                                                                onChange={(e) => handleUpdateTemplate(template.id, { ...template, include_pdf: e.target.checked ? 1 : 0 })}
                                                                                className="w-4 h-4 rounded text-indigo-600 border-slate-300"
                                                                            />
                                                                            <label htmlFor={`pdf-${template.id}`} className="text-[10px] font-black text-slate-600 uppercase tracking-widest cursor-pointer flex items-center gap-1">
                                                                                <FileText size={12} className="text-indigo-500" /> PDF
                                                                            </label>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <textarea
                                                            className="w-full h-32 p-6 rounded-2xl border border-slate-200 outline-none shadow-inner text-slate-900 font-bold text-sm bg-white/50 focus:bg-white transition-all placeholder:text-slate-300"
                                                            value={template.content}
                                                            onFocus={() => {
                                                                setLastFocusedId(template.id);
                                                            }}
                                                            onSelect={(e: any) => setCursorPos(e.target.selectionStart)}
                                                            onChange={(e) => {
                                                                setCursorPos(e.target.selectionStart);
                                                                setTemplates(templates.map(t => t.id === template.id ? { ...t, content: e.target.value } : t));
                                                            }}
                                                            onBlur={(e) => handleUpdateTemplate(template.id, { ...template, content: e.target.value })}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="xl:w-80 xl:sticky xl:top-24 bg-slate-900 p-8 rounded-3xl text-white space-y-6 shrink-0 shadow-xl">
                                            <h4 className="text-lg font-bold flex items-center gap-2 text-blue-400">
                                                <ShieldCheck size={20} /> {t('available_tokens')}
                                            </h4>
                                            <div className="space-y-4 text-sm font-medium">
                                                <button
                                                    onClick={() => handleInsertToken('[apodo]')}
                                                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-pink-500/30 group"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-pink-400 font-black tracking-wider">[apodo]</span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase group-hover:text-pink-400">{t('insert')}</span>
                                                    </div>
                                                    <p className="text-slate-400 text-xs mt-1">{t('token_apodo_desc')}</p>
                                                </button>

                                                <button
                                                    onClick={() => handleInsertToken('[cliente]')}
                                                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-blue-500/30 group"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-blue-400 font-black tracking-wider">[cliente]</span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase group-hover:text-blue-400">{t('insert')}</span>
                                                    </div>
                                                    <p className="text-slate-400 text-xs mt-1">{t('token_cliente_desc')}</p>
                                                </button>

                                                <button
                                                    onClick={() => handleInsertToken('[vehiculo]')}
                                                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-emerald-500/30 group"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-emerald-400 font-black tracking-wider">[vehiculo]</span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase group-hover:text-emerald-400">{t('insert')}</span>
                                                    </div>
                                                    <p className="text-slate-400 text-xs mt-1">{t('token_vehiculo_desc')}</p>
                                                </button>

                                                <button
                                                    onClick={() => handleInsertToken('[turno_fecha]')}
                                                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-indigo-500/30 group"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-indigo-400 font-black tracking-wider">[turno_fecha]</span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase group-hover:text-indigo-400">{t('insert')}</span>
                                                    </div>
                                                    <p className="text-slate-400 text-xs mt-1">{t('token_turno_desc')}</p>
                                                </button>

                                                <button
                                                    onClick={() => handleInsertToken('[link]')}
                                                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-blue-500/30 group"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-blue-400 font-black tracking-wider">[link]</span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase group-hover:text-blue-400">{t('insert')}</span>
                                                    </div>
                                                    <p className="text-slate-400 text-xs mt-1">{t('token_link_desc')}</p>
                                                </button>

                                                <button
                                                    onClick={() => handleInsertToken('[items]')}
                                                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-amber-500/30 group"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-amber-400 font-black tracking-wider">[items]</span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase group-hover:text-amber-400">{t('insert')}</span>
                                                    </div>
                                                    <p className="text-slate-400 text-xs mt-1">{t('token_items_desc')}</p>
                                                </button>

                                                <button
                                                    onClick={() => handleInsertToken('[total]')}
                                                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-emerald-500/30 group"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-emerald-400 font-black tracking-wider">[total]</span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase group-hover:text-emerald-400">{t('insert')}</span>
                                                    </div>
                                                    <p className="text-slate-400 text-xs mt-1">{t('token_total_desc')}</p>
                                                </button>

                                                <button
                                                    onClick={() => handleInsertToken('[usuario]')}
                                                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-purple-500/30 group"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-purple-400 font-black tracking-wider">[usuario]</span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase group-hover:text-purple-400">{t('insert')}</span>
                                                    </div>
                                                    <p className="text-slate-400 text-xs mt-1">{t('token_usuario_desc')}</p>
                                                </button>

                                                <button
                                                    onClick={() => handleInsertToken('[taller]')}
                                                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-slate-500/30 group"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-200 font-black tracking-wider">[taller]</span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase group-hover:text-slate-200">{t('insert')}</span>
                                                    </div>
                                                    <p className="text-slate-400 text-xs mt-1">{t('token_taller_desc')}</p>
                                                </button>

                                                <button
                                                    onClick={() => handleInsertToken('[datos_contacto_taller]')}
                                                    className="w-full text-left p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-emerald-500/30 group"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-emerald-400 font-black tracking-wider">[datos_contacto_taller]</span>
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase group-hover:text-emerald-400">{t('insert')}</span>
                                                    </div>
                                                    <p className="text-slate-400 text-xs mt-1">{t('token_contacto_desc')}</p>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'services' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-1">
                            <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 sticky top-24">
                                <h3 className="text-xl font-bold text-slate-800">{t('load_service')}</h3>
                                <form onSubmit={handleAddService} className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-slate-600">{t('service_name')}</label>
                                        <input
                                            required
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 font-bold bg-slate-50/50"
                                            placeholder="Alineación y Balanceo"
                                            value={newService.name}
                                            onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-slate-600">{t('base_price_label')}</label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 font-bold bg-slate-50/50"
                                            placeholder="25000"
                                            value={newService.base_price}
                                            onChange={(e) => setNewService({ ...newService, base_price: e.target.value })}
                                        />
                                    </div>
                                    <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 flex items-center justify-center gap-2">
                                        <Plus size={20} /> {t('add_to_catalog')}
                                    </button>
                                </form>
                            </section>
                        </div>

                        <div className="md:col-span-2">
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-5">{t('service_task')}</th>
                                            <th className="px-8 py-5">{t('suggested_labor')}</th>
                                            <th className="px-8 py-5 text-right">{t('actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {services.map(service => (
                                            <ServiceRow key={service.id} service={service} onDelete={handleDeleteService} />
                                        ))}
                                        {services.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-8 py-10 text-center text-slate-400 italic">{t('no_services_found')}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
                }

                {
                    activeTab === 'users' && hasPermission('users') && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="md:col-span-1">
                                <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 sticky top-24">
                                    <h3 className="text-xl font-bold text-slate-800">{t('create_user')}</h3>
                                    <form onSubmit={handleCreateUser} className="space-y-4">
                                        <ConfigInput label={t('username_label')} value={newUser.username} onChange={(v) => setNewUser({ ...newUser, username: v })} />
                                        <ConfigInput label={t('password_label')} type="password" value={newUser.password} onChange={(v) => setNewUser({ ...newUser, password: v })} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <ConfigInput label={t('first_name')} value={newUser.first_name} onChange={(v) => setNewUser({ ...newUser, first_name: v })} />
                                            <ConfigInput label={t('last_name')} value={newUser.last_name} onChange={(v) => setNewUser({ ...newUser, last_name: v })} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-bold text-slate-900 ml-1">{t('role_label')}</label>
                                            <select
                                                className="w-full px-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-slate-50/50 text-slate-900 font-bold"
                                                value={newUser.role_id}
                                                onChange={(e) => setNewUser({ ...newUser, role_id: e.target.value })}
                                                required
                                            >
                                                <option value="">{t('select_role')}</option>
                                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                            </select>
                                        </div>
                                        <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 flex items-center justify-center gap-2">
                                            <Plus size={20} /> {t('create_user')}
                                        </button>
                                    </form>
                                </section>
                            </div>
                            <div className="md:col-span-2">
                                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-100">
                                            <tr>
                                                <th className="px-8 py-5">{t('username_label')}</th>
                                                <th className="px-8 py-5">{t('full_name')}</th>
                                                <th className="px-8 py-5">{t('current_role')}</th>
                                                <th className="px-8 py-5 text-right">{t('actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {users.map(u => (
                                                <UserRow key={u.id} userItem={u} roles={roles} onUpdate={handleUpdateUser} onDelete={handleDeleteUser} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    activeTab === 'roles' && hasPermission('roles') && (
                        <div className="space-y-8">
                            <div className="flex justify-between items-center">
                                <h3 className="text-2xl font-bold text-slate-800 italic uppercase">{t('audit_editor_title')}</h3>
                                <button onClick={handleCreateRole} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 shadow-lg flex items-center gap-2">
                                    <Plus size={16} /> {t('new_role')}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {roles.map(role => (
                                    <RoleCard
                                        key={role.id}
                                        role={role}
                                        permissionsList={permissionsList.filter(p => {
                                            const isModuleEnabled = config.enabled_modules?.includes(p);
                                            const isAdminUser = currentUser?.isSuperuser || (currentUser?.role && (currentUser.role.toLowerCase() === 'admin' || currentUser.role.toLowerCase() === 'administrador'));
                                            const hasPerm = isAdminUser || (currentUser?.permissions && currentUser.permissions.includes(p));
                                            return isModuleEnabled && hasPerm;
                                        })}
                                        permissionLabels={permissionLabels}
                                        onUpdate={handleUpdateRole}
                                        onDelete={handleDeleteRole}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                }

                {
                    activeTab === 'appearance' && (
                        <div className="max-w-4xl space-y-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">{t('appearance_tab')}</h3>
                                <p className="text-slate-500 text-sm mt-1 font-bold">{t('appearance_desc')}</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {THEMES.map(theme => {
                                    const active = currentTheme === theme.id;
                                    return (
                                        <button
                                            key={theme.id}
                                            onClick={() => handleThemeChange(theme.id)}
                                            className={`relative text-left rounded-[28px] overflow-hidden border-2 transition-all duration-200 group hover:scale-[1.02] hover:shadow-2xl ${active
                                                ? 'border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-400/30'
                                                : 'border-transparent shadow-sm hover:border-slate-200'
                                                }`}
                                            style={{ background: theme.preview.surface }}
                                        >
                                            {/* Color strip preview */}
                                            <div className="h-24 relative overflow-hidden" style={{ background: theme.preview.bg }}>
                                                {/* Sidebar preview */}
                                                <div className="absolute left-0 top-0 bottom-0 w-10" style={{ background: theme.preview.sidebar }} />
                                                {/* Fake cards */}
                                                <div className="absolute left-14 top-3 right-3 h-4 rounded-lg opacity-80" style={{ background: theme.preview.surface }} />
                                                <div className="absolute left-14 top-10 right-8 h-3 rounded-lg opacity-50" style={{ background: theme.preview.surface }} />
                                                <div className="absolute left-14 top-16 w-16 h-3 rounded-lg" style={{ background: theme.preview.accent }} />
                                                {/* Accent dot */}
                                                <div className="absolute left-3.5 top-4 w-3 h-3 rounded-full" style={{ background: theme.preview.accent }} />
                                                <div className="absolute left-3.5 top-9 w-3 h-3 rounded-full opacity-40" style={{ background: theme.preview.accent }} />
                                                <div className="absolute left-3.5 top-14 w-3 h-3 rounded-full opacity-40" style={{ background: theme.preview.accent }} />
                                            </div>

                                            {/* Info */}
                                            <div className="p-5" style={{ background: theme.preview.surface }}>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl">{theme.emoji}</span>
                                                            <span className="font-black text-sm uppercase tracking-wider" style={{ color: theme.preview.text }}>
                                                                {theme.name}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs mt-1 font-bold" style={{ color: theme.preview.accent, opacity: 0.8 }}>
                                                            {t(`theme_${theme.id}_desc`)}
                                                        </p>
                                                    </div>
                                                    {active && (
                                                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: theme.preview.accent }}>
                                                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                                <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="bg-white rounded-3xl border border-slate-100 p-6 flex items-center gap-4 shadow-sm">
                                <span className="text-2xl">💡</span>
                                <div>
                                    <p className="font-black text-slate-800 text-sm">Cambio Global</p>
                                    <p className="text-xs text-slate-500 font-bold mt-0.5">El tema seleccionado se guarda en la configuración de tu taller y afecta a toda la plataforma para tus clientes y empleados.</p>
                                </div>
                            </div>
                        </div>
                    )
                }
                {
                    activeTab === 'logs' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
                                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-50 pb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl shadow-slate-900/10">
                                            <Activity size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Historial de Sistema</h3>
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Visor de errores y logs técnicos por taller</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handlePurgeLogs('old')}
                                            className="bg-slate-100 text-slate-600 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                                        >
                                            Limpiar {'>'} 1 mes
                                        </button>
                                        <button
                                            onClick={() => handlePurgeLogs('all')}
                                            className="bg-red-50 text-red-600 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
                                        >
                                            Borrar Todo
                                        </button>
                                        <button
                                            onClick={fetchSystemLogs}
                                            className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 shadow-lg shadow-blue-500/20 transition-all"
                                        >
                                            Refrescar
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {loadingLogs ? (
                                        <div className="py-20 text-center">
                                            <RefreshCw className="animate-spin mx-auto text-blue-500 mb-4" size={32} />
                                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando registros...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-3xl">
                                                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                    <Shield size={14} /> Logs en Base de Datos
                                                </h4>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr className="border-b border-blue-100/50">
                                                                <th className="text-[10px] font-black text-blue-400 uppercase tracking-widest text-left py-4 px-2">Nivel</th>
                                                                <th className="text-[10px] font-black text-blue-400 uppercase tracking-widest text-left py-4 px-2">Mensaje</th>
                                                                <th className="text-[10px] font-black text-blue-400 uppercase tracking-widest text-left py-4 px-2">Ruta/Método</th>
                                                                <th className="text-[10px] font-black text-blue-400 uppercase tracking-widest text-left py-4 px-2">Usuario</th>
                                                                <th className="text-[10px] font-black text-blue-400 uppercase tracking-widest text-left py-4 px-2">Fecha</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-blue-50">
                                                            {systemLogs.length === 0 ? (
                                                                <tr>
                                                                    <td colSpan={5} className="py-12 text-center text-slate-400 font-bold text-sm italic">No hay logs registrados en la base de datos</td>
                                                                </tr>
                                                            ) : (
                                                                systemLogs.map(log => (
                                                                    <tr key={log.id} className="hover:bg-blue-600/5 transition-colors group">
                                                                        <td className="py-4 px-2">
                                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${log.level === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                                {log.level}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-4 px-2 max-w-sm">
                                                                            <p className="text-xs font-bold text-slate-800 break-words">{log.message}</p>
                                                                            {log.stack_trace && (
                                                                                <details className="mt-2 group/stack">
                                                                                    <summary className="text-[9px] font-black text-slate-400 uppercase cursor-pointer hover:text-slate-600">Ver Stack Trace</summary>
                                                                                    <pre className="mt-2 p-3 bg-slate-900 text-blue-400 text-[10px] rounded-xl overflow-x-auto font-mono leading-relaxed">
                                                                                        {log.stack_trace}
                                                                                    </pre>
                                                                                </details>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-4 px-2">
                                                                            <div className="flex flex-col gap-1">
                                                                                <span className="text-[10px] font-black text-slate-400">{log.method}</span>
                                                                                <span className="text-[10px] font-bold text-slate-600 font-mono truncate max-w-[150px]">{log.path}</span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-4 px-2">
                                                                            <span className="text-[10px] font-black text-slate-900 uppercase">@{log.user_name || 'System'}</span>
                                                                        </td>
                                                                        <td className="py-4 px-2 whitespace-nowrap">
                                                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(log.created_at).toLocaleString()}</span>
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-3xl">
                                                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                    <AlertCircle size={14} /> Fallback Logs (Archivo) - Fallos de DB
                                                </h4>
                                                <div className="space-y-3">
                                                    {fileLogs.length === 0 ? (
                                                        <p className="py-8 text-center text-slate-400 font-bold text-xs italic">No hay logs críticos registrados en el sistema de archivos</p>
                                                    ) : (
                                                        fileLogs.map((log, i) => (
                                                            <div key={i} className="bg-white border border-amber-100 p-4 rounded-2xl shadow-sm text-xs">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-[9px] font-black text-amber-600 uppercase bg-amber-100 px-2 py-0.5 rounded">CRITICAL / FILE</span>
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{log.timestamp}</span>
                                                                </div>
                                                                <p className="font-bold text-slate-900 mb-1">{log.message}</p>
                                                                {log.stack && (
                                                                    <pre className="mt-2 p-3 bg-slate-900 text-amber-500 text-[9px] rounded-xl overflow-x-auto font-mono">
                                                                        {log.stack}
                                                                    </pre>
                                                                )}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </section>
                        </div>
                    )
                }
                {activeTab === 'vehicles' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
                            <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                                <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-xl shadow-blue-600/10">
                                    <Database size={24} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Base de Modelos</h3>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Marcas, Modelos y Versiones</p>
                                </div>
                            </div>

                            <form onSubmit={handleAddVehicleRef} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marca</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 font-bold uppercase text-xs outline-none focus:border-blue-500"
                                        placeholder="Ej: TOYOTA"
                                        value={newRef.brand}
                                        onChange={e => setNewRef({ ...newRef, brand: e.target.value.toUpperCase() })}
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modelo</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 font-bold uppercase text-xs outline-none focus:border-blue-500"
                                        placeholder="Ej: HILUX"
                                        value={newRef.model}
                                        onChange={e => setNewRef({ ...newRef, model: e.target.value.toUpperCase() })}
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Versión (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 font-bold uppercase text-xs outline-none focus:border-blue-500"
                                        placeholder="Ej: SRV 4x4"
                                        value={newRef.version}
                                        onChange={e => setNewRef({ ...newRef, version: e.target.value.toUpperCase() })}
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        type="submit"
                                        className="w-full py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg active:scale-95"
                                    >
                                        <Plus size={14} className="inline mr-1" /> Agregar
                                    </button>
                                </div>
                            </form>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {vehicleRefs.map((ref: any) => (
                                    <div key={ref.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-blue-200 transition-all">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">{ref.brand}</span>
                                                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                <span className="text-sm font-black text-slate-800 uppercase italic leading-none">{ref.model}</span>
                                            </div>
                                            {ref.version && (
                                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">{ref.version}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteVehicleRef(ref.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}
            </div>

            {isLogoOpen && config.logo_path && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setIsLogoOpen(false)}
                >
                    <div
                        className="relative max-w-5xl w-full flex items-center justify-center animate-in zoom-in duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setIsLogoOpen(false)}
                            className="absolute -top-16 right-0 text-white/70 hover:text-white transition-all p-2 hover:bg-white/10 rounded-full"
                        >
                            <X size={40} strokeWidth={1.5} />
                        </button>
                        <img
                            src={(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '') + config.logo_path}
                            alt="Logo Extendido"
                            className="max-h-[85vh] max-w-full object-contain rounded-[40px] shadow-2xl bg-white p-12"
                        />
                    </div>
                </div>
            )}
        </div >
    );
}

function UserRow({ userItem, roles, onUpdate, onDelete }: { userItem: any, roles: any[], onUpdate: (id: number, data: any) => void, onDelete: (id: number) => void }) {
    const [editing, setEditing] = useState(false);
    const [data, setData] = useState({
        username: userItem.username,
        role_id: userItem.role_id,
        first_name: userItem.first_name || '',
        last_name: userItem.last_name || ''
    });

    const handleSave = () => {
        onUpdate(userItem.id, data);
        setEditing(false);
    };

    return (
        <tr className="hover:bg-slate-50 transition-colors">
            <td className="px-8 py-6">
                {editing ? (
                    <input
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-800 w-full"
                        value={data.username || ''}
                        onChange={e => setData({ ...data, username: e.target.value })}
                    />
                ) : (
                    <span className="font-bold text-slate-800">{userItem.username}</span>
                )}
            </td>
            <td className="px-8 py-6">
                {editing ? (
                    <div className="flex gap-2">
                        <input
                            className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-800 w-full"
                            value={data.first_name || ''}
                            onChange={e => setData({ ...data, first_name: e.target.value })}
                            placeholder="Nombre"
                        />
                        <input
                            className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-800 w-full"
                            value={data.last_name || ''}
                            onChange={e => setData({ ...data, last_name: e.target.value })}
                            placeholder="Apellido"
                        />
                    </div>
                ) : (
                    <span className="font-medium text-slate-600">
                        {userItem.first_name || ''} {userItem.last_name || ''}
                    </span>
                )}
            </td>
            <td className="px-8 py-6">
                {editing ? (
                    <select
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-800 w-full"
                        value={data.role_id}
                        onChange={e => setData({ ...data, role_id: e.target.value })}
                    >
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                ) : (
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100 italic">
                        {userItem.role_name || 'Sin Rol'}
                    </span>
                )}
            </td>
            <td className="px-8 py-6 text-right">
                <div className="flex justify-end gap-2">
                    {editing ? (
                        <>
                            <button onClick={handleSave} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold">Guardar</button>
                            <button onClick={() => setEditing(false)} className="text-slate-400 text-xs font-bold">Cancelar</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-blue-600 p-2">
                                <Save size={18} />
                            </button>
                            <button onClick={() => onDelete(userItem.id)} className="text-slate-300 hover:text-red-500 p-2">
                                <Trash2 size={18} />
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}

function RoleCard({ role, permissionsList, permissionLabels, onUpdate, onDelete }: { role: any, permissionsList: string[], permissionLabels: { [key: string]: string }, onUpdate: (id: number, data: any) => void, onDelete: (id: number) => void }) {
    const isSystemAdmin = role.name.toLowerCase() === 'admin' || role.name.toLowerCase() === 'administrador';
    const [editingName, setEditingName] = useState(false);
    const [name, setName] = useState(role.name);

    const togglePermission = (perm: string) => {
        if (isSystemAdmin) return;
        const newPermissions = role.permissions.includes(perm)
            ? role.permissions.filter((p: string) => p !== perm)
            : [...role.permissions, perm];
        onUpdate(role.id, { permissions: newPermissions });
    };

    const handleSaveName = () => {
        onUpdate(role.id, { name });
        setEditingName(false);
    };

    return (
        <div className={`bg-white rounded-3xl border ${isSystemAdmin ? 'border-blue-500 shadow-xl shadow-blue-500/10' : 'border-slate-100 shadow-sm'} overflow-hidden flex flex-col`}>
            <div className={`p-6 ${isSystemAdmin ? 'bg-blue-600' : 'bg-slate-900'} text-white`}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Shield size={24} className={isSystemAdmin ? 'text-blue-200' : 'text-slate-400'} />
                        {editingName ? (
                            <div className="flex gap-2">
                                <input
                                    className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white font-bold text-sm outline-none"
                                    value={name || ''}
                                    onChange={e => setName(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={handleSaveName} className="text-white bg-emerald-500 px-2 py-1 rounded text-[10px] font-black uppercase">Ok</button>
                            </div>
                        ) : (
                            <h4 className="text-lg font-black italic uppercase tracking-tighter">{role.name}</h4>
                        )}
                    </div>
                    {!isSystemAdmin && (
                        <div className="flex gap-2">
                            <button onClick={() => setEditingName(true)} className="text-white/50 hover:text-white transition-all"><Save size={16} /></button>
                            <button onClick={() => onDelete(role.id)} className="text-white/50 hover:text-red-400 transition-all"><Trash2 size={16} /></button>
                        </div>
                    )}
                </div>
                {isSystemAdmin && <p className="text-blue-100 text-[10px] mt-2 font-bold uppercase tracking-widest opacity-80 italic">Reservado por el sistema (No editable)</p>}
            </div>

            <div className="p-6 flex-grow space-y-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Permisos del Rol</p>
                <div className="space-y-3">
                    {permissionsList.map(perm => (
                        <div key={perm} className="flex items-center justify-between group">
                            <span className={`text-xs font-bold uppercase tracking-wider ${role.permissions.includes(perm) ? 'text-slate-800' : 'text-slate-400'}`}>
                                {permissionLabels[perm] || perm.replace('_', ' ')}
                            </span>
                            <div
                                onClick={() => togglePermission(perm)}
                                className={`w-10 h-5 rounded-full relative cursor-pointer transition-all duration-300 ${role.permissions.includes(perm) ? (isSystemAdmin ? 'bg-blue-100 cursor-not-allowed' : 'bg-blue-600 shadow-lg shadow-blue-500/20') : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all duration-300 ${role.permissions.includes(perm) ? 'left-6' : 'left-1'}`} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ServiceRow({ service, onDelete }: { service: any, onDelete: (id: number) => void }) {
    const { notify } = useNotification();
    const [editing, setEditing] = useState(false);
    const [data, setData] = useState({ name: service.name, base_price: service.base_price });

    const handleSave = async () => {
        try {
            await api.put(`/services/${service.id}`, data);
            setEditing(false);
            window.location.reload(); // Simple refresh to show changes
        } catch (err) {
            notify('error', 'Error al actualizar');
        }
    };

    return (
        <tr className="hover:bg-slate-50 transition-colors group">
            <td className="px-8 py-6">
                {editing ? (
                    <input
                        value={data.name || ''}
                        onChange={e => setData({ ...data, name: e.target.value })}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-800 w-full"
                    />
                ) : (
                    <span className="font-bold text-slate-800">{service.name}</span>
                )}
            </td>
            <td className="px-8 py-6">
                {editing ? (
                    <div className="flex items-center gap-1">
                        <DollarSign size={14} />
                        <input
                            type="number"
                            value={data.base_price || 0}
                            onChange={e => setData({ ...data, base_price: parseFloat(e.target.value) })}
                            className="bg-white border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-800 w-32"
                        />
                    </div>
                ) : (
                    <span className="font-bold text-slate-500 italic uppercase tabular-nums">
                        ${service.base_price?.toLocaleString('es-AR')}
                    </span>
                )}
            </td>
            <td className="px-8 py-6 text-right">
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editing ? (
                        <>
                            <button onClick={handleSave} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold">Guardar</button>
                            <button onClick={() => setEditing(false)} className="text-slate-400 text-xs font-bold">Cancelar</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-blue-600 p-2">
                                <Save size={18} />
                            </button>
                            <button onClick={() => onDelete(service.id)} className="text-slate-300 hover:text-red-500 p-2">
                                <Trash2 size={18} />
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}

function TabButton({ active, icon, label, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`
        flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all
        ${active ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}
      `}
        >
            {icon}
            {label}
        </button>
    );
}

function ConfigInput({ label, icon, value, onChange, type = 'text', placeholder }: { label: string, icon?: React.ReactNode, value: any, onChange: (v: any) => void, type?: string, placeholder?: string }) {
    return (
        <div className="space-y-1">
            <label className="text-sm font-bold text-slate-900 ml-1">{label}</label>
            <div className="relative">
                {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">{icon}</div>}
                <input
                    type={type}
                    className={`w-full ${icon ? 'pl-12' : 'px-5'} pr-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-slate-50/50 text-slate-900 font-bold`}
                    placeholder={placeholder}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
        </div>
    );
}
function HourRangeSelector({ label, value, onChange, optional = false }: { label: string, value: string, onChange: (v: string) => void, optional?: boolean }) {
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    const parts = value?.split(' - ') || ['', ''];
    const [start, end] = parts.length === 2 ? parts : ['', ''];

    const handleStartChange = (h: string) => {
        if (!h && optional) onChange('');
        else onChange(`${h} - ${end || '18:00'}`);
    };

    const handleEndChange = (h: string) => {
        onChange(`${start || '09:00'} - ${h}`);
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-xs font-black text-slate-900 uppercase tracking-widest ml-1">{label}</label>
                {optional && value && (
                    <button onClick={() => onChange('')} className="text-[10px] font-bold text-red-500 uppercase">Eliminar</button>
                )}
            </div>
            <div className="flex items-center gap-2">
                <select
                    className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={start}
                    onChange={(e) => handleStartChange(e.target.value)}
                >
                    <option value="">{optional ? '-- Cerrado --' : 'Desde'}</option>
                    {hours.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-slate-300 font-bold">a</span>
                <select
                    className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={end}
                    onChange={(e) => handleEndChange(e.target.value)}
                    disabled={!start && optional}
                >
                    <option value="">Hasta</option>
                    {hours.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
            </div>
        </div>
    );
}
