'use client';
import { useSlug } from '@/lib/slug';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import {
    ChevronLeft,
    Car,
    User,
    Phone,
    History,
    ClipboardList,
    ArrowRight,
    Clock,
    Wrench,
    Hash,
    Plus,
    Pencil,
    Gauge,
    TrendingUp,
    CheckCircle2,
    Building2
} from 'lucide-react';
import Link from 'next/link';
import { useNotification } from '@/lib/notification';
import { useAuth } from '@/lib/auth';
import { Shield, ShieldAlert, ShieldCheck, ShieldOff, AlertTriangle } from 'lucide-react';
import CrossChainOrderDetailModal from '@/components/CrossChainOrderDetailModal';
import CrossChainHistoryItem from '@/components/CrossChainHistoryItem';

export default function VehicleDetailsPage() {
    console.log('[VehicleDetails] COMPONENT RENDER');
    const { slug } = useSlug();
    const params = useParams();
    const { notify } = useNotification();
    const { hasPermission } = useAuth();
    const { t } = useTranslation();

    if (!hasPermission('vehicles')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
                <Car size={48} className="mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-xs">Módulo no habilitado</p>
                <p className="text-[10px] mt-2 italic">Contacta al administrador para activar esta funcionalidad</p>
            </div>
        );
    }
    const [vehicle, setVehicle] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [kmHistory, setKmHistory] = useState<any[]>([]);
    const [healthData, setHealthData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [chainOrders, setChainOrders] = useState<any[]>([]);
    const [chainOrdersLoading, setChainOrdersLoading] = useState(false);
    const [selectedChainOrderDetail, setSelectedChainOrderDetail] = useState<any>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showChainDetailModal, setShowChainDetailModal] = useState(false);

    // KM edit state
    const [editingKm, setEditingKm] = useState(false);
    const [newKm, setNewKm] = useState('');
    const [kmNotes, setKmNotes] = useState('');
    const [savingKm, setSavingKm] = useState(false);

    const fetchChainHistory = useCallback(async (vehicleId: number) => {
        console.log('[ChainHistory] Fetching for vehicle ID:', vehicleId);
        setChainOrdersLoading(true);
        try {
            const res = await api.get(`/clients/vehicles/${vehicleId}/chain-history`);
            console.log('[ChainHistory] Response:', res.data);
            setChainOrders(res.data.chain_orders || []);
        } catch (err) {
            console.error('[ChainHistory] Error:', err);
            setChainOrders([]);
        } finally {
            setChainOrdersLoading(false);
        }
    }, []);

    const fetchChainOrderDetail = async (peer_slug: string, order_id: number) => {
        if (!vehicle) return;
        setDetailLoading(true);
        setShowChainDetailModal(true);
        try {
            const res = await api.get(`/clients/vehicles/${vehicle.id}/chain-history/${peer_slug}/${order_id}`);
            setSelectedChainOrderDetail(res.data);
        } catch (err) {
            notify('error', 'No se pudo obtener el detalle de la orden remota');
            setShowChainDetailModal(false);
        } finally {
            setDetailLoading(false);
        }
    };

    const fetchData = useCallback(async () => {
        console.log('[VehicleDetails] fetchData STARTED for ID:', params.id);
        try {
            const [vehiclesRes, ordersRes, kmRes, healthRes] = await Promise.all([
                api.get('/clients/all-vehicles'),
                api.get(`/orders?vehicle_id=${params.id}&limit=100`),
                api.get(`/clients/vehicles/${params.id}/km-history`),
                api.get(`/clients/vehicles/${params.id}/health`).catch(() => ({ data: null }))
            ]);

            console.log('[VehicleDetails] Vehicles count:', vehiclesRes.data?.length);
            console.log('[VehicleDetails] Searching for ID:', params.id, 'in vehicles array');

            const currentVehicle = vehiclesRes.data.find((v: any) => {
                // IDs in our DB are numbers, params.id is a string
                return Number(v.id) === Number(params.id);
            });
            console.log('[VehicleDetails] Found vehicle:', currentVehicle?.plate, 'UUID:', currentVehicle?.uuid);
            setVehicle(currentVehicle);
            setOrders(ordersRes.data.data);
            setKmHistory(kmRes.data);
            setHealthData(healthRes.data);
            if (currentVehicle) {
                setNewKm(String(currentVehicle.km || ''));
                fetchChainHistory(currentVehicle.id);
            }
        } catch (err) {
            console.error('Error fetching vehicle details', err);
        } finally {
            setLoading(false);
        }
    }, [params.id, fetchChainHistory]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveKm = async () => {
        if (!newKm || isNaN(Number(newKm))) return;
        setSavingKm(true);
        try {
            await api.put(`/clients/vehicles/${params.id}/km`, {
                km: parseInt(newKm),
                notes: kmNotes || null
            });
            setEditingKm(false);
            setKmNotes('');
            fetchData();
            notify('success', 'Kilometraje actualizado');
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al actualizar kilometraje');
        } finally {
            setSavingKm(false);
        }
    };

    if (loading) return <div className="p-20 text-center font-bold text-slate-400">Cargando expediente...</div>;
    if (!vehicle) return <div className="p-20 text-center font-bold text-slate-400">Vehículo no encontrado</div>;

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'Entregado': return 'bg-slate-900 text-white';
            case 'Finalizado': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            default: return 'bg-blue-50 text-blue-600 border-blue-100';
        }
    };

    // Stats from km history
    const lastTwo = [...kmHistory].reverse().slice(-2);
    const avgDelta = kmHistory.length > 1
        ? Math.round(kmHistory.filter(h => h.delta > 0).reduce((a, h) => a + h.delta, 0) / kmHistory.filter(h => h.delta > 0).length)
        : null;

    return (
        <div className="space-y-8 pb-20">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/${slug}/dashboard/vehicles`} className="bg-white p-3 rounded-2xl border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm transition-all">
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Historial del Vehículo</h2>
                        <p className="text-slate-500 font-bold tracking-wider uppercase text-xs mt-1">Legajo Técnico MechHub</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/${slug}/dashboard/vehicles/${vehicle.id}/edit`}
                        className="bg-white border border-slate-200 text-slate-500 px-4 py-3 rounded-2xl flex items-center gap-2 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm font-black text-xs uppercase tracking-widest"
                    >
                        <Pencil size={16} /> Editar
                    </Link>
                    <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl flex items-center gap-4 shadow-xl">
                        <Hash size={20} className="text-blue-400" />
                        <span className="font-black text-xl tracking-tighter uppercase italic">{vehicle.plate}</span>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Specs + KM + Owner */}
                <div className="space-y-6">
                    {/* Vehicle Card */}
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8 overflow-hidden group">
                        <div className="bg-blue-600 w-20 h-20 rounded-[28px] flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform">
                            <Car size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight mb-1">{vehicle.brand} {vehicle.model}</h3>
                        <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-6">Año: {vehicle.year || '---'}</p>

                        {/* KM Editor */}
                        <div className="bg-slate-50 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Gauge size={16} className="text-blue-600" />
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kilometraje actual</p>
                                </div>
                                {!editingKm && (
                                    <button
                                        onClick={() => { setEditingKm(true); setNewKm(String(vehicle.km || '')); }}
                                        className="text-[10px] font-black text-blue-600 hover:underline uppercase tracking-widest flex items-center gap-1"
                                    >
                                        <Pencil size={11} /> Actualizar
                                    </button>
                                )}
                            </div>

                            {!editingKm ? (
                                <p className="text-3xl font-black text-slate-900 tracking-tighter">
                                    {vehicle.km?.toLocaleString('es-AR') || '---'}
                                    <span className="text-sm font-bold text-slate-400 ml-1">km</span>
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    <input
                                        type="number"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-black text-slate-900 text-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                        value={newKm}
                                        onChange={e => setNewKm(e.target.value)}
                                        placeholder="Ej: 85000"
                                        autoFocus
                                    />
                                    <input
                                        type="text"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder-slate-400"
                                        value={kmNotes}
                                        onChange={e => setKmNotes(e.target.value)}
                                        placeholder="Nota opcional (ej: ingreso al taller)"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSaveKm}
                                            disabled={savingKm}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <CheckCircle2 size={14} /> {savingKm ? 'Guardando...' : 'Guardar'}
                                        </button>
                                        <button
                                            onClick={() => setEditingKm(false)}
                                            className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            )}

                            {avgDelta && (
                                <div className="flex items-center gap-1.5 mt-3 text-emerald-600">
                                    <TrendingUp size={13} />
                                    <p className="text-[10px] font-black uppercase tracking-widest">
                                        Promedio: +{avgDelta.toLocaleString('es-AR')} km/actualización
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Owner Card */}
                    <div className="bg-white border border-slate-100 rounded-[40px] p-8 shadow-sm">
                        <h4 className="font-black uppercase tracking-widest text-[10px] text-blue-600 mb-6 flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-blue-600" />
                            Propietario
                        </h4>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-slate-50 p-2.5 rounded-xl text-blue-600 border border-slate-100">
                                    <User size={18} />
                                </div>
                                <span className="font-black text-[var(--text-primary)] uppercase tracking-tight">{vehicle.first_name} {vehicle.last_name}</span>
                            </div>
                            <a
                                href={`https://wa.me/${vehicle.client_phone?.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-4 hover:text-emerald-600 transition-colors group/phone"
                            >
                                <div className="bg-slate-50 p-2.5 rounded-xl text-emerald-600 border border-slate-100 group-hover/phone:bg-emerald-50 transition-colors">
                                    <Phone size={18} />
                                </div>
                                <span className="font-bold text-slate-600">{vehicle.client_phone}</span>
                            </a>
                        </div>
                        <Link
                            href={`/${slug}/dashboard/clients/${vehicle.client_id}`}
                            className="mt-8 w-full py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-600 transition-all shadow-xl"
                        >
                            Ver Perfil Completo <ArrowRight size={14} />
                        </Link>
                    </div>

                    {/* KM History */}
                    {kmHistory.length > 0 && (
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-amber-50 p-2 rounded-xl text-amber-500">
                                    <Gauge size={18} />
                                </div>
                                <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Historial KM</h4>
                                <span className="ml-auto text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-full">{kmHistory.length} REG.</span>
                            </div>
                            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                {kmHistory.map((entry: any, i: number) => (
                                    <div key={entry.id} className={`p-4 rounded-2xl border ${i === 0 ? 'bg-slate-900 text-white border-transparent' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="flex items-center justify-between">
                                            <span className={`font-black text-lg tracking-tighter ${i === 0 ? 'text-white' : 'text-slate-900'}`}>
                                                {Number(entry.km).toLocaleString('es-AR')} km
                                            </span>
                                            {entry.delta > 0 && (
                                                <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${i === 0 ? 'bg-blue-600/20 text-blue-300' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    +{Number(entry.delta).toLocaleString('es-AR')} km
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {new Date(entry.recorded_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                            {entry.day_diff > 0 && (
                                                <span className="text-[10px] font-bold text-slate-300">
                                                    · {entry.day_diff} días desde anterior
                                                </span>
                                            )}
                                        </div>
                                        {entry.notes && (
                                            <p className="text-[11px] font-bold text-slate-500 mt-1 italic">"{entry.notes}"</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Vehicle Health Card */}
                    {healthData && (
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8 overflow-hidden">
                            <div className="flex items-center gap-3 mb-6">
                                {healthData.healthScore === null ? (
                                    <div className="bg-slate-100 p-2.5 rounded-xl text-slate-400"><Shield size={18} /></div>
                                ) : healthData.healthScore >= 80 ? (
                                    <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600"><ShieldCheck size={18} /></div>
                                ) : healthData.healthScore >= 50 ? (
                                    <div className="bg-amber-50 p-2.5 rounded-xl text-amber-500"><ShieldAlert size={18} /></div>
                                ) : (
                                    <div className="bg-red-50 p-2.5 rounded-xl text-red-500"><ShieldOff size={18} /></div>
                                )}
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salud del Vehículo</p>
                                    {healthData.healthScore !== null ? (
                                        <p className={`text-2xl font-black tracking-tighter ${healthData.healthScore >= 80 ? 'text-emerald-600' :
                                            healthData.healthScore >= 50 ? 'text-amber-500' : 'text-red-500'
                                            }`}>{healthData.healthScore}%</p>
                                    ) : (
                                        <p className="text-xs font-bold text-slate-400 italic">Acumulando datos...</p>
                                    )}
                                </div>
                            </div>

                            {/* Score bar */}
                            {healthData.healthScore !== null && (
                                <div className="w-full h-2 bg-slate-100 rounded-full mb-6 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${healthData.healthScore >= 80 ? 'bg-emerald-500' :
                                            healthData.healthScore >= 50 ? 'bg-amber-400' : 'bg-red-500'
                                            }`}
                                        style={{ width: `${healthData.healthScore}%` }}
                                    />
                                </div>
                            )}

                            {/* Service intervals list */}
                            <div className="space-y-2">
                                {healthData.intervals?.length === 0 && (
                                    <p className="text-[11px] font-bold text-slate-400 italic text-center py-4">
                                        No hay servicios registrados aún
                                    </p>
                                )}
                                {healthData.intervals?.map((interval: any, i: number) => (
                                    <div key={i} className={`flex items-start justify-between p-3 rounded-2xl border transition-all ${interval.status === 'overdue' ? 'bg-red-50 border-red-100' :
                                        interval.status === 'ok' ? 'bg-emerald-50/50 border-emerald-100' :
                                            'bg-slate-50 border-slate-100'
                                        }`}>
                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${interval.status === 'overdue' ? 'bg-red-500' :
                                                interval.status === 'ok' ? 'bg-emerald-500' : 'bg-slate-300'
                                                }`} />
                                            <p className="text-[11px] font-black text-slate-800 uppercase italic tracking-tight truncate">
                                                {interval.service_description}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-2">
                                            {interval.status === 'overdue' ? (
                                                <p className="text-[10px] font-black text-red-600 uppercase">Vencido</p>
                                            ) : interval.status === 'ok' && interval.predicted_next_km ? (
                                                <p className="text-[10px] font-black text-emerald-600">
                                                    ~{interval.predicted_next_km.toLocaleString('es-AR')} km
                                                </p>
                                            ) : interval.status === 'ok' && interval.predicted_next_date ? (
                                                <p className="text-[10px] font-black text-emerald-600">
                                                    {new Date(interval.predicted_next_date).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] font-bold text-slate-400">Sin datos</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Stats footer */}
                            {(healthData.stats?.overdue > 0 || healthData.stats?.onTime > 0) && (
                                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                        ✓ {healthData.stats.onTime} al día
                                    </span>
                                    {healthData.stats.overdue > 0 && (
                                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
                                            <AlertTriangle size={10} /> {healthData.stats.overdue} vencido{healthData.stats.overdue > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column: Service History */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8">
                        <div className="flex items-center justify-between mb-10">
                            <div className="flex items-center gap-3">
                                <History size={24} className="text-indigo-600" />
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cronología de Servicios</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">{orders.length} INGRESOS</span>
                                <Link
                                    href={`/${slug}/dashboard/orders/create?clientId=${vehicle.client_id}&vehicleId=${vehicle.id}`}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                                >
                                    <Plus size={16} /> Nueva Orden
                                </Link>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {orders.map(o => (
                                <Link
                                    key={o.id}
                                    href={`/${slug}/dashboard/orders/${o.id}`}
                                    className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50/50 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-xl hover:-translate-y-1 rounded-[32px] transition-all group"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="bg-white p-4 rounded-2xl text-slate-400 group-hover:bg-blue-600 group-hover:text-white shadow-sm transition-all">
                                            <Wrench size={24} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{o.id}</p>
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(o.status)}`}>
                                                    {o.status}
                                                </span>
                                            </div>
                                            <h4 className="text-lg font-black text-slate-800 uppercase italic tracking-tight mt-1">{o.description || 'Consulta Técnica'}</h4>
                                            <div className="flex items-center gap-4 mt-2">
                                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                                                    <Clock size={12} /> {new Date(o.created_at).toLocaleDateString('es-AR')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 md:mt-0 flex items-center gap-4">
                                        <div className="text-right hidden md:block">
                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Acceder</p>
                                            <ArrowRight size={20} className="ml-auto text-slate-200 group-hover:text-slate-900 transition-all" />
                                        </div>
                                    </div>
                                </Link>
                            ))}

                            {orders.length === 0 && (
                                <div className="text-center py-20 bg-slate-50/50 rounded-[32px] border border-dashed border-slate-200">
                                    <ClipboardList size={40} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Este vehículo no tiene intervenciones registradas</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chain History Card */}
                    {(chainOrdersLoading || chainOrders.length > 0) && (
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8 mt-8 opacity-90">
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-3">
                                    <div className="bg-slate-100 p-2 rounded-xl text-slate-500">
                                        <Building2 size={24} />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Historial en otros talleres</h3>
                                </div>
                                {chainOrdersLoading && (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                                )}
                            </div>

                            <div className="space-y-4">
                                {chainOrders.map((o: any) => (
                                    <CrossChainHistoryItem
                                        key={o.uuid || o.id}
                                        order={o}
                                        onClick={() => fetchChainOrderDetail(o.tenant_slug, o.id)}
                                        // On the vehicle page, we might not need to show the model again since it's the current vehicle,
                                        // but for consistency with the design "use the client one", we can pass it if available.
                                        vehicleModel={vehicle.model}
                                    />
                                ))}

                                {chainOrders.length === 0 && !chainOrdersLoading && (
                                    <p className="text-center text-slate-400 text-xs font-bold italic">No hay órdenes en otros talleres de la cadena</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Shared Chain Order Detail Modal */}
            <CrossChainOrderDetailModal
                isOpen={showChainDetailModal}
                onClose={() => { setShowChainDetailModal(false); setSelectedChainOrderDetail(null); }}
                detail={selectedChainOrderDetail}
                loading={detailLoading}
            />
        </div>
    );
}
