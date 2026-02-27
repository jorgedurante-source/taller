'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSlug } from '@/lib/slug';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import {
    Plus,
    Trash2,
    User,
    Car,
    DollarSign,
    ClipboardList,
    Wrench,
    Search,
    CheckCircle2,
    ChevronLeft
} from 'lucide-react';
import { useNotification } from '@/lib/notification';
import { useAuth } from '@/lib/auth';

export default function CreateOrderPage() {
    const { slug } = useSlug();
    const router = useRouter();
    const searchParams = useSearchParams();
    const preClientId = searchParams.get('clientId');
    const preVehicleId = searchParams.get('vehicleId');
    const { notify } = useNotification();
    const { hasPermission } = useAuth();

    if (!hasPermission('orders')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
                <ClipboardList size={48} className="mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-xs">Módulo no habilitado</p>
                <p className="text-[10px] mt-2 italic">Contacta al administrador para activar esta funcionalidad</p>
            </div>
        );
    }

    const [clients, setClients] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [catalog, setCatalog] = useState<any[]>([]);
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Selection state
    const [selectedClient, setSelectedClient] = useState<any>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
    const [items, setItems] = useState<any[]>([
        { description: '', labor_price: '', parts_price: '', parts_profit: '', service_id: null }
    ]);
    const [description, setDescription] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [clientsRes, catalogRes, configRes] = await Promise.all([
                    api.get('/clients'),
                    api.get('/services'),
                    api.get('/config')
                ]);
                const allClients = clientsRes.data || [];
                setClients(allClients);
                setCatalog(catalogRes.data || []);
                setConfig(configRes.data || {});

                // Pre-select client and vehicle from query params
                if (preClientId) {
                    const preClient = allClients.find((c: any) => c.id === parseInt(preClientId));
                    if (preClient) {
                        setSelectedClient(preClient);
                        setClientSearch(`${preClient.first_name || ''} ${preClient.last_name || ''}`.trim());
                        const vehiclesRes = await api.get(`/clients/${preClient.id}/vehicles`);
                        const clientVehicles = vehiclesRes.data || [];
                        setVehicles(clientVehicles);
                        if (preVehicleId) {
                            const preVehicle = clientVehicles.find((v: any) => v.id === parseInt(preVehicleId));
                            if (preVehicle) setSelectedVehicle(preVehicle);
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching order data', err);
                setClients([]);
                setCatalog([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Searchable Client State
    const [clientSearch, setClientSearch] = useState('');
    const [showResults, setShowResults] = useState(false);

    const filteredClientList = clients.filter(c => {
        const query = clientSearch.toLowerCase();
        const firstName = (c.first_name || '').toLowerCase();
        const lastName = (c.last_name || '').toLowerCase();
        const nickname = (c.nickname || '').toLowerCase();
        const phone = (c.phone || '');
        return firstName.includes(query) || lastName.includes(query) || nickname.includes(query) || phone.includes(query);
    });

    const selectClient = async (client: any) => {
        setSelectedClient(client);
        setClientSearch(`${client.first_name || ''} ${client.last_name || ''}`.trim());
        setShowResults(false);
        setSelectedVehicle(null);
        try {
            const res = await api.get(`/clients/${client.id}/vehicles`);
            setVehicles(res.data || []);
        } catch (err) {
            setVehicles([]);
        }
    };

    const addItem = () => {
        setItems([...items, { description: '', labor_price: '0', parts_price: '0', parts_profit: '0', service_id: null }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index][field] = value;

        // Auto-calculate profit if parts_price changes
        if (field === 'parts_price') {
            const price = parseFloat(value) || 0;
            const percentage = parseFloat(config?.parts_profit_percentage) || 0;
            if (percentage > 0) {
                // formula: parts_profit = price * (percentage / 100)
                // but wait, usually profit is included in price. 
                // USER said: "calculara con el % seteado de ganancia en repuestos"
                // Usually it means: Profit = TotalParts * (Percentage/100)
                newItems[index].parts_profit = Math.round(price * (percentage / 100)).toString();
            }
        }

        // If selecting from catalog
        if (field === 'service_id' && value) {
            const service = catalog.find(s => s.id === parseInt(value));
            if (service) {
                newItems[index].description = service.name;
                newItems[index].labor_price = service.base_price?.toString() || '0';
            }
        }
        setItems(newItems);
    };

    const calculateTotal = () => {
        return items.reduce((acc, item) => {
            const labor = parseFloat(item.labor_price) || 0;
            const parts = parseFloat(item.parts_price) || 0;
            return acc + labor + parts;
        }, 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient || !selectedVehicle) {
            notify('info', 'Seleccioná un cliente y un vehículo');
            return;
        }

        const validItems = items.filter(i => i.description.trim() !== '' || i.labor_price !== '' || i.parts_price !== '');

        const hasAppointments = config?.enabled_modules?.includes('turnos');
        if (validItems.length === 0 && !hasAppointments) {
            notify('error', 'Debés agregar al menos un ítem a la orden');
            return;
        }

        try {
            const res = await api.post('/orders', {
                client_id: selectedClient.id,
                vehicle_id: selectedVehicle.id,
                description,
                items: validItems
            });
            notify('success', 'Orden creada correctamente');
            router.push(`/${slug}/dashboard/orders/${res.data.id || ''}`);
        } catch (err) {
            notify('error', 'Error al crear la orden');
        }
    };

    if (loading) return <div className="p-8 font-bold text-slate-400">Cargando datos maestros...</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-800 font-bold transition-all px-2"
            >
                <ChevronLeft size={20} /> VOLVER
            </button>

            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase italic">Nueva Orden Trabajo</h2>
                    <p className="text-slate-500 font-bold mt-1 tracking-wider uppercase text-xs">Apertura de servicio en taller</p>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="space-y-8" onClick={() => setShowResults(false)}>
                {/* Step 1: Client & Vehicle */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <section className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6 relative">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                            <User className="text-blue-600" size={24} /> Cliente
                        </h3>
                        <div className="space-y-2 relative">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-widest ml-1">Buscar Cliente</label>
                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">
                                    <Search size={18} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Nombre, Apellido o Apodo..."
                                    className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50/50 text-slate-900 font-bold"
                                    value={clientSearch}
                                    onChange={(e) => {
                                        setClientSearch(e.target.value);
                                        setShowResults(true);
                                        if (!e.target.value) setSelectedClient(null);
                                    }}
                                    onFocus={() => setShowResults(true)}
                                />

                                {showResults && clientSearch.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-2xl z-50 max-h-60 overflow-y-auto">
                                        {filteredClientList.length > 0 ? (
                                            filteredClientList.map(c => (
                                                <div
                                                    key={c.id}
                                                    className="p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                                                    onClick={() => selectClient(c)}
                                                >
                                                    <p className="font-bold text-slate-900">{(c.last_name + ' ' + c.first_name).trim()}</p>
                                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{c.phone}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-slate-400 text-sm italic">No se encontraron resultados</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        {selectedClient && (
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
                                <div>
                                    <p className="text-blue-900 font-bold">{selectedClient.first_name} {selectedClient.last_name}</p>
                                    <p className="text-blue-600 text-sm font-medium">{selectedClient.phone}</p>
                                </div>
                                <CheckCircle2 className="text-blue-500" size={24} />
                            </div>
                        )}
                    </section>

                    <section className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                            <Car className="text-emerald-500" size={24} /> Vehículo
                        </h3>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-widest ml-1">Seleccionar Vehículo</label>
                            <select
                                disabled={!selectedClient}
                                className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50/50 text-slate-900 font-bold appearance-none disabled:opacity-50"
                                value={selectedVehicle?.id || ''}
                                onChange={(e) => setSelectedVehicle(vehicles.find(v => v.id === parseInt(e.target.value)))}
                            >
                                <option value="">-- Seleccionar --</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.brand} {v.model} - {v.plate}</option>
                                ))}
                            </select>
                        </div>
                        {selectedVehicle && (
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <p className="text-emerald-900 font-bold">{selectedVehicle.brand} {selectedVehicle.model}</p>
                                <p className="text-emerald-600 font-mono tracking-widest uppercase">{selectedVehicle.plate}</p>
                            </div>
                        )}
                    </section>
                </div>

                {/* Problem Description */}
                <section className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                        <ClipboardList className="text-blue-600" size={24} /> Problema / Síntomas
                    </h3>
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-widest ml-1">Descripción breve de la falla</label>
                        <textarea
                            className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50/50 text-slate-900 font-bold h-24 resize-none"
                            placeholder="Ej: El auto tironea en baja o hace un ruido al frenar..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </section>

                {/* Step 2: Items */}
                <section className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm space-y-8">
                    <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            <Wrench className="text-amber-500" size={28} /> Detalle del Trabajo
                        </h3>
                        <button
                            type="button"
                            onClick={addItem}
                            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all"
                        >
                            <Plus size={20} /> Agregar Ítem
                        </button>
                    </div>

                    <div className="space-y-6">
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-6 bg-slate-50/50 rounded-[24px] border border-slate-100 group">
                                <div className="lg:col-span-2 space-y-1">
                                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Servicio Catálogo</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold bg-white"
                                        value={item.service_id || ''}
                                        onChange={(e) => updateItem(index, 'service_id', e.target.value)}
                                    >
                                        <option value="">-- Personalizado --</option>
                                        {catalog.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="lg:col-span-3 space-y-1">
                                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Descripción / Tarea</label>
                                    <input
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold bg-white text-slate-900"
                                        placeholder="Ej: Cambio de aceite"
                                        value={item.description}
                                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                                    />
                                </div>
                                <div className="lg:col-span-2 space-y-1">
                                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Mano O. ($)</label>
                                    <input
                                        type="number"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold bg-white text-emerald-600"
                                        value={item.labor_price}
                                        onChange={(e) => updateItem(index, 'labor_price', e.target.value)}
                                    />
                                </div>
                                <div className="lg:col-span-2 space-y-1">
                                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Repuestos ($)</label>
                                    <input
                                        type="number"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold bg-white text-blue-600"
                                        value={item.parts_price}
                                        onChange={(e) => updateItem(index, 'parts_price', e.target.value)}
                                    />
                                </div>
                                <div className="lg:col-span-2 space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Gan. Rep ($)</label>
                                    <input
                                        type="number"
                                        className="w-full px-3 py-3 rounded-xl border border-dashed border-slate-200 text-sm font-bold bg-slate-100/50 text-slate-400 focus:text-blue-600 transition-colors"
                                        title="Dato interno: Ganancia estimada por repuestos"
                                        value={item.parts_profit}
                                        onChange={(e) => updateItem(index, 'parts_profit', e.target.value)}
                                    />
                                </div>
                                <div className="lg:col-span-1 flex items-end justify-center pb-2">
                                    <button
                                        type="button"
                                        disabled={items.length === 1}
                                        onClick={() => removeItem(index)}
                                        className="text-slate-300 hover:text-red-500 transition-colors p-2 disabled:opacity-30"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pt-8 border-t border-slate-100 flex justify-between items-center">
                        <div>
                            <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Total Estimado</p>
                            <p className="text-4xl font-black text-slate-900 mt-1">$ {calculateTotal().toLocaleString()}</p>
                        </div>
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-2xl font-black shadow-2xl shadow-blue-200 transition-all flex items-center gap-3 uppercase tracking-widest"
                        >
                            <CheckCircle2 size={24} /> Confirmar Orden
                        </button>
                    </div>
                </section>
            </form>
        </div>
    );
}
