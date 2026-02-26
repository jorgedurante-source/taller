'use client';

import React, { useEffect, createContext, useContext, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { useConfig } from './config';
import { useAuth } from './auth';
import InactiveSite from '@/components/layout/InactiveSite';
import MaintenanceMode from '@/components/layout/MaintenanceMode';

export const THEMES = [
    {
        id: 'default',
        name: 'Pearl',
        description: 'Limpio y profesional',
        emoji: '⚪',
        preview: { bg: '#f8fafc', surface: '#ffffff', accent: '#2563eb', sidebar: '#0f172a', text: '#0f172a' }
    },
    {
        id: 'obsidian',
        name: 'Obsidian',
        description: 'Oscuro y elegante',
        emoji: '⚫',
        preview: { bg: '#0d0d0d', surface: '#1a1a1a', accent: '#3b82f6', sidebar: '#111111', text: '#f1f5f9' }
    },
    {
        id: 'ocean',
        name: 'Ocean',
        description: 'Azul profundo, marino',
        emoji: '🌊',
        preview: { bg: '#0a1628', surface: '#0f2040', accent: '#06b6d4', sidebar: '#071020', text: '#e2f0ff' }
    },
    {
        id: 'sunset',
        name: 'Sunset',
        description: 'Cálido y vibrante',
        emoji: '🌅',
        preview: { bg: '#fffbf5', surface: '#ffffff', accent: '#ea580c', sidebar: '#1c0f00', text: '#1c0f00' }
    },
    {
        id: 'forest',
        name: 'Forest',
        description: 'Verde profundo, oscuro',
        emoji: '🌲',
        preview: { bg: '#061a0e', surface: '#0d2b18', accent: '#10b981', sidebar: '#04110a', text: '#d1fae5' }
    },
    {
        id: 'lavender',
        name: 'Lavender',
        description: 'Suave y creativo',
        emoji: '💜',
        preview: { bg: '#f5f3ff', surface: '#ffffff', accent: '#7c3aed', sidebar: '#1e1b4b', text: '#1e1b4b' }
    },
    {
        id: 'slate',
        name: 'Slate Pro',
        description: 'Corporativo y moderno',
        emoji: '🔷',
        preview: { bg: '#f1f5f9', surface: '#ffffff', accent: '#0ea5e9', sidebar: '#1e293b', text: '#1e293b' }
    },
];

export function applyTheme(themeId: string) {
    if (typeof window === 'undefined') return;
    const html = document.documentElement;
    if (themeId === 'default') {
        html.removeAttribute('data-theme');
    } else {
        html.setAttribute('data-theme', themeId);
    }
}

export function getStoredTheme(): string {
    if (typeof window === 'undefined') return 'default';
    return localStorage.getItem('mechub-theme') || 'default';
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const slug = params?.slug as string;
    const [inactiveData, setInactiveData] = useState<{ active: boolean; details?: string }>({ active: false });

    const { config } = useConfig();
    const { user } = useAuth();
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

    useEffect(() => {
        const loadTheme = async () => {
            const isSuperAdmin = pathname.startsWith('/superadmin');

            if (isSuperAdmin) {
                const stored = localStorage.getItem('mechub-super-theme');
                // Priority: Config from DB (if not default) -> LocalStorage -> Config from DB (even if default) -> 'default' fallback
                let theme = 'default';
                if (config.superadmin_theme && config.superadmin_theme !== 'default') {
                    theme = config.superadmin_theme;
                } else if (stored) {
                    theme = stored;
                } else if (config.superadmin_theme) {
                    theme = config.superadmin_theme;
                }

                applyTheme(theme);

                // If it changed, keep localStorage in sync
                if (theme !== stored) {
                    localStorage.setItem('mechub-super-theme', theme);
                }
                return;
            }

            // If we are in a tenant context, fetch its config for the theme
            if (slug) {
                try {
                    // We use axios directly to avoid circular dependency with api.ts if any
                    const res = await axios.get(`http://localhost:5000/api/${slug}/config`);
                    if (res.data?.theme_id) {
                        applyTheme(res.data.theme_id);
                        return;
                    }
                } catch (err) {
                    const error = err as any;
                    // Handle deactivation (403 from tenant middleware)
                    if (error?.response?.status === 403 && error?.response?.data?.status === 'inactive') {
                        setInactiveData({ active: true, details: error.response.data.details });
                        return;
                    }

                    // If the tenant does not exist (404) or any other error, fallback to stored theme
                    if (error?.response?.status === 404) {
                        console.warn(`Tenant config not found for slug '${slug}'. Using default theme.`);
                    } else {
                        console.error('Failed to fetch tenant theme:', err);
                    }
                }
            }

            // Fallback to localStorage for unknown/non-tenant paths
            const stored = localStorage.getItem('mechub-theme') || 'default';
            applyTheme(stored);
        };

        loadTheme();
    }, [slug, config.superadmin_theme, pathname]);

    // Global Maintenance Mode Guard
    const isSuperAdminPath = pathname.startsWith('/superadmin');
    if (config.maintenance_mode === 'true' && !user?.isSuperuser && !isSuperAdminPath) {
        return <MaintenanceMode supportEmail={config.support_email} productName={config.product_name} />;
    }

    if (inactiveData.active) {
        return <InactiveSite slug={slug} details={inactiveData.details} />;
    }

    return <>{children}</>;
}
