'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
    Box,
    Plus,
    Search,
    Filter,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    ArrowLeftRight,
    Edit2,
    Trash2,
    History,
    ChevronDown,
    MoreVertical,
    Package,
    MapPin,
    Tag,
    Truck,
    Info,
    Send
} from 'lucide-react';
import { useNotification } from '@/lib/notification';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

export default function StockPage() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [chainStock, setChainStock] = useState<any[]>([]);
    const [searchingChain, setSearchingChain] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestItem, setRequestItem] = useState<any>(null);
    const { notify } = useNotification();
    const { hasPermission } = useAuth();
    const { t } = useTranslation();

    const fetchStock = async () => {
        setLoading(true);
        try {
            const res = await api.get('/stock', { params: { search } });
            setItems(res.data);
        } catch (err) {
            notify('error', 'Error al cargar stock');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStock();
    }, []);

    const handleSearchChain = async () => {
        if (!search) {
            notify('warning', 'Ingresá un término para buscar en la red');
            setChainStock([]);
            return;
        }
        if (search.length < 3) {
            notify('warning', 'La búsqueda debe tener al menos 3 caracteres');
            setChainStock([]);
            return;
        }
        setSearchingChain(true);
        try {
            const res = await api.get('/stock/chain', { params: { search } });
            setChainStock(res.data);
            if (res.data.length === 0) {
                notify('info', 'No se encontraron repuestos en la red de talleres');
            } else {
                notify('success', `Se encontraron ${res.data.length} coincidencias en la red`);
            }
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.message || 'Error al buscar en la red';
            notify('error', msg);
            setChainStock([]);
        } finally {
            setSearchingChain(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Seguro que deseás eliminar este ítem?')) return;
        try {
            await api.delete(`/stock/${id}`);
            setItems(items.filter(i => i.id !== id));
            notify('success', 'Ítem eliminado');
        } catch (err) {
            notify('error', 'No se pudo eliminar el ítem');
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            <header className="flex flex-wrap items-center justify-between gap-6 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="bg-blue-600 text-white p-4 rounded-3xl shadow-xl shadow-blue-200">
                        <Box size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">Stock e Inventario</h2>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Gestión de repuestos y suministros</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    {hasPermission('stock.edit') && (
                        <button
                            onClick={() => { setSelectedItem(null); setShowModal(true); }}
                            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10 flex items-center gap-2"
                        >
                            <Plus size={18} /> Nuevo Ítem
                        </button>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <aside className="lg:col-span-1 space-y-6">
                    <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Search size={14} /> Filtros de Búsqueda
                        </h3>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="text"
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-900 outline-none focus:border-blue-500 transition-all bg-slate-50/50"
                                placeholder="Nombre o SKU..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchStock()}
                            />
                        </div>
                        <button
                            onClick={fetchStock}
                            className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all"
                        >
                            Aplicar Filtros
                        </button>
                    </section>

                    <section className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-200 space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest opacity-70">Consulta en Cadena</h3>
                        <p className="text-xs font-medium leading-relaxed">¿No tenés stock? Buscá repuestos en otros talleres de tu red.</p>
                        <button
                            disabled={searchingChain}
                            onClick={handleSearchChain}
                            className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all backdrop-blur-sm border border-white/20"
                        >
                            {searchingChain ? 'Buscando...' : 'Consultar Cadena'}
                        </button>
                    </section>
                </aside>

                <main className="lg:col-span-3 space-y-8">
                    {chainStock.length > 0 && (
                        <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[30px] space-y-4 animate-in slide-in-from-top-4">
                            <h4 className="flex items-center gap-2 text-amber-800 font-black uppercase text-xs tracking-widest">
                                <Truck size={16} /> Resultados en Otros Talleres
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {chainStock.map((cs, i) => (
                                    <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100 flex justify-between items-center group">
                                        <div>
                                            <p className="text-xs font-black text-slate-900 uppercase">{cs.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{cs.sku || 'S/N'}</span>
                                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">{cs.workshop_name}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="text-right">
                                                <p className="text-lg font-black text-slate-900 leading-none">{cs.quantity}</p>
                                                <p className="text-[8px] font-black text-slate-400 uppercase">Disponibles</p>
                                            </div>
                                            <button
                                                onClick={() => { setRequestItem(cs); setShowRequestModal(true); }}
                                                className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-sm"
                                            >
                                                Solicitar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setChainStock([])} className="text-[10px] font-bold text-amber-600 uppercase underline">Cerrar consulta de cadena</button>
                        </div>
                    )}

                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ítem / Repuesto</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cantidad</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ubicación</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={5} className="p-12 text-center text-slate-400 italic font-bold">Cargando stock...</td></tr>
                                ) : items.length === 0 ? (
                                    <tr><td colSpan={5} className="p-12 text-center text-slate-400 italic font-bold">No se encontraron ítems</td></tr>
                                ) : (
                                    items.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl ${item.quantity <= item.min_quantity ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                                        <Package size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{item.name}</p>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">SKU: {item.sku || '---'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                                    {item.category || 'Varios'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="text-center">
                                                    <p className={`text-xl font-black tabular-nums ${item.quantity <= item.min_quantity ? 'text-red-600' : 'text-slate-900'}`}>{item.quantity}</p>
                                                    {item.quantity <= item.min_quantity && (
                                                        <p className="text-[8px] font-black text-red-500 uppercase tracking-tighter">Bajo Stock</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2 text-slate-500">
                                                    <MapPin size={14} />
                                                    <span className="text-xs font-bold">{item.location || '---'}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button
                                                        onClick={() => { setSelectedItem(item); setShowMovementModal(true); }}
                                                        className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                        title="Movimiento"
                                                    >
                                                        <ArrowLeftRight size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelectedItem(item); setShowModal(true); }}
                                                        className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    {hasPermission('stock.delete') && (
                                                        <button
                                                            onClick={() => handleDelete(item.id)}
                                                            className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </main>
            </div>

            {/* Modal de Stock Ítem (Create/Edit) */}
            {showModal && (
                <StockItemModal
                    item={selectedItem}
                    onClose={() => setShowModal(false)}
                    onSave={() => { fetchStock(); setShowModal(false); }}
                />
            )}

            {/* Modal de Movimiento */}
            {showMovementModal && (
                <MovementModal
                    item={selectedItem}
                    onClose={() => setShowMovementModal(false)}
                    onSave={() => { fetchStock(); setShowMovementModal(false); }}
                />
            )}

            {/* Modal de Solicitud a la Red */}
            {showRequestModal && (
                <RequestPartModal
                    item={requestItem}
                    onClose={() => setShowRequestModal(false)}
                    onSuccess={() => { setShowRequestModal(false); notify('success', 'Pedido enviado correctamente'); }}
                />
            )}
        </div>
    );
}

function RequestPartModal({ item, onClose, onSuccess }: any) {
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const { notify } = useNotification();

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/chain-internal/requests', {
                target_slug: item.workshop_slug,
                item_name: item.name,
                sku: item.sku,
                quantity,
                notes
            });
            onSuccess();
        } catch (err) {
            notify('error', 'Error al enviar el pedido');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white max-w-md w-full rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <header className="p-8 bg-indigo-600 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black uppercase italic tracking-tight">Solicitar Repuesto</h3>
                        <p className="text-indigo-100/70 text-[10px] font-bold uppercase tracking-widest mt-1">Pedir a: {item.workshop_name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
                        <Plus className="rotate-45" size={24} />
                    </button>
                </header>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Repuesto Seleccionado</p>
                            <p className="font-bold text-slate-900">{item.name}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">SKU: {item.sku || 'S/N'}</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cantidad necesaria</label>
                            <input
                                type="number"
                                required
                                min="0.1"
                                step="any"
                                className="w-full px-5 py-4 rounded-2xl border border-slate-200 font-black text-2xl text-slate-900 bg-slate-50/50 outline-none focus:border-indigo-500 text-center"
                                value={quantity}
                                onChange={e => setQuantity(parseFloat(e.target.value))}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notas para el taller</label>
                            <textarea
                                className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-indigo-500 min-h-[80px]"
                                placeholder="Ej: Es urgente, lo paso a buscar a la tarde..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            disabled={loading}
                            type="submit"
                            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? 'Enviando...' : <><Send size={18} /> Enviar Pedido</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ... existing StockItemModal and MovementModal ...

function StockItemModal({ item, onClose, onSave }: any) {
    const [formData, setFormData] = useState<any>(item || {
        name: '', sku: '', category: '', quantity: 0, min_quantity: 5, cost_price: 0, sale_price: 0, location: '', notes: ''
    });
    const { notify } = useNotification();

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        try {
            if (item) {
                await api.put(`/stock/${item.id}`, formData);
                notify('success', 'Ítem actualizado');
            } else {
                await api.post('/stock', formData);
                notify('success', 'Ítem creado');
            }
            onSave();
        } catch (err) {
            notify('error', 'Error al guardar ítem');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white max-w-2xl w-full rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                <header className="p-8 bg-slate-900 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black uppercase italic tracking-tight">{item ? 'Editar Ítem' : 'Nuevo Ítem de Stock'}</h3>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Completá los datos del repuesto</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
                        <Plus className="rotate-45" size={24} />
                    </button>
                </header>
                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre / Descripción</label>
                            <input
                                required
                                className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-bold text-slate-900 bg-slate-50/50 outline-none focus:border-blue-500"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SKU / Código</label>
                            <input
                                className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-bold text-slate-900 bg-slate-50/50 outline-none focus:border-blue-500"
                                value={formData.sku}
                                onChange={e => setFormData({ ...formData, sku: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                            <input
                                className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-bold text-slate-900 bg-slate-50/50 outline-none focus:border-blue-500"
                                value={formData.category}
                                placeholder="Ej: Frenos, Ópticas..."
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ubicación</label>
                            <input
                                className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-bold text-slate-900 bg-slate-50/50 outline-none focus:border-blue-500"
                                value={formData.location}
                                placeholder="Pasillo 4, Estante B"
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Mínimo</label>
                            <input
                                type="number"
                                className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-bold text-slate-900 bg-slate-50/50 outline-none focus:border-blue-500"
                                value={formData.min_quantity}
                                onChange={e => setFormData({ ...formData, min_quantity: parseFloat(e.target.value) })}
                            />
                        </div>
                        {!item && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Inicial</label>
                                <input
                                    type="number"
                                    className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-bold text-slate-900 bg-slate-50/50 outline-none focus:border-blue-500"
                                    value={formData.quantity}
                                    onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                                />
                            </div>
                        )}
                    </div>
                    <div className="pt-6 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:text-slate-600">Cancelar</button>
                        <button type="submit" className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-slate-900 transition-all">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function MovementModal({ item, onClose, onSave }: any) {
    const [type, setType] = useState('in');
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');
    const { notify } = useNotification();

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        try {
            await api.post('/stock/movement', {
                item_id: item.id,
                type,
                quantity,
                notes
            });
            notify('success', 'Movimiento registrado');
            onSave();
        } catch (err) {
            notify('error', 'Error al registrar movimiento');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white max-w-md w-full rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <header className="p-8 bg-blue-600 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black uppercase italic tracking-tight italic">Registrar Movimiento</h3>
                        <p className="text-blue-100/70 text-[10px] font-bold uppercase tracking-widest mt-1">{item.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
                        <Plus className="rotate-45" size={24} />
                    </button>
                </header>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                        <button
                            type="button"
                            onClick={() => setType('in')}
                            className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${type === 'in' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                        >
                            Entrada (+)
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('out')}
                            className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${type === 'out' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500'}`}
                        >
                            Salida (-)
                        </button>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cantidad</label>
                        <input
                            type="number"
                            required
                            className="w-full px-5 py-4 rounded-2xl border border-slate-200 font-black text-2xl text-slate-900 bg-slate-50/50 outline-none focus:border-blue-500 text-center"
                            value={quantity}
                            onChange={e => setQuantity(parseFloat(e.target.value))}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo / Notas</label>
                        <textarea
                            className="w-full px-5 py-3 rounded-2xl border border-slate-200 font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-blue-500 min-h-[100px]"
                            placeholder="Ej: Compra a proveedor, uso en orden #123..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>

                    <div className="pt-4">
                        <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:bg-blue-600 transition-all">
                            Confirmar Movimiento
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
