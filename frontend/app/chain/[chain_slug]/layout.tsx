'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { chainApi } from '@/lib/api';

export default function ChainLayout({ children }: { children: React.ReactNode }) {
    const { chain_slug } = useParams<{ chain_slug: string }>();
    const router = useRouter();
    const pathname = usePathname();
    const [chainData, setChainData] = useState<any>(null);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('chain_user');
        if (!storedUser && !pathname.includes('/login')) {
            router.push(`/chain/${chain_slug}/login`);
            return;
        }
        if (storedUser) setUser(JSON.parse(storedUser));

        chainApi.get('/me').then(res => setChainData(res.data)).catch(() => {
            if (!pathname.includes('/login')) router.push(`/chain/${chain_slug}/login`);
        });
    }, [chain_slug]);

    if (pathname.includes('/login')) return <>{children}</>;
    if (!chainData) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
    );

    const nav = [
        { href: `/chain/${chain_slug}/dashboard`, label: 'Dashboard' },
        { href: `/chain/${chain_slug}/dashboard/orders`, label: 'Órdenes' },
        { href: `/chain/${chain_slug}/dashboard/clients`, label: 'Clientes' },
        { href: `/chain/${chain_slug}/dashboard/reports`, label: 'Reportes' },
    ];

    return (
        <div className="min-h-screen bg-slate-50">
            <nav className="bg-slate-900 text-white px-8 py-4 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="font-black uppercase italic tracking-tight text-lg">{chainData.chain?.name}</h1>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Panel de Cadena</p>
                    </div>
                    <div className="hidden md:flex items-center gap-1 bg-slate-800 p-1 rounded-2xl">
                        {nav.map(n => (
                            <Link key={n.href} href={n.href}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${pathname === n.href ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                                {n.label}
                            </Link>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        {chainData.workshops?.map((w: any) => (
                            <span key={w.slug} className="text-[9px] font-black bg-slate-800 px-2 py-1 rounded-lg text-slate-400 uppercase">
                                {w.name}
                            </span>
                        ))}
                    </div>
                    <button
                        onClick={() => { localStorage.removeItem('chain_token'); localStorage.removeItem('chain_user'); router.push(`/chain/${chain_slug}/login`); }}
                        className="text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                    >
                        Salir
                    </button>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto p-8">{children}</main>
        </div>
    );
}
