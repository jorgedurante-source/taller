import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Creates an axios instance scoped to a specific tenant slug.
 * All requests go to /api/:slug/...
 */
export function createApi(slug: string) {
    const instance = axios.create({
        baseURL: `${BASE}/${slug}`,
    });

    instance.interceptors.request.use((config) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    return instance;
}

/**
 * Superadmin API — hits /api/super/...
 */
export const superApi = axios.create({
    baseURL: `${BASE}/super`,
});

superApi.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('super_token') : null;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/**
 * Default API instance — reads slug from localStorage.
 * Used by pages that are already inside a [slug] context.
 */
const api = axios.create({
    baseURL: BASE,
});

api.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const slug = typeof window !== 'undefined' ? localStorage.getItem('current_slug') : null;

    if (token) config.headers.Authorization = `Bearer ${token}`;

    if (slug && config.url && !config.url.startsWith('/super')) {
        config.baseURL = `${BASE}/${slug}`;
    }

    return config;
});

/**
 * Client API instance — separate from admin.
 * Uses `client_token`.
 */
export const clientApi = axios.create({
    baseURL: BASE,
});

clientApi.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('client_token') : null;
    const slug = typeof window !== 'undefined' ? localStorage.getItem('current_slug') : null;

    if (token) config.headers.Authorization = `Bearer ${token}`;

    if (slug && config.url && !config.url.startsWith('/super')) {
        config.baseURL = `${BASE}/${slug}`;
    }

    return config;
});

export default api;
