'use client';
import { useSlug } from '@/lib/slug';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
    ChevronLeft,
    User,
    Phone,
    Mail,
    MapPin,
    FileText,
    Car,
    Plus,
    History,
    ClipboardList,
    ArrowRight,
    Trash2,
    MessageSquare,
    Send,
    X,
    Camera,
    Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import { useNotification } from '@/lib/notification';

export default function ClientDetailsPage() {
    const { slug } = useSlug();
    const params = useParams();
    const router = useRouter();
    const { notify } = useNotification();
    const [client, setClient] = useState<any>(null);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [editData, setEditData] = useState<any>({});
    const [newPassword, setNewPassword] = useState('');
    const [showNewVehicleModal, setShowNewVehicleModal] = useState(false);
    const [showManualSendModal, setShowManualSendModal] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
    const [manualTemplates, setManualTemplates] = useState<any[]>([]);
    const [newVehicleData, setNewVehicleData] = useState({
        brand: '',
        model: '',
        plate: '',
        year: '',
        km: ''
    });

    const vehicleImageInputRef = useRef<HTMLInputElement>(null);
    const [uploadingVid, setUploadingVid] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const [clientRes, vehiclesRes, ordersRes] = await Promise.all([
                api.get(`/clients`),
                api.get(`/clients/${params.id}/vehicles`),
                api.get(`/orders`)
            ]);

            const currentClient = clientRes.data.find((c: any) => c.id === parseInt(params.id as string));
            setClient(currentClient);
            setEditData(currentClient);
            setVehicles(vehiclesRes.data);
            setOrders(ordersRes.data.filter((o: any) => o.client_id === parseInt(params.id as string)));
        } catch (err) {
            console.error('Error fetching client details', err);
        } finally {
            setLoading(false);
        }
    }, [params.id]);

    useEffect(() => {
        fetchData();
        const fetchTemplates = async () => {
            const res = await api.get('/templates');
            setManualTemplates(res.data.filter((t: any) => !t.trigger_status));
        };
        fetchTemplates();
    }, [fetchData]);

    const handleAddVehicle = async () => {
        try {
            await api.post(`/clients/${client.id}/vehicles`, newVehicleData);
            setShowNewVehicleModal(false);
            setNewVehicleData({ brand: '', model: '', plate: '', year: '', km: '' });
            fetchData();
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al agregar vehículo');
        }
    };

    const handleDeleteVehicle = async (vid: number) => {
        if (!confirm('¿Estás seguro de eliminar este vehículo?')) return;
        try {
            await api.delete(`/clients/vehicles/${vid}`);
            fetchData();
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al eliminar vehículo');
        }
    };

    const handleSendManualTemplate = async (templateId: number) => {
        try {
            const vehicleOrders = orders.filter(o => o.vehicle_id === selectedVehicle.id);
            const latestOrder = vehicleOrders.length > 0 ? vehicleOrders[0] : null;

            await api.post(`/orders/send-manual-template`, {
                clientId: client.id,
                vehicleId: selectedVehicle.id,
                orderId: latestOrder?.id,
                templateId: templateId
            });

            notify('success', 'Mensaje enviado correctamente');
            setShowManualSendModal(false);
        } catch (err) {
            notify('error', 'Error al enviar el mensaje');
        }
    };

    const handleUpdateClient = async () => {
        try {
            await api.put(`/clients/${client.id}`, editData);
            setShowEditModal(false);
            fetchData();
        } catch (err) {
            notify('error', 'Error al actualizar cliente');
        }
    };

    const handleUpdatePassword = async () => {
        try {
            await api.post(`/clients/${client.id}/password`, { password: newPassword });
            setShowPasswordModal(false);
            setNewPassword('');
            notify('success', 'Contraseña actualizada correctamente');
        } catch (err) {
            notify('error', 'Error al actualizar contraseña');
        }
    };

    const handleUpdateVehicleStatus = async (v: any, status: string) => {
        try {
            await api.put(`/clients/vehicles/${v.id}`, { ...v, status });
            fetchData();
        } catch (err) {
            notify('error', 'Error al actualizar estado del vehículo');
        }
    };

    const handleVehiclePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, vid: number) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('photo', file);

        setUploadingVid(vid);
        try {
            await api.post(`/clients/vehicles/${vid}/photo`, formData);
            fetchData();
        } catch (err) {
            notify('error', 'Error al subir foto del vehículo');
        } finally {
            setUploadingVid(null);
        }
    };

    if (loading) return <div className="p-20 text-center font-bold text-slate-400">Cargando...</div>;
    if (!client) return <div className="p-20 text-center font-bold text-slate-400">Cliente no encontrado</div>;

    return (
        <div className="space-y-8 pb-20">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/${slug}/dashboard/clients`} className="bg-white p-3 rounded-2xl border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm transition-all">
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Ficha de Cliente</h2>
                        <p className="text-slate-500 font-bold tracking-wider uppercase text-xs mt-1">Expediente MechHub</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowPasswordModal(true)}
                        className="bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                        Resetear Pass
                    </button>
                    <button
                        onClick={() => { setEditData(client); setShowEditModal(true); }}
                        className="bg-blue-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
                    >
                        Editar Perfil
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="space-y-8">
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8 overflow-hidden relative">
                        <div className="bg-blue-600 w-24 h-24 rounded-[32px] flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-100">
                            <User size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 uppercase italic leading-none mb-2">{client.first_name} {client.last_name}</h3>
                        {client.nickname && <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{client.nickname}</span>}

                        <div className="mt-8 space-y-4">
                            <a
                                href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-4 text-slate-600 font-bold hover:text-emerald-600 transition-colors"
                            >
                                <Phone size={18} className="text-slate-300" />
                                <span>{client.phone}</span>
                            </a>
                            <a
                                href={`mailto:${client.email}`}
                                className="flex items-center gap-4 text-slate-600 font-bold hover:text-blue-600 transition-colors"
                            >
                                <Mail size={18} className="text-slate-300" />
                                <span>{client.email}</span>
                            </a>
                            {client.address && (
                                <div className="flex items-center gap-4 text-slate-600 font-bold">
                                    <MapPin size={18} className="text-slate-300" />
                                    <span>{client.address}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-[40px] p-8 text-white">
                        <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-400 mb-6">Notas Internas</h4>
                        <p className="text-sm font-bold text-slate-300 italic">
                            {client.notes || 'Sin notas especiales para este cliente.'}
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Vehicles Section */}
                    <section className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-3">
                                <Car size={24} className="text-blue-600" />
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Vehículos ({vehicles.length})</h3>
                            </div>
                            <button
                                onClick={() => setShowNewVehicleModal(true)}
                                className="bg-slate-900 text-white p-2 rounded-xl hover:bg-blue-600 transition-all shadow-lg"
                                title="Agregar Vehículo"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {vehicles.map(v => (
                                <div key={v.id} className={`bg-slate-50/50 border border-slate-100 rounded-3xl p-6 transition-all group ${v.status === 'Inactivo' ? 'opacity-50 grayscale' : 'hover:border-blue-200 hover:shadow-md'}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center text-slate-300 overflow-hidden cursor-pointer hover:border-blue-300 transition-all relative group/photo"
                                                onClick={() => { setUploadingVid(v.id); vehicleImageInputRef.current?.click(); }}
                                            >
                                                {v.image_path ? (
                                                    <img src={`http://localhost:5000${v.image_path}`} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Camera size={20} className="group-hover/photo:text-blue-500" />
                                                )}
                                                {uploadingVid === v.id && (
                                                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{v.brand}</p>
                                                <h4 className="text-lg font-black text-slate-900 uppercase italic leading-none">{v.model}</h4>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={v.status || 'Activo'}
                                                onChange={(e) => handleUpdateVehicleStatus(v, e.target.value)}
                                                className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg outline-none border ${v.status === 'Inactivo' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}
                                            >
                                                <option value="Activo">Activo</option>
                                                <option value="Inactivo">Inactivo</option>
                                            </select>
                                            <button
                                                onClick={() => handleDeleteVehicle(v.id)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                title="Eliminar Vehículo"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Clickable: goes to vehicle history */}
                                    <Link href={`/${slug}/dashboard/vehicles/${v.id}`} className="block group/link mt-1 mb-3">
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-blue-600 font-black font-mono tracking-widest text-sm bg-white border border-blue-50 px-3 py-1 rounded-lg inline-flex items-center gap-1.5 group-hover/link:bg-blue-600 group-hover/link:text-white transition-all">
                                                {v.plate} <ArrowRight size={11} />
                                            </span>
                                        </div>
                                    </Link>

                                    <div className="flex justify-between items-center mt-2 pt-3 border-t border-slate-100">
                                        <Link
                                            href={`/${slug}/dashboard/orders/create?clientId=${client.id}&vehicleId=${v.id}`}
                                            className="flex items-center gap-1.5 bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                                        >
                                            <Plus size={12} /> Orden
                                        </Link>
                                        <button
                                            onClick={() => { setSelectedVehicle(v); setShowManualSendModal(true); }}
                                            className="flex items-center gap-2 bg-white border border-slate-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                                        >
                                            <MessageSquare size={12} />
                                            Mensaje
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {vehicles.length === 0 && <p className="col-span-full text-center py-10 text-slate-400 font-bold italic">No hay vehículos registrados</p>}
                        </div>
                        <input
                            type="file"
                            ref={vehicleImageInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => uploadingVid && handleVehiclePhotoUpload(e, uploadingVid)}
                        />
                    </section>

                    {/* Order History */}
                    <section className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <History size={24} className="text-indigo-600" />
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Historial de Órdenes</h3>
                        </div>
                        <div className="space-y-4">
                            {orders.sort((a, b) => b.id - a.id).map((o: any) => (
                                <Link
                                    key={o.id}
                                    href={`/${slug}/dashboard/orders/${o.id}`}
                                    className="flex items-center justify-between p-6 bg-slate-50/50 hover:bg-white border border-slate-100 rounded-3xl transition-all group"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="bg-white p-3 rounded-2xl text-slate-400 shadow-sm group-hover:text-blue-600 transition-all">
                                            <ClipboardList size={24} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{o.id} - {o.model}</p>
                                            <h4 className="font-bold text-slate-800">{o.description || 'Sin descripción'}</h4>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">{new Date(o.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${o.status === 'Entregado' ? 'bg-slate-900 text-white' : 'bg-white text-blue-600 border border-blue-50'
                                            }`}>
                                            {o.status}
                                        </span>
                                        <ArrowRight size={18} className="text-slate-300 group-hover:text-slate-900 transform group-hover:translate-x-1 transition-all" />
                                    </div>
                                </Link>
                            ))}
                            {orders.length === 0 && <p className="text-center py-10 text-slate-400 font-bold italic">No hay órdenes registradas</p>}
                        </div>
                    </section>
                </div>
            </div>

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-2xl p-10">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Editar Perfil</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-900">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</label>
                                <input value={editData.first_name} onChange={e => setEditData({ ...editData, first_name: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apellido</label>
                                <input value={editData.last_name} onChange={e => setEditData({ ...editData, last_name: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apodo</label>
                                <input value={editData.nickname} onChange={e => setEditData({ ...editData, nickname: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teléfono</label>
                                <input value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none" />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</label>
                                <input value={editData.email} disabled className="w-full bg-slate-100 border-none rounded-2xl px-5 py-4 font-bold outline-none text-slate-400 cursor-not-allowed" />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dirección</label>
                                <input value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none" />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notas Internas</label>
                                <textarea
                                    value={editData.notes || ''}
                                    onChange={e => setEditData({ ...editData, notes: e.target.value })}
                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none min-h-[100px]"
                                />
                            </div>
                        </div>
                        <button onClick={handleUpdateClient} className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-100 uppercase tracking-widest text-xs">Guardar Cambios</button>
                    </div>
                </div>
            )}

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-md p-10">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Resetar Pass</h3>
                            <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-900">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Ingrese nueva pass..."
                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none"
                                />
                            </div>
                            <button onClick={handleUpdatePassword} className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl uppercase tracking-widest text-xs">Actualizar Acceso</button>
                        </div>
                    </div>
                </div>
            )}
            {/* New Vehicle Modal */}
            {showNewVehicleModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-lg p-10">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Nuevo Vehículo</h3>
                            <button onClick={() => setShowNewVehicleModal(false)} className="text-slate-400 hover:text-slate-900">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patente</label>
                                <input placeholder="AAA 123" value={newVehicleData.plate} onChange={e => setNewVehicleData({ ...newVehicleData, plate: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Marca</label>
                                <input placeholder="Ej: Ford" value={newVehicleData.brand} onChange={e => setNewVehicleData({ ...newVehicleData, brand: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none" />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modelo</label>
                                <input placeholder="Ej: Focus" value={newVehicleData.model} onChange={e => setNewVehicleData({ ...newVehicleData, model: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Año</label>
                                <input type="number" placeholder="2023" value={newVehicleData.year} onChange={e => setNewVehicleData({ ...newVehicleData, year: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kilómetros</label>
                                <input type="number" placeholder="50000" value={newVehicleData.km} onChange={e => setNewVehicleData({ ...newVehicleData, km: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none" />
                            </div>
                        </div>
                        <button onClick={handleAddVehicle} className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-100 uppercase tracking-widest text-xs">Registrar Vehículo</button>
                    </div>
                </div>
            )}

            {/* Manual Message Modal */}
            {showManualSendModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] w-full max-w-lg p-10">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Enviar Mensaje</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Para: {client.first_name} - {selectedVehicle?.model}</p>
                            </div>
                            <button onClick={() => setShowManualSendModal(false)} className="text-slate-400 hover:text-slate-900">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {manualTemplates.length === 0 ? (
                                <p className="text-center py-10 text-slate-400 font-bold italic">No hay plantillas manuales configuradas.</p>
                            ) : manualTemplates.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => handleSendManualTemplate(t.id)}
                                    className="w-full text-left p-6 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-[28px] transition-all group"
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h4 className="font-black text-slate-800 uppercase text-xs tracking-wider">{t.name}</h4>
                                            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{t.content}</p>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl text-blue-600 shadow-sm border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            <Send size={16} />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="mt-8 pt-8 border-t border-slate-100">
                            <Link href={`/${slug}/dashboard/settings`} className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-2">
                                <Plus size={14} /> Gestionar Plantillas en Ajustes
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
