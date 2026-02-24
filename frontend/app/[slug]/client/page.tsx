'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import api, { clientApi } from '@/lib/api';
import {
    Car,
    Settings,
    LogOut,
    Calendar,
    Wrench,
    Clock,
    History,
    CheckCircle2,
    AlertCircle,
    Plus,
    Search,
    Download,
    FileText,
    MessageCircle,
    Phone
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';

export default function ClientDashboardPage() {
    const { clientUser, clientLogout, loading: authLoading } = useAuth();
    const [data, setData] = useState<any>(null);
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const params = useParams();
    const slug = params?.slug as string;
    const [activeTab, setActiveTab] = useState('summary');
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [newVehicle, setNewVehicle] = useState({
        plate: '',
        brand: '',
        model: '',
        year: '',
        km: ''
    });
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [newOrder, setNewOrder] = useState({
        vehicle_id: '',
        description: ''
    });

    const [selectedOrderDetail, setSelectedOrderDetail] = useState<any>(null);
    const [showOrderDetailModal, setShowOrderDetailModal] = useState(false);
    const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);

    const fetchPortalData = async () => {
        try {
            const configRes = await api.get('/config');
            setConfig(configRes.data);
        } catch (err) {
            console.error('Error fetching config data', err);
        }

        try {
            const portalRes = await clientApi.get('/client/me');
            setData(portalRes.data);
        } catch (err) {
            console.error('Error fetching portal data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading) {
            if (!clientUser) {
                router.push(`/${slug}/client/login`);
            } else {
                fetchPortalData();
            }
        }
    }, [authLoading, clientUser, router, slug]);

    const handleCreateOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrder.vehicle_id) return alert('Seleccioná un vehículo');
        try {
            await clientApi.post('/client/orders', newOrder);
            setShowOrderModal(false);
            setNewOrder({ vehicle_id: '', description: '' });
            fetchPortalData();
            alert('¡Turno solicitado! Te contactaremos a la brevedad.');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al solicitar turno');
        }
    };

    const handleAddVehicle = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await clientApi.post('/client/vehicles', newVehicle);
            setShowVehicleModal(false);
            setNewVehicle({ plate: '', brand: '', model: '', year: '', km: '' });
            fetchPortalData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al agregar vehículo');
        }
    };

    const handleDownloadPDF = async (order: any) => {
        try {
            // Use api.get with blob response for PDF
            const response = await clientApi.get(`/reports/order-pdf/${order.id}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Orden_${order.id}_${order.plate}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Error downloading PDF:', err);
            alert('Error al descargar el PDF');
        }
    };

    const handleDownloadHistory = async (vehicle: any) => {
        try {
            const response = await clientApi.get(`/client/history-pdf/${vehicle.id}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Historial_${vehicle.brand}_${vehicle.model}_${vehicle.plate}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Error downloading History PDF:', err);
            alert('Error al descargar el historial');
        }
    };

    const handleViewOrder = async (orderId: number) => {
        setLoadingOrderDetail(true);
        setShowOrderDetailModal(true);
        setSelectedOrderDetail(null);
        try {
            const res = await clientApi.get(`/client/orders/${orderId}`);
            setSelectedOrderDetail(res.data);
        } catch (err) {
            console.error('Error fetching order detail', err);
            alert('Error al cargar detalle de la orden');
            setShowOrderDetailModal(false);
        } finally {
            setLoadingOrderDetail(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-black text-[var(--text-primary)] uppercase tracking-widest text-xs italic">Cargando {config?.workshop_name || 'Portal'}...</p>
        </div>
    );

    const currentOrder = data?.orders?.find((o: any) => o.status !== 'Entregado' && o.status !== 'Cancelado');
    const pastOrders = data?.orders?.filter((o: any) => o.status === 'Entregado');
    const vehiclesData = data?.vehicles || [];

    return (
        <div className="min-h-screen">
            {/* Navbar Premium */}
            <nav className="bg-[var(--bg-surface)] backdrop-blur-md border-b border-[var(--border)] px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    {config?.logo_path ? (
                        <div className="w-10 h-10 bg-white rounded-xl shadow-lg border border-[var(--border)] overflow-hidden">
                            <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}`.replace(/\/api\/?$/, '') + config.logo_path} alt="Logo" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="bg-[var(--accent)] p-2.5 rounded-xl text-white shadow-lg">
                            <Car size={20} />
                        </div>
                    )}
                    <span className="font-black text-2xl tracking-tighter text-[var(--text-primary)] uppercase italic">{config?.workshop_name || 'MechHub'} <span style={{ color: 'var(--accent)' }}>Portal</span></span>
                </div>
                <div className="flex items-center gap-4 md:gap-6">
                    {/* Contact Menu */}
                    {(config?.whatsapp || config?.phone) && (
                        <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-slate-200">
                            {config?.whatsapp && (
                                <a href={`https://wa.me/${config.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-colors font-bold text-xs" title="Contactar por WhatsApp">
                                    <MessageCircle size={14} /> WhatsApp
                                </a>
                            )}
                            {config?.phone && (
                                <a href={`tel:${config.phone}`} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors font-bold text-xs" title="Llamar">
                                    <Phone size={14} /> Taller
                                </a>
                            )}
                        </div>
                    )}
                    <div className="hidden md:block text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente Conectado</p>
                        <p className="text-sm font-bold text-slate-900">{data?.client?.first_name} {data?.client?.last_name}</p>
                    </div>
                    <button onClick={clientLogout} className="bg-slate-100 hover:bg-red-50 p-3 rounded-2xl text-slate-400 hover:text-red-500 transition-all">
                        <LogOut size={20} />
                    </button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto p-6 md:p-10 space-y-10">
                {/* Tabs */}
                <div className="flex border-b border-slate-200 gap-8 overflow-x-auto scrollbar-hide">
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`pb-4 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'summary' ? '' : 'text-[var(--text-muted)] hover:opacity-80'}`}
                        style={{ color: activeTab === 'summary' ? 'var(--accent)' : undefined }}
                    >
                        Resumen de Servicios
                        {activeTab === 'summary' && <div className="absolute bottom-0 left-0 right-0 h-1 rounded-full animate-in fade-in slide-in-from-bottom-1" style={{ backgroundColor: 'var(--accent)' }}></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('vehicles')}
                        className={`pb-4 text-sm font-black uppercase tracking-widest transition-all relative ${activeTab === 'vehicles' ? '' : 'text-[var(--text-muted)] hover:opacity-80'}`}
                        style={{ color: activeTab === 'vehicles' ? 'var(--accent)' : undefined }}
                    >
                        Mis Vehículos ({vehiclesData.length})
                        {activeTab === 'vehicles' && <div className="absolute bottom-0 left-0 right-0 h-1 rounded-full animate-in fade-in slide-in-from-bottom-1" style={{ backgroundColor: 'var(--accent)' }}></div>}
                    </button>
                    <div className="flex-grow" />
                    <button
                        onClick={() => setShowOrderModal(true)}
                        className="text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition-all mb-3 shadow-lg opacity-90 hover:opacity-100 italic"
                        style={{ backgroundColor: 'var(--accent)' }}
                    >
                        Solicitar Turno
                    </button>
                </div>

                {activeTab === 'summary' && (
                    <div className="space-y-10 animate-in fade-in duration-500">
                        {/* Estado Actual */}
                        <section className="bg-[var(--bg-card)] rounded-[40px] shadow-2xl border border-[var(--border)] overflow-hidden transform hover:scale-[1.01] transition-all">
                            <div className="p-8 md:p-12">
                                {currentOrder ? (
                                    <div className="space-y-10">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                                            <div className="flex items-center gap-6">
                                                <div className="p-6 rounded-[28px] text-white shadow-xl opacity-90" style={{ backgroundColor: 'var(--accent)' }}>
                                                    <Wrench size={32} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1 italic">Vibrando Ahora</p>
                                                    <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tight uppercase leading-none">{currentOrder.model}</h2>
                                                    <p className="font-black tracking-[0.2em] font-mono text-sm mt-1" style={{ color: 'var(--accent)' }}>{currentOrder.plate}</p>
                                                </div>
                                            </div>
                                            <div className={`px-8 py-3 rounded-2xl font-black text-xs tracking-[0.2em] shadow-sm flex items-center gap-3 border ${currentOrder.status === 'Finalizado'
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                : 'bg-[var(--accent-light)] border-[var(--border)] animate-pulse'
                                                }`}
                                                style={currentOrder.status !== 'Finalizado' ? { color: 'var(--accent)' } : undefined}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${currentOrder.status === 'Finalizado' ? 'bg-emerald-500' : ''}`} style={currentOrder.status !== 'Finalizado' ? { backgroundColor: 'var(--accent)' } : undefined}></div>
                                                {currentOrder.status.toUpperCase()}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-10 border-t border-slate-100">
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tarea</p>
                                                <p className="font-bold text-slate-800 text-lg">{currentOrder.description}</p>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Último Movimiento</p>
                                                <p className="font-bold text-slate-800 flex items-center gap-2">
                                                    <Clock size={16} className="text-slate-400" />
                                                    {new Date(currentOrder.updated_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avance</p>
                                                <div className="space-y-1">
                                                    <p className="font-bold text-slate-700 italic">
                                                        {currentOrder.status === 'Finalizado'
                                                            ? '¡Tu vehículo está listo para retirar!'
                                                            : 'Estamos trabajando según lo previsto.'}
                                                    </p>
                                                    {currentOrder.last_note && (
                                                        <p className="text-xs text-slate-500 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center gap-2">
                                                            <AlertCircle size={12} className="text-blue-500" />
                                                            {currentOrder.last_note}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-2 flex flex-col justify-center">
                                                {(currentOrder.has_budget > 0 || ['Presupuestado', 'Aprobado', 'En reparación', 'Listo para entrega', 'Entregado'].includes(currentOrder.status)) && (
                                                    <button
                                                        onClick={() => handleDownloadPDF(currentOrder)}
                                                        className="flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg italic"
                                                    >
                                                        <Download size={14} /> Descargar Presupuesto
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-16 space-y-6">
                                        <div className="bg-slate-50 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto text-slate-300">
                                            <CheckCircle2 size={48} />
                                        </div>
                                        <div className="max-w-md mx-auto">
                                            <h2 className="text-2xl font-black text-slate-900 uppercase italic">Todo al día</h2>
                                            <p className="text-slate-500 font-bold mt-2">No tenés reparaciones en curso ahora. Dejá tu vehículo en {config?.workshop_name || 'el taller'} y seguilo desde acá.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Historial */}
                        <section className="space-y-8">
                            <div className="flex items-center gap-4">
                                <div className="bg-indigo-600 p-2 rounded-lg text-white">
                                    <History size={20} />
                                </div>
                                <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase italic">Historial de Visitas</h2>
                            </div>

                            <div className="bg-[var(--bg-card)] rounded-[32px] border border-[var(--border)] shadow-sm overflow-hidden">
                                {pastOrders?.length > 0 ? (
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                                            <tr>
                                                <th className="px-8 py-6">Vehículo</th>
                                                <th className="px-8 py-6">Servicio</th>
                                                <th className="px-8 py-6">Fecha</th>
                                                <th className="px-8 py-6 text-right">Resultado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {pastOrders.map((order: any) => (
                                                <tr
                                                    key={order.id}
                                                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                                    onClick={() => handleViewOrder(order.id)}
                                                >
                                                    <td className="px-8 py-6">
                                                        <div className="font-bold text-[var(--text-primary)] uppercase truncate">{order.model}</div>
                                                        <div className="text-[10px] font-black italic tracking-widest font-mono" style={{ color: 'var(--accent)' }}>{order.plate}</div>
                                                    </td>
                                                    <td className="px-8 py-6 font-bold text-slate-600 text-sm">{order.description}</td>
                                                    <td className="px-8 py-6 text-sm font-bold text-slate-500 uppercase">{new Date(order.updated_at).toLocaleDateString()}</td>
                                                    <td className="px-8 py-6 text-right flex items-center justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                                                        {(order.has_budget > 0 || ['Presupuestado', 'Aprobado', 'En reparación', 'Listo para entrega', 'Entregado'].includes(order.status)) && (
                                                            <button
                                                                onClick={() => handleDownloadPDF(order)}
                                                                className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                                                                title="Descargar Presupuesto/Orden"
                                                            >
                                                                <Download size={16} />
                                                            </button>
                                                        )}
                                                        <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black tracking-widest">ENTREGADO</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-16 text-center text-slate-400 font-bold italic">No registramos visitas pasadas aún.</div>
                                )}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'vehicles' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        <header className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 uppercase italic">Mis Unidades</h2>
                                <p className="text-slate-500 font-bold text-sm">Gestioná los vehículos registrados en el taller.</p>
                            </div>
                            <button
                                onClick={() => setShowVehicleModal(true)}
                                className="text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl opacity-90 hover:opacity-100"
                                style={{ backgroundColor: 'var(--accent)' }}
                            >
                                <Plus size={18} /> Agregar Vehículo
                            </button>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {vehiclesData.map((v: any) => (
                                <div key={v.id} className="bg-[var(--bg-card)] p-8 rounded-[32px] border border-[var(--border)] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 scale-150 rotate-12 transition-all">
                                        <Car size={80} />
                                    </div>
                                    <div className="bg-[var(--bg-base)] w-16 h-16 rounded-[24px] flex items-center justify-center text-[var(--text-muted)] mb-6 transition-all" style={{ backgroundColor: 'var(--accent-light)' }}>
                                        <Car size={28} style={{ color: 'var(--accent)' }} />
                                    </div>
                                    <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic mb-1">{v.brand} {v.model}</h3>
                                    <p className="font-black font-mono tracking-widest text-sm mb-6" style={{ color: 'var(--accent)' }}>{v.plate}</p>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Año</p>
                                            <p className="text-sm font-bold text-slate-800">{v.year || '---'}</p>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">KMs</p>
                                            <p className="text-sm font-bold text-slate-800">{v.km ? `${v.km.toLocaleString()} km` : '---'}</p>
                                        </div>
                                    </div>
                                    <div className="mt-6 pt-6 border-t border-[var(--border)]">
                                        <button
                                            onClick={() => handleDownloadHistory(v)}
                                            className="w-full bg-[var(--bg-card)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-colors shadow-sm"
                                            title={`Descargar Historial Mantenimiento - ${v.plate}`}
                                        >
                                            <FileText size={16} style={{ color: 'var(--accent)' }} /> Historial Clínico
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {vehiclesData.length === 0 && (
                            <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-slate-200">
                                <Car size={48} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm italic">No tenés vehículos cargados aún</p>
                                <button onClick={() => setShowVehicleModal(true)} className="mt-4 text-blue-600 font-black uppercase text-xs hover:underline tracking-widest">Cargá el primero ahora</button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Modal Agregar Vehículo */}
            {showVehicleModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-10 pb-0 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Registrar Unidad</h3>
                                <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em]">Alta de Vehículo {config?.workshop_name || 'Taller'}</p>
                            </div>
                            <button onClick={() => setShowVehicleModal(false)} className="text-slate-400 hover:text-slate-900 p-2">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleAddVehicle} className="p-10 space-y-6">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Patente</label>
                                    <input
                                        required
                                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50/50 text-slate-900 font-black uppercase tracking-widest font-mono"
                                        placeholder="AA 123 BB"
                                        value={newVehicle.plate}
                                        onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Año</label>
                                    <input
                                        type="number"
                                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50/50 text-slate-900 font-black"
                                        placeholder="2024"
                                        value={newVehicle.year}
                                        onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Marca</label>
                                    <input
                                        required
                                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50/50 text-slate-900 font-black uppercase"
                                        placeholder="FORD"
                                        value={newVehicle.brand}
                                        onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Modelo</label>
                                    <input
                                        required
                                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50/50 text-slate-900 font-black uppercase"
                                        placeholder="RANGER"
                                        value={newVehicle.model}
                                        onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Kilómetros actuales</label>
                                <input
                                    type="number"
                                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50/50 text-slate-900 font-black"
                                    placeholder="45000"
                                    value={newVehicle.km}
                                    onChange={(e) => setNewVehicle({ ...newVehicle, km: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full text-white font-black py-5 rounded-[24px] shadow-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest mt-4 opacity-90 hover:opacity-100"
                                style={{ backgroundColor: 'var(--accent)' }}
                            >
                                CONFIRMAR ALTA UNIDAD
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal Solicitar Turno */}
            {showOrderModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-10 pb-0 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Solicitar Ingreso</h3>
                                <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em]">Reserva de turno en Taller</p>
                            </div>
                            <button onClick={() => setShowOrderModal(false)} className="text-slate-400 hover:text-slate-900 p-2">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateOrder} className="p-10 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Seleccioná tu vehículo</label>
                                <select
                                    required
                                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50/50 text-slate-900 font-bold"
                                    value={newOrder.vehicle_id}
                                    onChange={(e) => setNewOrder({ ...newOrder, vehicle_id: e.target.value })}
                                >
                                    <option value="">-- Mis Unidades --</option>
                                    {vehiclesData.map((v: any) => (
                                        <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Descripción del problema</label>
                                <textarea
                                    required
                                    rows={4}
                                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50/50 text-slate-900 font-bold"
                                    placeholder="Ej: El auto hace un ruido al frenar..."
                                    value={newOrder.description}
                                    onChange={(e) => setNewOrder({ ...newOrder, description: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full text-white font-black py-5 rounded-[24px] shadow-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest mt-4 opacity-90 hover:opacity-100"
                                style={{ backgroundColor: 'var(--accent)' }}
                            >
                                <Calendar size={20} /> ENVIAR SOLICITUD
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal Detalle de Orden */}
            {showOrderDetailModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-10 pb-6 flex justify-between items-center border-b border-slate-50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Detalle de Visita</h3>
                                <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em]">{selectedOrderDetail?.order?.brand} {selectedOrderDetail?.order?.model} - {selectedOrderDetail?.order?.plate}</p>
                            </div>
                            <button onClick={() => setShowOrderDetailModal(false)} className="text-slate-400 hover:text-slate-900 p-2">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 space-y-8">
                            {loadingOrderDetail ? (
                                <div className="flex flex-col items-center py-12 gap-4">
                                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando detalles...</p>
                                </div>
                            ) : selectedOrderDetail && (
                                <>
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Problema Reportado</h4>
                                        <div className="p-6 bg-slate-50 rounded-3xl font-bold text-slate-700 leading-relaxed border border-slate-100">
                                            {selectedOrderDetail.order.description}
                                        </div>
                                    </div>

                                    {selectedOrderDetail.items?.length > 0 && (
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tareas Realizadas</h4>
                                            <div className="space-y-3">
                                                {selectedOrderDetail.items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex items-start gap-4 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                                        <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg mt-0.5">
                                                            <CheckCircle2 size={16} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-slate-800 leading-snug">{item.description}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedOrderDetail.history?.length > 0 && (
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Línea de Tiempo</h4>
                                            <div className="space-y-6 relative ml-3 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                                                {selectedOrderDetail.history.map((h: any, idx: number) => (
                                                    <div key={idx} className="relative pl-8">
                                                        <div className="absolute left-[-5px] top-1.5 w-[12px] h-[12px] rounded-full bg-white border-[3px] border-slate-200"></div>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{h.status}</span>
                                                            <span className="text-[10px] font-bold text-slate-400">{new Date(h.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                        {h.notes && (
                                                            <p className="text-sm font-bold text-slate-500 leading-relaxed italic">"{h.notes}"</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="p-8 border-t border-slate-50 bg-slate-50/50">
                            <button
                                onClick={() => setShowOrderDetailModal(false)}
                                className="w-full bg-white border border-slate-200 text-slate-900 font-black py-4 rounded-2xl shadow-sm hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all uppercase tracking-widest text-xs"
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
