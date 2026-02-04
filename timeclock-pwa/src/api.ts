const API_BASE = '/api/timeclock';

export const login = async (phone: string, pin: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin })
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Login failed');
    }
    return res.json();
};

export const syncEvents = async (events: any[], token: string) => {
    const res = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ events })
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Sync failed');
    }
    return res.json();
}

export const getConfig = async (token: string) => {
    // Add timestamp to prevent SW caching
    const res = await fetch(`${API_BASE}/config?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Config failed');
    return res.json();
}
