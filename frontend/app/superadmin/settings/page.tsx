'use client';

import React, { useState, useEffect } from 'react';
import { Save, Shield, Mail, Package, AlertTriangle, CheckCircle2, ArrowLeft, Globe, DollarSign, Bell, Palette } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { superApi } from '@/lib/api';
import { useConfig } from '@/lib/config';
import { useNotification } from '@/lib/notification';
import { THEMES, applyTheme } from '@/lib/theme';

export default function SuperAdminSettings() {
    const [settings, setSettings] = useState({
        product_name: '',
        maintenance_mode: 'false',
        allow_new_registrations: 'true',
        support_email: '',
        system_currency: '$',
        system_announcement: '',
        superadmin_theme: 'default'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const router = useRouter();
    const { refreshConfig } = useConfig();
    const { notify } = useNotification();

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await superApi.get('/settings');
            setSettings(prev => ({ ...prev, ...res.data }));
        } catch (err) {
            console.error('Error fetching settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await superApi.post('/settings', settings);
            // Save theme locally for immediate effect
            if (settings.superadmin_theme) {
                localStorage.setItem('mechub-super-theme', settings.superadmin_theme);
                applyTheme(settings.superadmin_theme);
            }
            notify('success', 'Configuraciones guardadas correctamente');
            await refreshConfig();
        } catch (err) {
            notify('error', 'Error al guardar configuraciones');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    );

    return (
        <div className="min-h-screen">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => router.push('/superadmin/dashboard')}
                    className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold mb-8 transition-colors group"
                >
                    <div className="p-2 bg-white rounded-xl border border-slate-100 group-hover:border-indigo-100 group-hover:bg-indigo-50 transition-all">
                        <ArrowLeft size={18} />
                    </div>
                    Volver al Dashboard
                </button>

                <header className="mb-10">
                    <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase italic tracking-tighter leading-none">Configuración Global</h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-3">Control Maestro del Ecosistema</p>
                </header>

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Branding & Region */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-[1.5rem]">
                                <Globe size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Identidad y Región</h2>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Global Branding</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre del Sistema</label>
                                <input
                                    type="text"
                                    value={settings.product_name}
                                    onChange={(e) => setSettings({ ...settings, product_name: e.target.value })}
                                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-900 focus:ring-4 focus:ring-indigo-100 transition-all font-black text-lg italic"
                                    placeholder="MechHub"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Moneda del Sistema</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        <DollarSign size={20} />
                                    </div>
                                    <input
                                        type="text"
                                        value={settings.system_currency}
                                        onChange={(e) => setSettings({ ...settings, system_currency: e.target.value })}
                                        className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 text-slate-900 focus:ring-4 focus:ring-indigo-100 transition-all font-black text-lg"
                                        placeholder="$"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Announcement Section */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-4 bg-amber-50 text-amber-600 rounded-[1.5rem]">
                                <Bell size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Comunicación</h2>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Global Broadcast</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Anuncio Global</label>
                            <textarea
                                value={settings.system_announcement}
                                onChange={(e) => setSettings({ ...settings, system_announcement: e.target.value })}
                                className="w-full bg-slate-50 border-none rounded-2xl p-5 text-slate-900 focus:ring-4 focus:ring-amber-50 transition-all font-bold min-h-[120px]"
                                placeholder="Escribe un mensaje que verán todos los talleres en su dashboard..."
                            />
                            <p className="text-[10px] text-slate-400 italic ml-1">Deja vacío para no mostrar ningún anuncio.</p>
                        </div>
                    </div>

                    {/* System Access Section */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-4 bg-slate-950 text-white rounded-[1.5rem]">
                                <Shield size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Políticas de Acceso</h2>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Service Availability</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Modo Mantenimiento</label>
                                <select
                                    value={settings.maintenance_mode}
                                    onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.value })}
                                    className="w-full bg-slate-50 border-none rounded-2xl p-5 text-slate-900 focus:ring-4 focus:ring-slate-100 transition-all font-black uppercase text-xs tracking-widest"
                                >
                                    <option value="false">OPERATIVO (NORMAL)</option>
                                    <option value="true">MANTENIMIENTO (SÓLO SUPERADMIN)</option>
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Nuevos Registros</label>
                                <select
                                    value={settings.allow_new_registrations}
                                    onChange={(e) => setSettings({ ...settings, allow_new_registrations: e.target.value })}
                                    className="w-full bg-slate-50 border-none rounded-2xl p-5 text-slate-900 focus:ring-4 focus:ring-slate-100 transition-all font-black uppercase text-xs tracking-widest"
                                >
                                    <option value="true">PERMITIDOS</option>
                                    <option value="false">SUSPENDIDOS</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Support Section */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-4 bg-sky-50 text-sky-600 rounded-[1.5rem]">
                                <Mail size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Soporte Técnico</h2>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Contact Information</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Email de Contacto</label>
                            <input
                                type="email"
                                value={settings.support_email}
                                onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                                className="w-full bg-slate-50 border-none rounded-2xl p-5 text-slate-900 focus:ring-4 focus:ring-sky-50 transition-all font-bold"
                                placeholder="soporte@surforge.com"
                            />
                        </div>
                    </div>

                    {/* Theme Customization */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-[1.5rem]">
                                <Palette size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Estilo del Panel</h2>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">SuperAdmin Interface Theme</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {THEMES.map((theme) => (
                                <div
                                    key={theme.id}
                                    onClick={() => setSettings({ ...settings, superadmin_theme: theme.id })}
                                    className={`relative p-6 rounded-[2rem] border-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${settings.superadmin_theme === theme.id
                                        ? 'border-indigo-600 bg-indigo-50/30'
                                        : 'border-slate-100 bg-slate-50/30 hover:border-slate-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-2xl">{theme.emoji}</span>
                                        <div>
                                            <h4 className="font-black text-slate-900 uppercase italic tracking-tighter text-sm leading-none">{theme.name}</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{theme.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5 h-6">
                                        <div className="flex-1 rounded-full border border-slate-200" style={{ backgroundColor: theme.preview.bg }}></div>
                                        <div className="flex-1 rounded-full border border-slate-200" style={{ backgroundColor: theme.preview.accent }}></div>
                                        <div className="flex-1 rounded-full border border-slate-200" style={{ backgroundColor: theme.preview.sidebar }}></div>
                                    </div>
                                    {settings.superadmin_theme === theme.id && (
                                        <div className="absolute top-4 right-4 text-indigo-600">
                                            <CheckCircle2 size={20} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end pt-8">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-3 bg-slate-900 text-white px-12 py-6 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-2xl shadow-slate-200 disabled:opacity-50 active:scale-95 italic"
                        >
                            {saving ? 'Guardando...' : (
                                <>
                                    <Save size={18} />
                                    Actualizar Sistema
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
