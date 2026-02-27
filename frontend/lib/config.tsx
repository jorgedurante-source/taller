'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface Config {
    product_name: string;
    maintenance_mode: string;
    allow_new_registrations: string;
    support_email: string;
    superadmin_theme?: string;
    workshops: Array<{ slug: string, name: string, logo_path?: string }>;
    announcements?: Array<{ id: number, title: string, content: string, type: string }>;
}

interface ConfigContextType {
    config: Config;
    loading: boolean;
    refreshConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider = ({ children }: { children: React.ReactNode }) => {
    const [config, setConfig] = useState<Config>({
        product_name: 'MechHub',
        maintenance_mode: 'false',
        allow_new_registrations: 'true',
        support_email: '',
        workshops: []
    });
    const [loading, setLoading] = useState(true);

    const fetchConfig = async () => {
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api';
            const res = await axios.get(`${apiBase}/info`);
            setConfig(res.data);
        } catch (err) {
            console.error('Failed to fetch global config:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    return (
        <ConfigContext.Provider value={{ config, loading, refreshConfig: fetchConfig }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (context === undefined) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
};
