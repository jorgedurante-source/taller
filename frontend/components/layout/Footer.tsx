'use client';

import React, { useEffect, useState } from 'react';
import { useConfig } from '@/lib/config';
import { useTranslation } from '@/lib/i18n';

const Footer = () => {
    const [year, setYear] = useState<number | null>(null);
    const { config } = useConfig();
    const { t } = useTranslation();

    useEffect(() => {
        setYear(new Date().getFullYear());
    }, []);

    return (
        <footer className="w-full py-8 px-4 border-t border-slate-200 bg-white text-center">
            <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-2">
                    <img
                        src="/images/surforge_logo.jpg"
                        alt="SurForge Logo"
                        className="h-16 w-auto object-contain"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=SurForge';
                        }}
                    />
                    <span className="text-xl font-bold text-slate-800 tracking-tight">SurForge</span>
                </div>
                <div className="flex flex-col items-center gap-1 text-sm text-slate-500">
                    <p className="font-medium italic text-slate-400">Powered by SurForge</p>
                    <p>© {year || '...'} {config.product_name}. {t('rights_reserved')}</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
