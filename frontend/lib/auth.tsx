'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    id: number;
    username: string;
    role: string;
    permissions: string[];
    isSuperuser?: boolean;
}

interface AuthContextType {
    user: User | null;
    clientUser: User | null;
    login: (token: string, user: User) => void;
    clientLogin: (token: string, user: User) => void;
    logout: () => void;
    clientLogout: () => void;
    loading: boolean;
    hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [clientUser, setClientUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (storedUser && token) {
            setUser(JSON.parse(storedUser));
        }

        const storedClientUser = localStorage.getItem('client_user');
        const clientToken = localStorage.getItem('client_token');
        if (storedClientUser && clientToken) {
            setClientUser(JSON.parse(storedClientUser));
        }

        setLoading(false);
    }, []);

    const login = (token: string, user: User) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);

        const slug = localStorage.getItem('current_slug') || 'demo';

        if (user.isSuperuser || user.role === 'superuser') {
            router.push('/superadmin/dashboard');
        } else {
            router.push(`/${slug}/dashboard`);
        }
    };

    const clientLogin = (token: string, user: User) => {
        localStorage.setItem('client_token', token);
        localStorage.setItem('client_user', JSON.stringify(user));
        setClientUser(user);

        const slug = localStorage.getItem('current_slug') || 'demo';
        router.push(`/${slug}/client`);
    };

    const logout = () => {
        const slug = localStorage.getItem('current_slug') || 'demo';
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        router.push(`/${slug}/login`);
    };

    const clientLogout = () => {
        const slug = localStorage.getItem('current_slug') || 'demo';
        localStorage.removeItem('client_token');
        localStorage.removeItem('client_user');
        setClientUser(null);
        router.push(`/${slug}/client/login`);
    };

    const hasPermission = (permission: string) => {
        if (!user) return false;
        if (user.isSuperuser) return true;
        return Array.isArray(user.permissions) && user.permissions.includes(permission);
    };

    return (
        <AuthContext.Provider value={{ user, clientUser, login, clientLogin, logout, clientLogout, loading, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
