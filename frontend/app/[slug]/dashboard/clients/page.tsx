'use client';
import { useSlug } from '@/lib/slug';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { Plus, Search, User, Phone, Mail, X, Car, Hash, Calendar, ArrowRight, MapPin, Notebook } from 'lucide-react';
import { useNotification } from '@/lib/notification';
import { useAuth } from '@/lib/auth';

export default function ClientsPage() {
    const { slug } = useSlug();
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');
    const { notify } = useNotification();
    const { hasPermission } = useAuth();

    if (!hasPermission('clientes')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
                <User size={48} className="mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-xs">Módulo no habilitado</p>
                <p className="text-[10px] mt-2 italic">Contacta al administrador para activar esta funcionalidad</p>
            </div>
        );
    }

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        nickname: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        addVehicle: true,
        vehicle: {
            plate: '',
            brand: '',
            model: '',
            year: '',
            km: ''
        }
    });

    const fetchClients = async () => {
        setLoading(true);
        try {
            const response = await api.get('/clients');
            setClients(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                vehicle: formData.addVehicle ? formData.vehicle : null
            };
            await api.post('/clients', payload);
            setShowModal(false);
            fetchClients();
            notify('success', 'Cliente registrado exitosamente');
            // Reset form
            setFormData({
                first_name: '', last_name: '', nickname: '', phone: '', email: '', address: '', notes: '',
                addVehicle: true,
                vehicle: { plate: '', brand: '', model: '', year: '', km: '' }
            });
        } catch (err: any) {
            notify('error', err.response?.data?.message || 'Error al crear el cliente');
        }
    };

    const filteredClients = clients.filter(c => {
        const query = search.toLowerCase();
        return (
            (c.first_name || '').toLowerCase().includes(query) ||
            (c.last_name || '').toLowerCase().includes(query) ||
            (c.nickname && c.nickname.toLowerCase().includes(query)) ||
            (c.phone || '').includes(query) ||
            (c.email || '').toLowerCase().includes(query)
        );
    });

    return (
        <div className="space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Clientes</h2>
                    <p className="text-slate-500">Gestioná tu base de datos de clientes y sus vehículos.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-100 transition-all font-bold"
                >
                    <Plus size={20} />
                    <span>Nuevo Cliente</span>
                </button>
            </header>

            <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="bg-slate-50 p-3 rounded-xl text-slate-400">
                    <Search size={20} />
                </div>
                <input
                    type="text"
                    placeholder="Buscar por nombre, apellido, apodo, teléfono o email..."
                    className="bg-transparent border-none outline-none w-full text-slate-900 font-bold p-2 placeholder-slate-400"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <p className="col-span-full text-center py-20 text-slate-400 font-bold italic">Cargando base de datos...</p>
                ) : filteredClients.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                        <User size={48} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-medium">No se encontraron clientes.</p>
                    </div>
                ) : (
                    filteredClients.map(client => (
                        <Link
                            key={client.id}
                            href={`/${slug}/dashboard/clients/${client.id}`}
                            className="bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                        <User size={24} />
                                    </div>
                                    <div className="text-right">
                                        {client.nickname && (
                                            <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest">{client.nickname}</span>
                                        )}
                                    </div>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-1 leading-tight uppercase">
                                    {client.last_name}, {client.first_name}
                                </h3>
                                <p className="text-slate-400 text-xs font-bold mb-4 tracking-wider">CLIENTE MECHHUB</p>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl group-hover:bg-slate-100 transition-colors">
                                        <Phone size={16} className="text-emerald-500" />
                                        <span className="text-sm font-bold text-slate-700">{client.phone}</span>
                                    </div>
                                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl group-hover:bg-slate-100 transition-colors">
                                        <Mail size={16} className="text-blue-500" />
                                        <span className="text-sm font-bold text-slate-700 truncate">{client.email || 'Sin email'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <span className="text-[10px] font-black uppercase tracking-widest">Ver Detalles</span>
                                <ArrowRight size={16} />
                            </div>
                        </Link>
                    ))
                )}
            </div>

            {/* Creation Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">Nuevo Cliente</h3>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Alta de legajo en el taller</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="bg-white p-3 rounded-2xl text-slate-400 hover:text-slate-900 hover:rotate-90 transition-all shadow-sm border border-slate-100">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="overflow-y-auto p-10 space-y-12">
                            {/* Section: Personal Info */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <User className="text-blue-600" size={24} />
                                    <h4 className="font-black text-slate-900 uppercase tracking-tight">Datos Personales</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre</label>
                                        <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Apellido</label>
                                        <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Apodo (Opcional)</label>
                                        <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all" value={formData.nickname} onChange={e => setFormData({ ...formData, nickname: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Teléfono</label>
                                        <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>
                                        <input type="email" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dirección</label>
                                        <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                    </div>
                                </div>
                            </section>

                            {/* Section: Vehicle */}
                            <section className="space-y-6">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <Car className="text-emerald-500" size={24} />
                                        <h4 className="font-black text-slate-900 uppercase tracking-tight">Vehículo Principal</h4>
                                    </div>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative">
                                            <input type="checkbox" className="sr-only" checked={formData.addVehicle} onChange={e => setFormData({ ...formData, addVehicle: e.target.checked })} />
                                            <div className={`w-10 h-5 rounded-full transition-colors ${formData.addVehicle ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${formData.addVehicle ? 'translate-x-5' : ''}`}></div>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">Vincular Vehículo</span>
                                    </label>
                                </div>

                                {formData.addVehicle && (
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Patente</label>
                                            <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-black text-slate-900 uppercase italic outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all" value={formData.vehicle.plate} onChange={e => setFormData({ ...formData, vehicle: { ...formData.vehicle, plate: e.target.value } })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Marca</label>
                                            <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all" value={formData.vehicle.brand} onChange={e => setFormData({ ...formData, vehicle: { ...formData.vehicle, brand: e.target.value } })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Modelo</label>
                                            <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all" value={formData.vehicle.model} onChange={e => setFormData({ ...formData, vehicle: { ...formData.vehicle, model: e.target.value } })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Año</label>
                                            <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all" value={formData.vehicle.year} onChange={e => setFormData({ ...formData, vehicle: { ...formData.vehicle, year: e.target.value } })} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">KM</label>
                                            <input type="number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-900 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all" value={formData.vehicle.km} onChange={e => setFormData({ ...formData, vehicle: { ...formData.vehicle, km: e.target.value } })} />
                                        </div>
                                    </div>
                                )}
                            </section>

                            <div className="pt-8 border-t border-slate-100 flex justify-end gap-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-8 py-4 text-slate-400 font-bold hover:text-slate-900 transition-colors">Cancelar</button>
                                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black shadow-2xl shadow-blue-200 transition-all transform hover:-translate-y-1 active:scale-95 uppercase tracking-widest">
                                    Registrar Cliente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
