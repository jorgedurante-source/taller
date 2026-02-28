'use client';

import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { Search } from 'lucide-react';

interface VehicleRef {
    id: number;
    brand: string;
    model: string;
    version: string | null;
}

interface Props {
    label: string;
    value: string;
    onChange: (val: string) => void;
    type: 'brand' | 'model' | 'version';
    filters?: {
        brand?: string;
        model?: string;
    };
    placeholder?: string;
    required?: boolean;
}

export default function VehicleAutocomplete({ label, value, onChange, type, filters, placeholder, required }: Props) {
    const [suggestions, setSuggestions] = useState<VehicleRef[]>([]);
    const [filtered, setFiltered] = useState<string[]>([]);
    const [show, setShow] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchRefs = async () => {
            try {
                const res = await api.get('/clients/vehicle-reference');
                setSuggestions(res.data);
            } catch (err) {
                console.error('Error fetching vehicle refs', err);
            }
        };
        fetchRefs();
    }, []);

    useEffect(() => {
        if (!value) {
            setFiltered([]);
            return;
        }

        let list = suggestions;

        if (type === 'brand') {
            const brands = Array.from(new Set(list.map(s => s.brand.toUpperCase())));
            setFiltered(brands.filter(b => b.includes(value.toUpperCase())));
        } else if (type === 'model') {
            if (filters?.brand) {
                list = list.filter(s => s.brand.toUpperCase() === filters.brand?.toUpperCase());
            }
            const models = Array.from(new Set(list.map(s => s.model.toUpperCase())));
            setFiltered(models.filter(m => m.includes(value.toUpperCase())));
        } else if (type === 'version') {
            if (filters?.brand) {
                list = list.filter(s => s.brand.toUpperCase() === filters.brand?.toUpperCase());
            }
            if (filters?.model) {
                list = list.filter(s => s.model.toUpperCase() === filters.model?.toUpperCase());
            }
            const versions = Array.from(new Set(list.map(s => s.version?.toUpperCase() || '').filter(v => !!v)));
            setFiltered(versions.filter(v => v.includes(value.toUpperCase())));
        }
    }, [value, suggestions, type, filters]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShow(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
            <div className="relative">
                <input
                    type="text"
                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 uppercase"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value.toUpperCase());
                        setShow(true);
                    }}
                    onFocus={() => setShow(true)}
                    required={required}
                />
                {show && filtered.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-2xl z-[100] max-h-48 overflow-y-auto overflow-x-hidden">
                        {filtered.map((item, idx) => (
                            <div
                                key={idx}
                                className="px-5 py-3 hover:bg-blue-50 cursor-pointer text-sm font-bold text-slate-700 uppercase border-b border-slate-50 last:border-0 transition-colors"
                                onClick={() => {
                                    onChange(item);
                                    setShow(false);
                                }}
                            >
                                {item}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
