'use client';

import React, { useState, useEffect } from 'react';
import { Save, Shield, Mail, Package, AlertTriangle, CheckCircle2, ArrowLeft, Globe, DollarSign, Bell, Palette, Archive } from 'lucide-react';
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
        superadmin_theme: 'default',
        backup_enabled: 'false',
        backup_frequency: 'daily',
        backup_retention: '7'
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


                    {/* Automated Backups Section */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-[1.5rem]">
                                <Archive size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Backups Automáticos</h2>
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Respaldo Programado del Sistema</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Estado de Backups</label>
                                <select
                                    value={settings.backup_enabled}
                                    onChange={(e) => setSettings({ ...settings, backup_enabled: e.target.value })}
                                    className={`w-full bg-slate-50 border-none rounded-2xl p-5 text-slate-900 focus:ring-4 transition-all font-black uppercase text-xs tracking-widest ${settings.backup_enabled === 'true' ? 'text-emerald-600 focus:ring-emerald-100' : 'text-slate-400 focus:ring-slate-100'}`}
                                >
                                    <option value="false">DESACTIVADOS</option>
                                    <option value="true">ACTIVADOS (DIARIO 3 AM)</option>
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Frecuencia</label>
                                <select
                                    disabled
                                    value={settings.backup_frequency}
                                    className="w-full bg-slate-50 border-none rounded-2xl p-5 text-slate-300 transition-all font-black uppercase text-xs tracking-widest cursor-not-allowed"
                                >
                                    <option value="daily">DIARIO (FIJO)</option>
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Retención (Copias)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={settings.backup_retention}
                                    onChange={(e) => setSettings({ ...settings, backup_retention: e.target.value })}
                                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-slate-900 focus:ring-4 focus:ring-indigo-100 transition-all font-black"
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 italic mt-4 ml-1">
                            * Los backups se almacenan localmente en el servidor. Recomendamos descargar backups externos regularmente para mayor seguridad.
                        </p>
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
