import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
    }).format(amount);
}

export function formatDate(dateString: string) {
    if (!dateString) return '-';

    let date;
    if (dateString.includes(' ') || dateString.includes('T')) {
        date = new Date(dateString.replace(' ', 'T'));
    } else {
        date = new Date(`${dateString}T00:00:00`);
    }

    if (isNaN(date.getTime())) return '-';

    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}
