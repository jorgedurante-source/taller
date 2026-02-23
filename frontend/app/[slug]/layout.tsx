'use client';

import { SlugProvider } from "@/lib/slug";

export default function TenantLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SlugProvider>
            {children}
        </SlugProvider>
    );
}
