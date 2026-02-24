'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
    id: string;
    message: string;
    type: NotificationType;
}

interface NotificationContextType {
    notify: (type: NotificationType, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const removeNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const notify = useCallback((type: NotificationType = 'success', message: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setNotifications((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            removeNotification(id);
        }, 4000);
    }, [removeNotification]);

    return (
        <NotificationContext.Provider value={{ notify }}>
            {children}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4">
                {notifications.map((n) => (
                    <div
                        key={n.id}
                        className={`pointer-events-auto flex items-center justify-between gap-4 px-5 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-8 duration-500 fill-mode-forwards ${n.type === 'success'
                            ? 'bg-emerald-500/90 border-emerald-400 text-white'
                            : n.type === 'error'
                                ? 'bg-rose-500/90 border-rose-400 text-white'
                                : n.type === 'warning'
                                    ? 'bg-amber-500/90 border-amber-400 text-white'
                                    : 'bg-slate-800/90 border-slate-700 text-white'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            {n.type === 'success' && <CheckCircle size={20} className="shrink-0" />}
                            {n.type === 'error' && <AlertCircle size={20} className="shrink-0" />}
                            {n.type === 'info' && <Info size={20} className="shrink-0" />}
                            <p className="font-bold text-sm leading-tight tracking-tight">{n.message}</p>
                        </div>
                        <button
                            onClick={() => removeNotification(n.id)}
                            className="shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
}
