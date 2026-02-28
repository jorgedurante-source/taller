'use client';

import { useSlug } from '@/lib/slug';
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
    ChevronLeft,
    Car,
    Save,
    X,
    Hash,
    Calendar,
    Gauge,
    Info
} from 'lucide-react';
import Link from 'next/link';
import { useNotification } from '@/lib/notification';
import { useAuth } from '@/lib/auth';
import VehicleAutocomplete from '@/components/VehicleAutocomplete';

export default function EditVehiclePage() {
    const { slug } = useSlug();
    const params = useParams();
    const router = useRouter();
    const { notify } = useNotification();
    const { hasPermission } = useAuth();

    const [vehicle, setVehicle] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        brand: '',
        model: '',
        version: '',
        plate: '',
        year: '',
        km: '',
        status: 'active'
    });

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/clients/all-vehicles');
            const currentVehicle = res.data.find((v: any) => v.id === parseInt(params.id as string));

            if (currentVehicle) {
                setVehicle(currentVehicle);
                setFormData({
                    brand: currentVehicle.brand || '',
                    model: currentVehicle.model || '',
                    version: currentVehicle.version || '',
                    plate: currentVehicle.plate || '',
                    year: currentVehicle.year || '',
                    km: currentVehicle.km || '',
                    status: currentVehicle.status || 'active'
                });
            } else {
                notify('error', 'Vehículo no encontrado');
                router.push(`/${slug}/dashboard/vehicles`);
            }
        } catch (err) {
            console.error('Error fetching vehicle', err);
            notify('error', 'Error al cargar datos del vehículo');
        } finally {
            setLoading(false);
        }
    }, [params.id, router, slug, notify]);

    useEffect(() => {
        if (!hasPermission('vehicles')) {
            router.push(`/${slug}/dashboard`);
            return;
        }
        fetchData();
    }, [fetchData, hasPermission, router, slug]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put(`/clients/vehicles/${params.id}`, formData);
            notify('success', 'Vehículo actualizado correctamente');
            router.push(`/${slug}/dashboard/vehicles/${params.id}`);
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al actualizar vehículo');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-20 text-center font-bold text-slate-400 animate-pulse uppercase tracking-widest">Cargando datos del vehículo...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/${slug}/dashboard/vehicles/${params.id}`} className="bg-white p-3 rounded-2xl border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm transition-all">
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Editar Vehículo</h2>
                        <p className="text-slate-500 font-bold tracking-wider uppercase text-[10px] mt-1 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                            Actualizando Legajo #{params.id}
                        </p>
                    </div>
                </div>
            </header>

            <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden">
                <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600/20 p-3 rounded-2xl text-blue-400 border border-blue-500/30">
                            <Car size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Vehículo Actual</p>
                            <h3 className="text-xl font-black uppercase italic tracking-tighter">{vehicle?.brand} {vehicle?.model}</h3>
                        </div>
                    </div>
                    <div className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 font-mono font-bold text-blue-400 tracking-widest">
                        {vehicle?.plate}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 lg:p-12 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Plate */}
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                <Hash size={12} className="text-blue-600" /> Patente
                            </label>
                            <input
                                required
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-4 focus:ring-blue-100 transition-all outline-none text-lg tracking-widest uppercase"
                                value={formData.plate}
                                onChange={e => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                                placeholder="AAA 123"
                            />
                        </div>

                        {/* Status */}
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                <Info size={12} className="text-blue-600" /> Estado del Vehículo
                            </label>
                            <select
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-4 focus:ring-blue-100 transition-all outline-none appearance-none"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="active">Activo</option>
                                <option value="inactive">Inactivo (No disponible para servicios)</option>
                            </select>
                        </div>

                        {/* Brand */}
                        <div className="md:col-span-2">
                            <VehicleAutocomplete
                                label="Marca"
                                value={formData.brand}
                                onChange={(v) => setFormData({ ...formData, brand: v, model: '', version: '' })}
                                type="brand"
                                placeholder="Ej: TOYOTA"
                                required
                            />
                        </div>

                        {/* Model */}
                        <div>
                            <VehicleAutocomplete
                                label="Modelo"
                                value={formData.model}
                                onChange={(v) => setFormData({ ...formData, model: v, version: '' })}
                                type="model"
                                filters={{ brand: formData.brand }}
                                placeholder="Ej: HILUX"
                                required
                            />
                        </div>

                        {/* Version */}
                        <div>
                            <VehicleAutocomplete
                                label="Versión (Opcional)"
                                value={formData.version}
                                onChange={(v) => setFormData({ ...formData, version: v })}
                                type="version"
                                filters={{ brand: formData.brand, model: formData.model }}
                                placeholder="Ej: SRV 4x4"
                            />
                        </div>

                        {/* Year */}
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                <Calendar size={12} className="text-blue-600" /> Año de Fabricación
                            </label>
                            <input
                                type="number"
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                                value={formData.year}
                                onChange={e => setFormData({ ...formData, year: e.target.value })}
                                placeholder="Ej: 2020"
                            />
                        </div>

                        {/* KM */}
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                <Gauge size={12} className="text-blue-600" /> Kilometraje Actual
                            </label>
                            <input
                                type="number"
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                                value={formData.km}
                                onChange={e => setFormData({ ...formData, km: e.target.value })}
                                placeholder="Ej: 85000"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-6">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 bg-blue-600 text-white font-black py-5 rounded-[2rem] shadow-xl shadow-blue-100 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {saving ? 'Guardando...' : <><Save size={18} /> Guardar Cambios</>}
                        </button>
                        <Link
                            href={`/${slug}/dashboard/vehicles/${params.id}`}
                            className="flex-1 bg-slate-100 text-slate-500 font-black py-5 rounded-[2rem] hover:bg-slate-200 transition-all text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                        >
                            <X size={18} /> Cancelar y Volver
                        </Link>
                    </div>
                </form>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-8 rounded-[3rem] flex items-start gap-6">
                <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg">
                    <Info size={24} />
                </div>
                <div>
                    <h4 className="font-black text-blue-900 uppercase italic tracking-tight mb-2">Información sobre Actualizaciones</h4>
                    <p className="text-sm font-bold text-blue-700 leading-relaxed">
                        Los cambios realizados en el kilometraje quedarán registrados automáticamente en la cronología del vehículo con la fecha de hoy. Si la patente ya existe en el sistema para otro vehículo, el sistema impedirá el guardado para evitar duplicados.
                    </p>
                </div>
            </div>
        </div>
    );
}
