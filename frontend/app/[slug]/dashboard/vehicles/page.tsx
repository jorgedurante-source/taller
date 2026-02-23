'use client';
import { useSlug } from '@/lib/slug';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { Search, Car, User, Phone, ClipboardList, ArrowRight, Hash, Filter } from 'lucide-react';

export default function VehiclesPage() {
    const { slug } = useSlug();
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const fetchVehicles = async () => {
            try {
                // In multi-tenant, we might want to get ALL vehicles of the current workshop
                // Let's use a specialized endpoint if we have one, or get all clients' vehicles
                const response = await api.get('/clients/all-vehicles');
                setVehicles(response.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchVehicles();
    }, []);

    const filteredVehicles = vehicles.filter(v => {
        const query = search.toLowerCase();
        return (
            (v.brand || '').toLowerCase().includes(query) ||
            (v.model || '').toLowerCase().includes(query) ||
            (v.plate || '').toLowerCase().includes(query) ||
            (v.client_name || '').toLowerCase().includes(query) ||
            (v.client_phone || '').includes(query)
        );
    });

    return (
        <div className="space-y-6 pb-20">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Base de Vehículos</h2>
                    <p className="text-slate-500 font-bold tracking-wider uppercase text-xs mt-1">Legajo técnico global</p>
                </div>
            </header>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="bg-slate-50 p-3 rounded-xl text-slate-400">
                        <Search size={20} />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por marca, modelo, patente o dueño..."
                        className="bg-transparent border-none outline-none w-full text-slate-900 font-bold p-2 placeholder-slate-400"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button className="bg-white p-4 rounded-2xl border border-slate-100 text-slate-400 hover:text-slate-900 transition-all shadow-sm">
                    <Filter size={20} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <p className="col-span-full text-center py-20 text-slate-400 font-bold italic">Cargando parque automotor...</p>
                ) : filteredVehicles.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                        <Car size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No se encontraron vehículos</p>
                    </div>
                ) : (
                    filteredVehicles.map(vehicle => (
                        <div key={vehicle.id} className="bg-white rounded-[40px] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group overflow-hidden">
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-xl shadow-blue-100">
                                        <Car size={28} />
                                    </div>
                                    <div className="bg-slate-900 text-white px-4 py-2 rounded-xl flex items-center gap-2">
                                        <Hash size={14} className="text-blue-400" />
                                        <span className="font-black text-sm tracking-tighter uppercase italic">{vehicle.plate}</span>
                                    </div>
                                </div>

                                <h3 className="text-2xl font-black text-slate-900 uppercase italic leading-none mb-1 truncate">
                                    {vehicle.brand} {vehicle.model}
                                </h3>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">Año {vehicle.year || '---'}</p>

                                <div className="space-y-4 mb-8">
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <User size={18} className="text-blue-500" />
                                        <span className="font-bold text-slate-700 uppercase">{vehicle.client_name}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-500">
                                        <Phone size={18} className="text-emerald-500" />
                                        <span className="font-medium">{vehicle.client_phone}</span>
                                    </div>
                                    {vehicle.km && (
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <ClipboardList size={18} className="text-amber-500" />
                                            <span className="font-medium">{vehicle.km.toLocaleString()} km</span>
                                        </div>
                                    )}
                                </div>

                                <Link
                                    href={`/${slug}/dashboard/vehicles/${vehicle.id}`}
                                    className="w-full py-4 bg-slate-50 hover:bg-blue-600 text-slate-600 hover:text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all border border-slate-100 hover:border-blue-600 flex items-center justify-center gap-2"
                                >
                                    Ver Historial <ArrowRight size={16} />
                                </Link>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
