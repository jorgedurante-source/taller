'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
    ChevronLeft,
    ClipboardList,
    Clock,
    User,
    Car,
    FileText,
    Settings,
    History,
    Pencil,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Download,
    DollarSign,
    Plus,
    MessageSquare,
    Mail,
    CircleDollarSign,
    CircleSlash,
    ArrowRight,
    X,
    Check,
    Share2,
    Copy,
    Calendar as CalendarIcon,
    ExternalLink,
    Truck,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useSlug } from '@/lib/slug';
import { useNotification } from '@/lib/notification';

export default function OrderDetailsPage() {
    const { slug } = useSlug();
    const params = useParams();
    const router = useRouter();
    const { hasPermission } = useAuth();
    const canSeeIncome = hasPermission('ingresos');
    const { notify } = useNotification();

    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [newStatus, setNewStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');
    const [updating, setUpdating] = useState(false);
    const [reminderDays, setReminderDays] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('');
    const [showItemsModal, setShowItemsModal] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [catalog, setCatalog] = useState<any[]>([]);
    const [config, setConfig] = useState<any>(null);
    const [newItems, setNewItems] = useState([{ description: '', labor_price: '0', parts_price: '0', parts_profit: '0', service_id: null }]);
    const [inquiries, setInquiries] = useState<any[]>([]);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [replyMessage, setReplyMessage] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [selectedThread, setSelectedThread] = useState<string | null>(null);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);

    // Inline edit state
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const [editItemData, setEditItemData] = useState<any>(null);

    // Payment state
    const [paymentStatus, setPaymentStatus] = useState('sin_cobrar');
    const [paymentAmount, setPaymentAmount] = useState<number>(0);
    const [savingPayment, setSavingPayment] = useState(false);

    const fetchOrder = useCallback(async () => {
        try {
            const [orderRes, configRes] = await Promise.all([
                api.get(`/orders/${params.id}`),
                api.get('/config')
            ]);
            setOrder(orderRes.data);
            setConfig(configRes.data || {});
            setNewStatus(orderRes.data.status);
            setPaymentStatus(orderRes.data.payment_status || 'sin_cobrar');
            setPaymentAmount(orderRes.data.payment_amount || 0);
            setReminderDays(orderRes.data.reminder_days ? String(orderRes.data.reminder_days) : '');
            if (orderRes.data.appointment_date) {
                // SQLite might use space or T
                const cleanDate = orderRes.data.appointment_date.includes('T')
                    ? orderRes.data.appointment_date
                    : orderRes.data.appointment_date.replace(' ', 'T');
                const dateObj = new Date(cleanDate);
                if (!isNaN(dateObj.getTime())) {
                    setAppointmentDate(cleanDate.split('T')[0]);
                    const hours = String(dateObj.getHours()).padStart(2, '0');
                    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                    setAppointmentTime(`${hours}:${minutes}`);
                }
            }
        } catch (err) {
            console.error('Error fetching order', err);
        } finally {
            setLoading(false);
        }
    }, [params.id]);

    const fetchInquiries = useCallback(async () => {
        if (!params.id) return;
        try {
            const res = await api.get(`/suppliers/inquiries/order/${params.id}`);
            setInquiries(res.data);
        } catch (err) {
            console.error('Error fetching inquiries', err);
        }
    }, [params.id]);

    const fetchCatalog = async () => {
        try {
            const res = await api.get('/services');
            setCatalog(res.data);
        } catch (err) {
            console.error('Error fetching catalog', err);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const res = await api.get('/suppliers');
            setSuppliers(res.data);
        } catch (err) {
            console.error('Error fetching suppliers', err);
        }
    };

    const getTimeSlots = (dateStr: string) => {
        if (!dateStr || !config?.business_hours) return [];
        let hoursObj: any = {};
        try {
            hoursObj = typeof config.business_hours === 'string' ? JSON.parse(config.business_hours) : config.business_hours;
        } catch (e) {
            return [];
        }

        const date = new Date(dateStr + 'T12:00:00'); // Use mid-day to avoid TZ issues
        const day = date.getDay();
        let rangeStr = '';
        if (day >= 1 && day <= 5) rangeStr = hoursObj.mon_fri;
        else if (day === 6) rangeStr = hoursObj.sat;
        else if (day === 0) rangeStr = hoursObj.sun;

        if (!rangeStr || rangeStr.toLowerCase() === 'cerrado') return [];

        const parts = rangeStr.split('-').map((s: string) => s.trim());
        if (parts.length !== 2) return [];

        const [startH, startM] = parts[0].split(':').map(Number);
        const [endH, endM] = parts[1].split(':').map(Number);
        if (isNaN(startH) || isNaN(endH)) return [];

        const slots = [];
        let curr = new Date(date);
        curr.setHours(startH, startM || 0, 0, 0);

        const end = new Date(date);
        end.setHours(endH, endM || 0, 0, 0);

        while (curr <= end) {
            const h = String(curr.getHours()).padStart(2, '0');
            const m = String(curr.getMinutes()).padStart(2, '0');
            slots.push(`${h}:${m}`);
            curr.setMinutes(curr.getMinutes() + 30);
        }

        // Ensure current assigned time is always in the list
        if (appointmentTime && !slots.includes(appointmentTime)) {
            slots.push(appointmentTime);
            slots.sort();
        }
        return slots;
    };
    useEffect(() => {
        fetchOrder();
        fetchCatalog();
        fetchInquiries();
        if (hasPermission('proveedores')) {
            fetchSuppliers();
        }
    }, [fetchOrder, fetchInquiries, hasPermission]);

    const handleStatusUpdate = async () => {
        setUpdating(true);
        try {
            let finalAppointmentDate = null;
            if (newStatus === 'Turno asignado' && appointmentDate && appointmentTime) {
                finalAppointmentDate = `${appointmentDate}T${appointmentTime}:00`;
            }

            await api.put(`/orders/${order.id}/status`, {
                status: newStatus,
                notes: statusNotes,
                reminder_days: reminderDays || null,
                appointment_date: finalAppointmentDate
            });
            setStatusNotes('');
            setReminderDays('');
            fetchOrder();
            notify('success', 'Estado actualizado correctamente');
        } catch (err: any) {
            notify('error', 'Error al actualizar estado: ' + (err.response?.data?.message || err.message));
        } finally {
            setUpdating(false);
        }
    };

    const handleEditItemChange = (field: string, value: string) => {
        const updated = { ...editItemData, [field]: value };
        if (field === 'parts_price') {
            const price = parseFloat(value) || 0;
            const percentage = parseFloat(config?.parts_profit_percentage) || 0;
            if (percentage > 0) {
                updated.parts_profit = Math.round(price * (percentage / 100)).toString();
            }
        }
        setEditItemData(updated);
    };

    const handleSaveEditItem = async () => {
        if (!editItemData) return;
        try {
            await api.put(`/orders/items/${editingItemId}`, {
                description: editItemData.description,
                labor_price: editItemData.labor_price,
                parts_price: editItemData.parts_price,
                parts_profit: editItemData.parts_profit
            });
            fetchOrder();
            notify('success', 'Item actualizado');
            setEditingItemId(null);
            setEditItemData(null);
        } catch (err: any) {
            console.error('Error updating item', err);
            notify('error', 'Error al actualizar ítem: ' + (err.response?.data?.message || err.message));
        }
    };

    const copyPublicLink = () => {
        const url = `${window.location.origin}/${slug}/o/${order.share_token}`;
        navigator.clipboard.writeText(url);
        notify('success', 'Enlace de seguimiento copiado');
    };

    const handlePaymentUpdate = async () => {
        setSavingPayment(true);
        try {
            await api.put(`/orders/${order.id}/payment`, {
                payment_status: paymentStatus,
                payment_amount: paymentAmount
            });
            fetchOrder();
            notify('success', 'Información de cobro actualizada');
        } catch (err: any) {
            notify('error', 'Error al actualizar cobro: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingPayment(false);
        }
    };

    const handleAddItems = async () => {
        try {
            await api.post(`/orders/${order.id}/items`, { items: newItems });
            setShowItemsModal(false);
            setNewItems([{ description: '', labor_price: '0', parts_price: '0', parts_profit: '0', service_id: null }]);
            fetchOrder();
            notify('success', 'Items agregados a la orden');
        } catch (err) {
            notify('error', 'Error al agregar items');
        }
    };

    const updateItem = (index: number, field: string, value: any) => {
        const updated = [...newItems];
        if (field === 'service_id') {
            const service = catalog.find(s => s.id === parseInt(value));
            updated[index] = {
                ...updated[index],
                service_id: value,
                description: service?.name || '',
                labor_price: service?.base_price?.toString() || '0'
            };
        } else {
            (updated[index] as any)[field] = value;
            if (field === 'parts_price') {
                const price = parseFloat(value) || 0;
                const percentage = parseFloat(config?.parts_profit_percentage) || 0;
                if (percentage > 0) {
                    (updated[index] as any).parts_profit = Math.round(price * (percentage / 100)).toString();
                }
            }
        }
        setNewItems(updated);
    };

    const downloadPDF = async () => {
        try {
            const response = await api.get(`/reports/order-pdf/${order.id}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Orden_${order.id}_${order.plate}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            notify('error', 'Error al generar PDF');
        }
    };

    const sendEmailClient = async () => {
        setSendingEmail(true);
        try {
            await api.post(`/orders/${order.id}/send-email`);
            notify('success', 'Email enviado correctamente');
        } catch (err) {
            notify('error', 'Error al enviar email');
        } finally {
            setSendingEmail(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyMessage.trim() || !replyingTo) return;
        setSendingReply(true);
        try {
            await api.post(`/orders/${order.id}/reply`, {
                to: replyingTo.reply_to,
                message: replyMessage
            });
            notify('success', 'Respuesta enviada');
            setReplyMessage('');
            setReplyingTo(null);
            fetchOrder();
        } catch (err) {
            notify('error', 'Error al enviar respuesta');
        } finally {
            setSendingReply(false);
        }
    };

    const markAsRead = async (email: string) => {
        try {
            await api.put(`/orders/${params.id}/messages/read`, { reply_to: email });
            // Update local state is_read to true for these messages to avoid re-fetch if possible
            const updatedHistory = order.history.map((h: any) => {
                if (h.reply_to === email && h.status === 'Respuesta Recibida') {
                    return { ...h, is_read: 1 };
                }
                return h;
            });
            setOrder({ ...order, history: updatedHistory });
        } catch (err) {
            console.error('Error marking as read', err);
        }
    };

    useEffect(() => {
        if (selectedThread && isMessagesExpanded) {
            markAsRead(selectedThread);
        }
    }, [selectedThread, isMessagesExpanded, params.id]);

    // Group messages by thread (reply_to email)
    const getThreads = () => {
        if (!order?.history) return {};
        const threads: any = {};
        order.history.forEach((h: any) => {
            if (h.status === 'Respuesta Recibida' || h.status === 'Respuesta Enviada') {
                const email = h.reply_to;
                if (!email) return;

                // Find supplier name by email
                const supplier = suppliers.find(s => s.email?.toLowerCase() === email.toLowerCase());
                const displayName = supplier ? supplier.name : email;

                if (!threads[email]) threads[email] = { name: displayName, messages: [], unreadCount: 0 };
                threads[email].messages.push(h);
                if (h.status === 'Respuesta Recibida' && (h.is_read === 0 || !h.is_read)) {
                    threads[email].unreadCount++;
                }
            }
        });
        return threads;
    };

    const threads = getThreads();
    const totalUnread = Object.values(threads).reduce((acc: number, t: any) => acc + t.unreadCount, 0);
    const canManageSuppliers = hasPermission('proveedores');
    const hasConversations = Object.keys(threads).length > 0 && canManageSuppliers;

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Cargando detalles...</p>
        </div>
    );

    if (!order) return <div className="p-20 text-center font-bold text-slate-400 uppercase tracking-widest">Orden no encontrada</div>;

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'Pendiente': return 'bg-slate-100 text-slate-600 border-slate-200';
            case 'Turno asignado': return 'bg-purple-50 text-purple-600 border-purple-100';
            case 'Aprobado': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'En proceso':
            case 'En reparación': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'Esperando Repuestos': return 'bg-orange-50 text-orange-600 border-orange-100';
            case 'Listo para entrega': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
            case 'Entregado': return 'bg-slate-900 text-white border-slate-800';
            case 'Respuesta Recibida': return 'bg-blue-600 text-white border-blue-700';
            case 'Respuesta Enviada': return 'bg-slate-800 text-white border-slate-900';
            default: return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    const totalOrder = order.items?.reduce((acc: number, item: any) => acc + (item.labor_price || 0) + (item.parts_price || 0) + (item.parts_profit || 0), 0) || 0;

    return (
        <div className="space-y-8 pb-20 max-w-7xl mx-auto">
            {/* Header & Actions */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <Link href={`/${slug}/dashboard/orders`} className="bg-white p-3 rounded-2xl border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm transition-all group">
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Orden #{order.id}</h2>
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyle(order.status)}`}>
                                {order.status}
                            </span>
                        </div>
                        <div className="flex flex-col gap-2 mt-1">
                            <p className="text-slate-400 font-bold tracking-wider uppercase text-[10px]">
                                {new Date(order.created_at).toLocaleDateString()} - {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {order.created_by_name && <span className="text-blue-500 ml-2">por {order.created_by_name}</span>}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={sendEmailClient}
                                    disabled={sendingEmail}
                                    className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Mail size={14} /> {sendingEmail ? '...' : 'Notificar Email'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    {order?.share_token && (
                        <button
                            onClick={copyPublicLink}
                            className="flex-1 md:flex-none bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <Share2 size={16} /> Compartir
                        </button>
                    )}
                    <a
                        href={`https://wa.me/${order.client_phone?.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 md:flex-none bg-emerald-50 text-emerald-600 border border-emerald-100 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        <MessageSquare size={16} /> WA
                    </a>
                    <a
                        href={`mailto:${order.client_email}`}
                        className="flex-1 md:flex-none bg-blue-50 text-blue-600 border border-blue-100 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        <Mail size={16} /> Mail
                    </a>
                    <div className="w-[1px] h-10 bg-slate-100 mx-1 hidden md:block" />
                    <button
                        onClick={downloadPDF}
                        className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-400 hover:text-slate-900 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                    >
                        <Download size={16} /> PDF
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Information Columns */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Items Table */}
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                                    <ClipboardList size={20} />
                                </div>
                                <h3 className="font-black text-slate-900 uppercase tracking-tight">Detalle del Servicio</h3>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">
                                    {order.items?.length || 0} ITEMS
                                </span>
                                <button
                                    onClick={() => setShowItemsModal(true)}
                                    className="bg-blue-600 text-white p-2 rounded-xl hover:bg-slate-900 transition-all shadow-lg shadow-blue-100"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-4 whitespace-nowrap">Descripción</th>
                                        <th className="px-8 py-4 text-right whitespace-nowrap">Mano de Obra</th>
                                        <th className="px-8 py-4 text-right whitespace-nowrap">Repuestos</th>
                                        <th className="px-8 py-4 text-right whitespace-nowrap">Gan. Repuestos</th>
                                        <th className="px-8 py-4 text-right whitespace-nowrap">Subtotal</th>
                                        <th className="px-8 py-4 text-right whitespace-nowrap">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {order.items.map((item: any) => {
                                        const isEditing = editingItemId === item.id;
                                        return (
                                            <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                                                {isEditing ? (
                                                    <>
                                                        <td className="px-8 py-4">
                                                            <input
                                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-bold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                value={editItemData.description}
                                                                onChange={(e) => handleEditItemChange('description', e.target.value)}
                                                                placeholder="Descripción"
                                                            />
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <input
                                                                type="number"
                                                                className="w-full text-right px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono font-bold text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                value={editItemData.labor_price}
                                                                onChange={(e) => handleEditItemChange('labor_price', e.target.value)}
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <input
                                                                type="number"
                                                                className="w-full text-right px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono font-bold text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                value={editItemData.parts_price}
                                                                onChange={(e) => handleEditItemChange('parts_price', e.target.value)}
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <input
                                                                type="number"
                                                                className="w-full text-right px-3 py-2 rounded-lg border border-dashed border-slate-200 bg-slate-100 font-mono font-black text-sm text-emerald-500/80 focus:outline-none focus:border-blue-400"
                                                                value={editItemData.parts_profit}
                                                                onChange={(e) => handleEditItemChange('parts_profit', e.target.value)}
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td className="px-8 py-4 text-right text-slate-900 font-black whitespace-nowrap">
                                                            ${((parseFloat(editItemData.labor_price) || 0) + (parseFloat(editItemData.parts_price) || 0)).toLocaleString()}
                                                        </td>
                                                        <td className="px-8 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={handleSaveEditItem}
                                                                    className="p-1.5 bg-blue-600 text-white rounded hover:bg-black transition-colors"
                                                                    title="Guardar"
                                                                >
                                                                    <Check size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingItemId(null);
                                                                        setEditItemData(null);
                                                                    }}
                                                                    className="p-1.5 bg-slate-200 text-slate-500 rounded hover:bg-slate-300 transition-colors"
                                                                    title="Cancelar"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-8 py-4">
                                                            <p className="font-bold text-slate-800">{item.description}</p>
                                                        </td>
                                                        <td className="px-8 py-4 text-right font-mono font-bold text-slate-500">${item.labor_price?.toLocaleString()}</td>
                                                        <td className="px-8 py-4 text-right font-mono font-bold text-slate-500">${item.parts_price?.toLocaleString()}</td>
                                                        <td className="px-8 py-4 text-right font-mono font-black text-emerald-500/80">${item.parts_profit?.toLocaleString() || '0'}</td>
                                                        <td className="px-8 py-4 text-right text-slate-900 font-black">${((item.labor_price || 0) + (item.parts_price || 0)).toLocaleString()}</td>
                                                        <td className="px-8 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingItemId(item.id);
                                                                        setEditItemData({ ...item });
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                                                >
                                                                    <Pencil size={18} />
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        if (confirm('¿Eliminar este item?')) {
                                                                            await api.delete(`/orders/items/${item.id}`);
                                                                            fetchOrder();
                                                                            notify('success', 'Item eliminado');
                                                                        }
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                    {order.items?.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-10 text-center text-slate-400 italic font-bold">Sin items cargados</td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-slate-50/50 border-t border-slate-100">
                                    <tr>
                                        <td colSpan={4} className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Estimado</td>
                                        <td className="px-8 py-6 text-right text-xl font-black text-blue-600 tracking-tighter">${totalOrder.toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Part Inquiries - Moved here below Items */}
                    {inquiries.length > 0 && (
                        <div className="bg-emerald-50 rounded-[40px] border-2 border-emerald-100 p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-600 text-white p-2.5 rounded-2xl shadow-lg shadow-emerald-200">
                                        <Truck size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-emerald-900 uppercase tracking-tight">Consultas de Repuestos</h3>
                                        <p className="text-emerald-600/70 text-[10px] font-black uppercase tracking-widest">Historial de pedidos a proveedores</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {inquiries.map((inquiry: any) => (
                                    <div key={inquiry.id} className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-wrap gap-2">
                                                {inquiry.supplier_ids.map((s: string, idx: number) => (
                                                    <span key={idx} className="bg-emerald-50 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-emerald-700 border border-emerald-100">
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                {new Date(inquiry.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative">
                                            <div className="absolute -top-2 left-4 bg-white px-2 text-[8px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">Mensaje enviado</div>
                                            <p className="text-sm font-bold text-slate-700 italic leading-relaxed">
                                                "{inquiry.part_description}"
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messaging Center */}
                    {hasConversations && (
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden transition-all duration-300">
                            <button
                                onClick={() => setIsMessagesExpanded(!isMessagesExpanded)}
                                className="w-full p-8 border-b border-slate-50 flex items-center justify-between bg-blue-50/10 backdrop-blur-sm hover:bg-blue-600/5 transition-colors text-left group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-2xl shadow-lg transition-all duration-300 ${isMessagesExpanded ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-600/10 group-hover:text-blue-600'}`}>
                                        <MessageSquare size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                            Centro de Mensajería
                                            <span className="bg-blue-600/10 px-2 py-0.5 rounded-full text-[8px] font-black text-blue-600 border border-blue-600/20 uppercase">
                                                {Object.keys(threads).length}
                                            </span>
                                            {totalUnread > 0 && (
                                                <span className="bg-red-500 px-2 py-0.5 rounded-full text-[8px] font-black text-white uppercase animate-pulse">
                                                    {totalUnread} NO LEÍDOS
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                            {isMessagesExpanded ? 'Cliquear para colapsar' : 'Cliquear para expandir conversaciones'}
                                        </p>
                                    </div>
                                </div>
                                <div className={`p-2 rounded-xl border border-slate-100 text-slate-400 transition-all duration-300 ${isMessagesExpanded ? 'rotate-180' : ''}`}>
                                    <ChevronDown size={20} />
                                </div>
                            </button>

                            {isMessagesExpanded && (
                                <div className="grid grid-cols-1 md:grid-cols-3 min-h-[450px] animate-in fade-in slide-in-from-top-4 duration-500">
                                    {/* Thread List */}
                                    <div className="border-r border-slate-100 bg-slate-50/30">
                                        <div className="divide-y divide-slate-100">
                                            {Object.keys(threads).map(email => (
                                                <button
                                                    key={email}
                                                    onClick={() => {
                                                        setSelectedThread(email);
                                                        setReplyingTo(null);
                                                        setReplyMessage('');
                                                    }}
                                                    className={`w-full text-left p-6 transition-all hover:bg-blue-600/5 flex flex-col gap-1 border-l-4 relative ${selectedThread === email ? 'bg-white border-blue-600' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                                >
                                                    {threads[email].unreadCount > 0 && (
                                                        <div className="absolute top-6 right-6 w-2.5 h-2.5 bg-red-500 rounded-full shadow-lg shadow-red-200"></div>
                                                    )}
                                                    <span className={`text-xs font-black truncate w-full uppercase ${threads[email].unreadCount > 0 ? 'text-slate-900' : 'text-slate-500'}`}>{threads[email].name}</span>
                                                    <span className="text-[10px] font-medium text-slate-500 italic truncate w-full">
                                                        {email}
                                                    </span>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className="text-[9px] font-bold text-slate-400">
                                                            Último: {new Date(threads[email].messages[0].created_at).toLocaleDateString()}
                                                        </span>
                                                        {threads[email].unreadCount > 0 && (
                                                            <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter">
                                                                {threads[email].unreadCount} nuevo{threads[email].unreadCount > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Thread Messages */}
                                    <div className="md:col-span-2 flex flex-col bg-white">
                                        {selectedThread ? (
                                            <>
                                                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">Chat con</span>
                                                        <span className="text-xs font-black text-slate-900 uppercase">{threads[selectedThread].name}</span>
                                                    </div>
                                                    {hasPermission('proveedores') && (
                                                        <button
                                                            onClick={() => {
                                                                setReplyingTo({ reply_to: selectedThread });
                                                                setReplyMessage('');
                                                            }}
                                                            className="bg-blue-600 hover:bg-slate-900 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                                                        >
                                                            Responder
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex-1 overflow-y-auto p-8 space-y-6 max-h-[450px] bg-slate-50/10">
                                                    {threads[selectedThread].messages.slice().reverse().map((msg: any) => (
                                                        <div key={msg.id} className={`flex flex-col ${msg.status === 'Respuesta Enviada' ? 'items-end' : 'items-start'}`}>
                                                            <div className={`max-w-[85%] p-5 rounded-[28px] shadow-sm ${msg.status === 'Respuesta Enviada'
                                                                ? 'bg-blue-600 text-white rounded-tr-none'
                                                                : 'bg-white border border-slate-100 text-slate-900 rounded-tl-none'
                                                                }`}>
                                                                <p className="text-sm font-bold whitespace-pre-wrap leading-relaxed">
                                                                    {msg.status === 'Respuesta Enviada'
                                                                        ? msg.notes.split(':\n')[1] || msg.notes
                                                                        : msg.notes
                                                                    }
                                                                </p>
                                                            </div>
                                                            <span className="text-[9px] font-black text-slate-400 mt-2 uppercase tracking-widest px-2">
                                                                {new Date(msg.created_at).toLocaleDateString()} - {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* In-Chat Reply Form */}
                                                {replyingTo?.reply_to === selectedThread && (
                                                    <div className="p-6 bg-white border-t border-slate-100 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                                                        <textarea
                                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 h-24 resize-none placeholder:text-slate-300"
                                                            placeholder="Escribe tu respuesta aquí..."
                                                            value={replyMessage}
                                                            onChange={(e) => setReplyMessage(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <div className="flex gap-3">
                                                            <button
                                                                onClick={handleSendReply}
                                                                disabled={sendingReply || !replyMessage.trim()}
                                                                className="flex-1 bg-blue-600 hover:bg-slate-900 disabled:opacity-50 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                                                            >
                                                                {sendingReply ? 'Enviando...' : 'Enviar Respuesta'}
                                                            </button>
                                                            <button
                                                                onClick={() => setReplyingTo(null)}
                                                                className="px-6 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center gap-4">
                                                <div className="bg-slate-50 p-6 rounded-3xl text-slate-300">
                                                    <MessageSquare size={48} />
                                                </div>
                                                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] italic">Selecciona un contacto para leer la conversación</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Order History Timeline */}
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8">
                        <div className="flex items-center gap-3 mb-10">
                            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg">
                                <History size={20} />
                            </div>
                            <h3 className="font-black text-slate-900 uppercase tracking-tight">Historial de la Orden</h3>
                        </div>
                        <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                            {order.history?.filter((h: any) => h.status !== 'Respuesta Recibida' && h.status !== 'Respuesta Enviada').map((h: any, idx: number) => (
                                <div key={h.id} className="relative pl-10">
                                    <div className={`absolute left-0 top-1 w-[24px] h-[24px] rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 ${idx === 0 ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                        {idx === 0 && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(h.status)}`}>
                                                {h.status}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                {new Date(h.created_at).toLocaleDateString()} - {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {h.user_name && (
                                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md italic">
                                                    @{h.user_name}
                                                </span>
                                            )}
                                            {h.status === 'Respuesta Recibida' && h.reply_to && (
                                                <div className="flex items-center gap-2">
                                                    {replyingTo?.id !== h.id && hasPermission('proveedores') && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setReplyingTo(h);
                                                                setReplyMessage('');
                                                            }}
                                                            className="text-[8px] font-black uppercase tracking-widest bg-white text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shadow-sm flex items-center gap-1 transition-all"
                                                        >
                                                            <Mail size={10} /> Responder
                                                        </button>
                                                    )}
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 flex items-center gap-1">
                                                        <X size={10} /> Privado
                                                    </span>
                                                </div>
                                            )}

                                            {h.status === 'Respuesta Enviada' && (
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 flex items-center gap-1 w-fit">
                                                    <X size={10} /> Privado
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap">{h.notes}</p>

                                        {/* Reply Form */}
                                        {replyingTo?.id === h.id && (
                                            <div className="mt-4 bg-white p-5 rounded-3xl border-2 border-blue-500/20 shadow-xl shadow-blue-500/5 space-y-4 animate-in zoom-in duration-300">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2 text-blue-600">
                                                        <Mail size={16} />
                                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Respondiendo a {h.reply_to}</span>
                                                    </div>
                                                    <button onClick={() => setReplyingTo(null)} className="text-slate-300 hover:text-slate-600 p-1">
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                                <textarea
                                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 h-32 resize-none placeholder:text-slate-300"
                                                    placeholder="Escribe tu respuesta aquí. El proveedor la recibirá por mail..."
                                                    value={replyMessage}
                                                    onChange={(e) => setReplyMessage(e.target.value)}
                                                    autoFocus
                                                />
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={handleSendReply}
                                                        disabled={sendingReply || !replyMessage.trim()}
                                                        className="flex-1 bg-blue-600 hover:bg-slate-900 disabled:opacity-50 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                                                    >
                                                        {sendingReply ? 'Enviando...' : 'Enviar Respuesta Directa'}
                                                    </button>
                                                    <button
                                                        onClick={() => setReplyingTo(null)}
                                                        className="px-6 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Sidebar Details */}
                <div className="space-y-8">
                    {/* Status Management */}
                    <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl shadow-slate-200">
                        <h3 className="font-black uppercase tracking-widest text-xs text-blue-400 mb-6 italic">Gestión de Proceso</h3>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nuevo Estado</label>
                                <select
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
                                    value={newStatus}
                                    onChange={(e) => setNewStatus(e.target.value)}
                                >
                                    <option value="Pendiente" className="text-slate-900">Pendiente</option>
                                    {config?.enabled_modules?.includes('turnos') && hasPermission('turnos') && (
                                        <option value="Turno asignado" className="text-slate-900">Turno asignado</option>
                                    )}
                                    <option value="En proceso" className="text-slate-900">En proceso</option>
                                    <option value="Presupuestado" className="text-slate-900">Presupuestado</option>
                                    <option value="Aprobado" className="text-slate-900">Aprobado</option>
                                    <option value="En reparación" className="text-slate-900">En reparación</option>
                                    {config?.enabled_modules?.includes('proveedores') && hasPermission('proveedores') && (
                                        <option value="Esperando Repuestos" className="text-slate-900">Esperando Repuestos</option>
                                    )}
                                    <option value="Listo para entrega" className="text-slate-900">Listo para entrega</option>
                                    <option value="Entregado" className="text-slate-900">Entregado</option>
                                </select>
                            </div>

                            {/* Shortcut to Suppliers when waiting for parts */}
                            {order.status === 'Esperando Repuestos' && hasPermission('proveedores') && (
                                <button
                                    onClick={() => {
                                        const vInfo = `${order.year || ''} ${order.brand} ${order.model}`.trim().replace(/\s+/g, '_');
                                        router.push(`/${slug}/dashboard/suppliers?orderId=${order.id}&vehicleInfo=${vInfo}`);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600/10 text-emerald-600 border border-emerald-600/20 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-emerald-600 hover:text-white transition-all animate-in zoom-in"
                                >
                                    <Truck size={16} /> Consultar Repuestos
                                </button>
                            )}
                            {newStatus === 'Entregado' && hasPermission('recordatorios') && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Recordar en...</label>
                                    <select
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
                                        value={reminderDays}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setReminderDays(val);
                                            // Auto-save only if already delivered
                                            if (order.status === 'Entregado') {
                                                (async () => {
                                                    try {
                                                        await api.put(`/orders/${order.id}/status`, {
                                                            status: 'Entregado',
                                                            notes: val ? `Seguimiento reprogramado (${val} días)` : 'Recordatorio eliminado',
                                                            reminder_days: val || null
                                                        });
                                                        fetchOrder();
                                                    } catch (err) {
                                                        notify('error', 'Error al guardar recordatorio');
                                                    }
                                                })();
                                            }
                                        }}
                                    >
                                        <option value="" className="text-slate-900">Sin recordatorio</option>
                                        <option value="1" className="text-slate-900">1 día</option>
                                        <option value="15" className="text-slate-900">15 días</option>
                                        <option value="30" className="text-slate-900">1 mes</option>
                                        <option value="60" className="text-slate-900">2 meses</option>
                                        <option value="90" className="text-slate-900">3 meses</option>
                                        <option value="120" className="text-slate-900">4 meses</option>
                                        <option value="150" className="text-slate-900">5 meses</option>
                                        <option value="180" className="text-slate-900">6 meses</option>
                                        <option value="210" className="text-slate-900">7 meses</option>
                                        <option value="240" className="text-slate-900">8 meses</option>
                                        <option value="270" className="text-slate-900">9 meses</option>
                                        <option value="300" className="text-slate-900">10 meses</option>
                                        <option value="330" className="text-slate-900">11 meses</option>
                                        <option value="365" className="text-slate-900">1 año</option>
                                        <option value="730" className="text-slate-900">2 años</option>
                                        <option value="1095" className="text-slate-900">3 años</option>
                                        <option value="1460" className="text-slate-900">4 años</option>
                                        <option value="1825" className="text-slate-900">5 años</option>
                                    </select>
                                </div>
                            )}

                            {newStatus === 'Turno asignado' && config?.enabled_modules?.includes('turnos') && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 bg-white/5 p-4 rounded-xl border border-white/10">
                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <CalendarIcon size={14} /> Asignar Turno al Cliente
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase ml-1">Fecha</span>
                                            <input
                                                type="date"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none"
                                                value={appointmentDate}
                                                onChange={(e) => setAppointmentDate(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase ml-1">Hora</span>
                                            <select
                                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none"
                                                value={appointmentTime}
                                                onChange={(e) => setAppointmentTime(e.target.value)}
                                            >
                                                <option value="">Seleccionar hora</option>
                                                {getTimeSlots(appointmentDate).map(slot => (
                                                    <option key={slot} value={slot}>{slot} hs</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 font-medium">Al guardar, se le notificará al cliente automáticamente si la plantilla está activa.</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notas del Cambio</label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/50 h-24 resize-none placeholder:text-white/20"
                                    placeholder="Ej: Repuestos recibidos, iniciando desarme..."
                                    value={statusNotes}
                                    onChange={(e) => setStatusNotes(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={handleStatusUpdate}
                                disabled={updating || (() => {
                                    const hasStatusChanged = newStatus !== order.status;
                                    const hasNotesChanged = !!statusNotes;
                                    let hasAppointmentChanged = false;
                                    if (newStatus === 'Turno asignado') {
                                        const currentD = order.appointment_date ? (order.appointment_date.includes('T') ? order.appointment_date : order.appointment_date.replace(' ', 'T')).split('T')[0] : '';
                                        const currentT = order.appointment_date ? (order.appointment_date.includes('T') ? order.appointment_date : order.appointment_date.replace(' ', 'T')).split('T')[1].substring(0, 5) : '';
                                        hasAppointmentChanged = appointmentDate !== currentD || appointmentTime !== currentT;
                                    }
                                    return !hasStatusChanged && !hasNotesChanged && !hasAppointmentChanged;
                                })()}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
                            >
                                {updating ? 'Actualizando...' : 'Actualizar Estado'}
                            </button>
                        </div>
                    </div>

                    {/* Payment Panel - visible only to users with income permission */}
                    {canSeeIncome && (
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-500">
                                    <CircleDollarSign size={20} />
                                </div>
                                <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Cobro</h3>
                            </div>

                            {/* Current payment status badge */}
                            <div className="mb-5">
                                {order.payment_status === 'cobrado' && (
                                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl">
                                        <CheckCircle2 size={16} />
                                        <span className="font-black text-xs uppercase tracking-widest">Cobrado completo</span>
                                        <span className="ml-auto font-black">${Number(order.payment_amount || 0).toLocaleString('es-AR')}</span>
                                    </div>
                                )}
                                {order.payment_status === 'parcial' && (
                                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-xl">
                                        <CircleDollarSign size={16} />
                                        <span className="font-black text-xs uppercase tracking-widest">Cobro parcial</span>
                                        <span className="ml-auto font-black">${Number(order.payment_amount || 0).toLocaleString('es-AR')}</span>
                                    </div>
                                )}
                                {(!order.payment_status || order.payment_status === 'sin_cobrar') && (
                                    <div className="flex items-center gap-2 text-red-500 bg-red-50 px-4 py-2 rounded-xl">
                                        <CircleSlash size={16} />
                                        <span className="font-black text-xs uppercase tracking-widest">Sin cobrar</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado de cobro</label>
                                    <select
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                        value={paymentStatus}
                                        onChange={(e) => {
                                            setPaymentStatus(e.target.value);
                                            if (e.target.value === 'cobrado') setPaymentAmount(totalOrder);
                                            if (e.target.value === 'sin_cobrar') setPaymentAmount(0);
                                        }}
                                    >
                                        <option value="cobrado">✅ Cobrado completo</option>
                                        <option value="parcial">💛 Cobro parcial</option>
                                        <option value="sin_cobrar">❌ Sin cobrar</option>
                                    </select>
                                </div>

                                {paymentStatus !== 'sin_cobrar' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            Monto cobrado <span className="text-slate-300">(total: ${totalOrder.toLocaleString('es-AR')})</span>
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={handlePaymentUpdate}
                                    disabled={savingPayment}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
                                >
                                    {savingPayment ? 'Guardando...' : 'Guardar Cobro'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Customer Info */}
                    <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm p-8 space-y-8">
                        <section className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-slate-50 p-2.5 rounded-xl text-slate-400">
                                    <User size={18} />
                                </div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Datos del Cliente</h4>
                            </div>
                            <div>
                                <h5 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">{order.client_name}</h5>
                                <a
                                    href={`https://wa.me/${order.client_phone?.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 font-bold text-sm block hover:text-emerald-700 transition-colors"
                                >
                                    {order.client_phone}
                                </a>
                                <a
                                    href={`mailto:${order.client_email}`}
                                    className="text-slate-500 text-xs font-bold block hover:text-blue-600 transition-colors"
                                >
                                    {order.client_email}
                                </a>
                            </div>
                        </section>

                        <div className="h-px bg-slate-50"></div>

                        <section className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-slate-50 p-2.5 rounded-xl text-slate-400">
                                    <Car size={18} />
                                </div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehículo</h4>
                            </div>
                            <div className="flex items-center gap-4">
                                {order.image_path ? (
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-100 flex-shrink-0">
                                        <img src={`http://localhost:5000${order.image_path}`} alt="" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 flex-shrink-0 border border-slate-100 italic font-black text-[10px]">
                                        SIN FOTO
                                    </div>
                                )}
                                <div>
                                    <h5 className="text-lg font-black text-slate-900 uppercase italic tracking-tight leading-tight">{order.brand} {order.model}</h5>
                                    <Link
                                        href={`/${slug}/dashboard/vehicles/${order.vehicle_id}`}
                                        className="text-blue-600 font-black font-mono tracking-widest text-sm bg-blue-50 hover:bg-blue-600 hover:text-white px-3 py-1 rounded-lg inline-block mt-1 transition-all"
                                    >
                                        {order.plate}
                                    </Link>
                                    <p className="text-slate-500 text-[10px] font-black mt-2 uppercase tracking-widest">Año: {order.year || '---'}</p>
                                </div>
                            </div>

                            <Link
                                href={`/${slug}/dashboard/vehicles/${order.vehicle_id}`}
                                className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors mt-2"
                            >
                                Ver historial completo <ArrowRight size={12} />
                            </Link>
                        </section>
                    </div>

                    {/* Quick Stats Panel */}
                    <div className="bg-blue-600 rounded-[40px] p-8 text-white">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Presupuesto Final</p>
                                <h4 className="text-3xl font-black italic tracking-tighter">${totalOrder.toLocaleString()}</h4>
                            </div>
                            <div className="bg-white/20 p-3 rounded-2xl">
                                <DollarSign size={24} />
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-blue-200/60 uppercase tracking-widest mt-6">Sujeto a cambios del taller</p>
                    </div>
                </div>
            </div>

            {/* Modal Add Items */}
            {
                showItemsModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-10">
                            <div className="flex justify-between items-center mb-10">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Agregar Items</h3>
                                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Ampliación de Orden #{order.id}</p>
                                </div>
                                <button onClick={() => setShowItemsModal(false)} className="text-slate-400 hover:text-slate-900">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-8">
                                {newItems.map((item, index) => (
                                    <div key={index} className="bg-slate-50 p-6 rounded-3xl space-y-4 relative">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Servicio Catálogo</label>
                                                <select
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white font-bold text-sm"
                                                    onChange={(e) => updateItem(index, 'service_id', e.target.value)}
                                                >
                                                    <option value="">-- Personalizado --</option>
                                                    {catalog.map(s => <option key={s.id} value={s.id}>{s.name} - ${s.base_price}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Descripción</label>
                                                <input
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white font-bold text-sm"
                                                    value={item.description}
                                                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Mano de Obra</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white font-bold text-sm"
                                                    value={item.labor_price}
                                                    onChange={(e) => updateItem(index, 'labor_price', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Repuestos</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white font-bold text-sm"
                                                    value={item.parts_price}
                                                    onChange={(e) => updateItem(index, 'parts_price', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 italic">Ganancia Interna ($)</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-4 py-3 rounded-xl border border-dashed border-slate-200 bg-slate-100 font-bold text-sm text-slate-500"
                                                    value={item.parts_profit}
                                                    onChange={(e) => updateItem(index, 'parts_profit', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        {newItems.length > 1 && (
                                            <button
                                                onClick={() => setNewItems(newItems.filter((_, i) => i !== index))}
                                                className="absolute -top-3 -right-3 bg-red-100 text-red-500 p-2 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                <button
                                    onClick={() => setNewItems([...newItems, { description: '', labor_price: '0', parts_price: '0', parts_profit: '0', service_id: null }])}
                                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-blue-400 hover:text-blue-600 transition-all"
                                >
                                    + Agregar otro Item
                                </button>

                                <button
                                    onClick={handleAddItems}
                                    className="w-full bg-slate-900 text-white font-black py-5 rounded-[24px] shadow-2xl transition-all uppercase tracking-[0.2em] text-xs hover:bg-blue-600"
                                >
                                    Confirmar y Ampliar Orden
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

