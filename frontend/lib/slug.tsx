'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';

interface SlugContextType {
    slug: string;
}

const SlugContext = createContext<SlugContextType | undefined>(undefined);

export function SlugProvider({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const slug = params?.slug as string;

    useEffect(() => {
        if (slug) {
            localStorage.setItem('current_slug', slug);
        }
    }, [slug]);

    if (!slug && !pathname.startsWith('/superadmin')) {
        // Fallback for root or invalid paths
        return null;
    }

    return (
        <SlugContext.Provider value={{ slug }}>
            {children}
        </SlugContext.Provider>
    );
}

export function useSlug() {
    const context = useContext(SlugContext);
    if (context === undefined) {
        // If not in a [slug] route, try to get from localStorage
        const saved = typeof window !== 'undefined' ? localStorage.getItem('current_slug') : null;
        return { slug: saved || '' };
    }
    return context;
}
