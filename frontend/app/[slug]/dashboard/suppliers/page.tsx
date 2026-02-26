'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSlug } from '@/lib/slug';
import api from '@/lib/api';
import { useNotification } from '@/lib/notification';
import {
    Truck,
    Plus,
    Search,
    Mail,
    Phone,
    MoreVertical,
    Trash2,
    Edit2,
    X,
    MessageSquare,
    Send,
    CheckCircle2,
    AlertCircle,
    Info,
    ArrowRight
} from 'lucide-react';

export default function SuppliersPage() {
    const params = useParams();
    const router = useRouter();
    const { hasPermission } = useAuth();
    const { slug } = useSlug();
    const { notify } = useNotification();
    const searchParams = useSearchParams();
    const urlOrderId = searchParams.get('orderId');
    const urlVehicleInfo = searchParams.get('vehicleInfo');

    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showInquiryModal, setShowInquiryModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<any>(null);

    // Form states
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', notes: '' });
    const [inquiryData, setInquiryData] = useState({
        partDescription: '',
        vehicleInfo: urlVehicleInfo?.replace(/_/g, ' ') || ''
    });
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        try {
            const res = await api.get('/suppliers');
            setSuppliers(res.data);
        } catch (err) {
            notify('error', 'Error al cargar proveedores');
        } finally {
            setLoading(false);
        }
    };

    if (!hasPermission('proveedores')) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-12 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="bg-rose-50 p-6 rounded-3xl mb-6">
                    <AlertCircle size={48} className="text-rose-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 uppercase italic">Módulo no habilitado</h2>
                <p className="text-slate-500 font-bold text-sm mt-2 max-w-sm">No tenés permisos para gestionar proveedores o el módulo está desactivado.</p>
            </div>
        );
    }

    const handleCreateOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingSupplier) {
                await api.put(`/suppliers/${editingSupplier.id}`, formData);
                notify('success', 'Proveedor actualizado');
            } else {
                await api.post('/suppliers', formData);
                notify('success', 'Proveedor creado');
            }
            setShowCreateModal(false);
            setEditingSupplier(null);
            setFormData({ name: '', email: '', phone: '', notes: '' });
            fetchSuppliers();
        } catch (err) {
            notify('error', 'Error al guardar proveedor');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de eliminar este proveedor?')) return;
        try {
            await api.delete(`/suppliers/${id}`);
            notify('success', 'Proveedor eliminado');
            fetchSuppliers();
        } catch (err) {
            notify('error', 'Error al eliminar proveedor');
        }
    };

    const handleSendInquiry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedIds.length === 0) return;
        setSending(true);
        try {
            await api.post('/suppliers/inquiry', {
                supplierIds: selectedIds,
                orderId: urlOrderId,
                ...inquiryData
            });
            notify('success', `Consulta enviada a ${selectedIds.length} proveedores`);
            setShowInquiryModal(false);
            setInquiryData({ partDescription: '', vehicleInfo: '' });
            setSelectedIds([]);
        } catch (err) {
            notify('error', 'Error al enviar consultas');
        } finally {
            setSending(false);
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Order Context Banner */}
            {urlOrderId && (
                <div className="bg-emerald-600 text-white p-6 rounded-[2rem] flex items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500 shadow-xl shadow-emerald-100 italic">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3 rounded-2xl">
                            <Truck size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Consultando para Orden #{urlOrderId}</p>
                            <h3 className="text-xl font-black uppercase italic tracking-tight leading-tight">
                                {urlVehicleInfo?.replace(/_/g, ' ')}
                            </h3>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push(`/${slug}/dashboard/orders/${urlOrderId}`)}
                        className="bg-white text-emerald-600 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-50 transition-all shrink-0"
                    >
                        Volver a la Orden
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-4">
                        <Truck size={40} className="text-blue-600" /> Gestión de Proveedores
                    </h1>
                    <p className="text-slate-500 font-bold text-sm mt-1">
                        Administrá tu red de contactos y consultá presupuestos de repuestos.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {selectedIds.length > 0 && (
                        <button
                            onClick={() => setShowInquiryModal(true)}
                            className="bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-100 flex items-center gap-2 animate-in zoom-in duration-300"
                        >
                            <Send size={16} /> Consultar ({selectedIds.length})
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setEditingSupplier(null);
                            setFormData({ name: '', email: '', phone: '', notes: '' });
                            setShowCreateModal(true);
                        }}
                        className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black shadow-lg flex items-center gap-2"
                    >
                        <Plus size={16} /> Nuevo Proveedor
                    </button>
                </div>
            </div>

            {/* Actions & Search */}
            <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-grow w-full">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl shrink-0">
                    <button
                        onClick={() => setSelectedIds([])}
                        disabled={selectedIds.length === 0}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    >
                        Deseleccionar
                    </button>
                </div>
            </div>

            {/* Suppliers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [1, 2, 3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-[2.5rem] animate-pulse" />)
                ) : filteredSuppliers.map(supplier => (
                    <div
                        key={supplier.id}
                        onClick={() => toggleSelect(supplier.id)}
                        className={`group relative bg-white p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer ${selectedIds.includes(supplier.id)
                            ? 'border-blue-500 shadow-xl shadow-blue-500/10 bg-blue-50/30'
                            : 'border-transparent shadow-sm hover:border-slate-200'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${selectedIds.includes(supplier.id) ? 'bg-blue-600 text-white rotate-12' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'
                                }`}>
                                <Truck size={28} />
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingSupplier(supplier);
                                        setFormData({
                                            name: supplier.name,
                                            email: supplier.email || '',
                                            phone: supplier.phone || '',
                                            notes: supplier.notes || ''
                                        });
                                        setShowCreateModal(true);
                                    }}
                                    className="p-3 text-slate-300 hover:text-blue-600 hover:bg-white rounded-xl transition-all"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(supplier.id);
                                    }}
                                    className="p-3 text-slate-300 hover:text-rose-600 hover:bg-white rounded-xl transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight line-clamp-1">{supplier.name}</h3>

                        <div className="mt-4 space-y-2">
                            {supplier.email && (
                                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                                    <Mail size={14} className="shrink-0" />
                                    <span className="truncate">{supplier.email}</span>
                                </div>
                            )}
                            {supplier.phone && (
                                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold">
                                    <Phone size={14} className="shrink-0" />
                                    <span>{supplier.phone}</span>
                                </div>
                            )}
                        </div>

                        {selectedIds.includes(supplier.id) && (
                            <div className="absolute -top-3 -right-3 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-4 border-white animate-in zoom-in duration-300">
                                <CheckCircle2 size={16} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-10 animate-in zoom-in duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">
                                {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                            </h2>
                            <button onClick={() => setShowCreateModal(false)} className="bg-slate-50 p-2.5 rounded-2xl text-slate-400 hover:text-slate-900 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateOrUpdate} className="space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la Empresa / Contacto</label>
                                <input
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                    <input
                                        type="email"
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                                    <input
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notas Internas</label>
                                <textarea
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all min-h-[100px]"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>

                            <button className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] hover:bg-black shadow-xl transition-all">
                                {editingSupplier ? 'Guardar Cambios' : 'Crear Proveedor'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Inquiry Modal */}
            {showInquiryModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-12 duration-500">
                        <div className="bg-emerald-600 p-10 text-white relative">
                            <div className="absolute right-0 top-0 opacity-10 translate-x-1/4 -translate-y-1/4 pointer-events-none">
                                <MessageSquare size={160} />
                            </div>
                            <div className="relative z-10">
                                <h2 className="text-3xl font-black uppercase italic tracking-tighter">Consultar Repuesto</h2>
                                <p className="text-emerald-100 font-bold text-sm mt-2">Vas a enviar una consulta a {selectedIds.length} proveedores seleccionados.</p>
                            </div>
                            <button
                                onClick={() => setShowInquiryModal(false)}
                                className="absolute top-8 right-8 bg-emerald-700/50 p-3 rounded-2xl text-emerald-100 hover:text-white transition-all z-50 hover:scale-110 active:scale-95"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl text-blue-700 border border-blue-100">
                                <Info size={20} className="shrink-0" />
                                <p className="text-[10px] font-black uppercase tracking-widest leading-loose">
                                    Los proveedores recibirán el detalle del repuesto junto con la información del vehículo para cotizar.
                                </p>
                            </div>

                            <form onSubmit={handleSendInquiry} className="space-y-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vehículo (Año/Marca/Modelo)</label>
                                    <input
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                        placeholder="Ej: 2018 Toyota Corolla"
                                        value={inquiryData.vehicleInfo}
                                        onChange={(e) => setInquiryData({ ...inquiryData, vehicleInfo: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Repuesto y Detalles</label>
                                    <textarea
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 transition-all min-h-[120px]"
                                        placeholder="Ej: Juego de pastillas de freno delanteras..."
                                        value={inquiryData.partDescription}
                                        onChange={(e) => setInquiryData({ ...inquiryData, partDescription: e.target.value })}
                                        required
                                    />
                                </div>

                                <button
                                    disabled={sending}
                                    className="w-full py-5 bg-emerald-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all flex items-center justify-center gap-3"
                                >
                                    {sending ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>Enviar Consulta <ArrowRight size={16} /></>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
