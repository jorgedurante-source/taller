import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api';

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

superApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (typeof window !== 'undefined' && error.response?.status === 401 && !window.location.pathname.includes('/login')) {
            localStorage.removeItem('super_token');
            window.location.href = '/superadmin/login';
        }
        return Promise.reject(error);
    }
);

/**
 * Default API instance — reads slug from localStorage.
 * Used by pages that are already inside a [slug] context.
 */
const api = axios.create({
    baseURL: BASE,
});

api.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    let slug = typeof window !== 'undefined' ? localStorage.getItem('current_slug') : null;

    // Proactively detect slug from URL if we're in a tenant context
    if (typeof window !== 'undefined') {
        const pathParts = window.location.pathname.split('/');
        if (pathParts[1] && pathParts[1] !== 'superadmin' && pathParts[1] !== 'api') {
            slug = pathParts[1];
            // Also sync it back to localStorage for other parts of the app
            localStorage.setItem('current_slug', slug);
        }
    }

    if (token) config.headers.Authorization = `Bearer ${token}`;

    if (slug && config.url && !config.url.startsWith('/super')) {
        config.baseURL = `${BASE}/${slug}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (typeof window !== 'undefined' && error.response?.status === 401 && !window.location.pathname.includes('/login')) {
            const slug = localStorage.getItem('current_slug') || 'demo';
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = `/${slug}/login`;
        }
        return Promise.reject(error);
    }
);

/**
 * Client API instance — separate from admin.
 * Uses `client_token`.
 */
export const clientApi = axios.create({
    baseURL: BASE,
});

clientApi.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('client_token') : null;
    let slug = typeof window !== 'undefined' ? localStorage.getItem('current_slug') : null;

    if (typeof window !== 'undefined') {
        const pathParts = window.location.pathname.split('/');
        if (pathParts[1] && pathParts[1] !== 'superadmin' && pathParts[1] !== 'api') {
            slug = pathParts[1];
            localStorage.setItem('current_slug', slug);
        }
    }

    if (token) config.headers.Authorization = `Bearer ${token}`;

    if (slug && config.url && !config.url.startsWith('/super')) {
        config.baseURL = `${BASE}/${slug}`;
    }

    return config;
});

clientApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (typeof window !== 'undefined' && error.response?.status === 401 && !window.location.pathname.includes('/login')) {
            const slug = localStorage.getItem('current_slug') || 'demo';
            localStorage.removeItem('client_token');
            localStorage.removeItem('client_user');
            window.location.href = `/${slug}/client/login`;
        }
        return Promise.reject(error);
    }
);

export default api;

/**
 * Chain (multi-tenant group) API — hits /api/chain/...
 */
export const chainApi = axios.create({
    baseURL: `${BASE}/chain`,
});

chainApi.interceptors.request.use((config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('chain_token') : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

chainApi.interceptors.response.use(
    (response) => response,
    (error) => {
        if (typeof window !== 'undefined' && error.response?.status === 401) {
            localStorage.removeItem('chain_token');
            localStorage.removeItem('chain_user');
            const slug = localStorage.getItem('chain_slug');
            if (slug) window.location.href = `/chain/${slug}/login`;
        }
        return Promise.reject(error);
    }
);

