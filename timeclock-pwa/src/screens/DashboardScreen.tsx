import { useEffect, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { getConfig, syncEvents } from '../api';
import { saveEventOffline, getOfflineEvents, clearOfflineEvents } from '../db';
import { LogOut, Wifi, WifiOff } from 'lucide-react';

// State Machine
type WorkState = 'OFF_DUTY' | 'ON_DUTY_NO_LUNCH' | 'ON_LUNCH' | 'ON_DUTY_LUNCH_TAKEN';

const DashboardScreen = () => {
    const { user, logout, token } = useAuth();
    const [status, setStatus] = useState<WorkState>('OFF_DUTY');
    const [loading, setLoading] = useState(false);
    const [workCodes, setWorkCodes] = useState<any[]>([]);
    const [recentEvents, setRecentEvents] = useState<any[]>([]);
    const [selectedCode, setSelectedCode] = useState<number | null>(0); // Default to REG (0)
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        loadData();
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', () => setIsOnline(false));
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', () => setIsOnline(false));
        };
    }, []);

    const handleOnline = () => {
        setIsOnline(true);
        flushQueue();
    };

    const loadData = async () => {
        if (!token) return;

        // 1. Always load local offline events (Reliable)
        const offlineEvents = await getOfflineEvents();

        // 2. Try to load Server Data
        let serverEvents: any[] = [];
        let fetchedWorkCodes: any[] = [];

        try {
            const serverData = await getConfig(token);

            // Mark server events as synced
            serverEvents = serverData.recent_events.map((e: any) => ({ ...e, is_synced_to_lan: true }));
            fetchedWorkCodes = serverData.work_codes;

            // Cache for offline use
            localStorage.setItem('cached_work_codes', JSON.stringify(fetchedWorkCodes));
            localStorage.setItem('cached_recent_events', JSON.stringify(serverEvents));

        } catch (e) {
            console.warn("Server unreachable, loading from cache...");
            // Fallback to cache
            const cachedCodes = localStorage.getItem('cached_work_codes');
            if (cachedCodes) fetchedWorkCodes = JSON.parse(cachedCodes);

            const cachedEvents = localStorage.getItem('cached_recent_events');
            if (cachedEvents) serverEvents = JSON.parse(cachedEvents);
        }

        setWorkCodes(fetchedWorkCodes);

        // Merge & Sort Events (Ascending - Oldest First)
        const allEvents = [...offlineEvents, ...serverEvents].sort((a, b) => {
            const timeA = new Date(a.server_time || a.timestamp || a.device_gps_time).getTime();
            const timeB = new Date(b.server_time || b.timestamp || b.device_gps_time).getTime();
            return timeA - timeB; // Ascending
        });

        setRecentEvents(allEvents);
        deriveState(allEvents);

        if (fetchedWorkCodes.length > 0 && selectedCode === null) {
            // Default to matching ID=0 (Regular) if exists, else first item
            const regArgs = fetchedWorkCodes.find(wc => wc.id === 0);
            setSelectedCode(regArgs ? 0 : fetchedWorkCodes[0].id);
        }
    };

    const deriveState = (events: any[]) => {
        if (events.length === 0) {
            setStatus('OFF_DUTY');
            return;
        }
        // Events sorted ASC (Oldest -> Newest)
        const last = events[events.length - 1];
        switch (last.event_type) {
            case 'punch_in': setStatus('ON_DUTY_NO_LUNCH'); break;
            case 'lunch_start': setStatus('ON_LUNCH'); break;
            case 'lunch_end': setStatus('ON_DUTY_LUNCH_TAKEN'); break;
            case 'punch_out': setStatus('OFF_DUTY'); break;
        }
        // Special case: If last event was punch_in but followed by lunch_start? 
        // We rely on the single last event to determine state.
        // What if they punched in, then lunch start? The last event is lunch start. State: ON_LUNCH. Correct.
    };

    const flushQueue = async () => {
        const events = await getOfflineEvents();
        if (events.length === 0) return;
        try {
            await syncEvents(events, token!);
            await clearOfflineEvents(events.map(e => e.id!));
            console.log('Synced', events.length, 'events');
            loadData(); // Refresh state from server
        } catch (e) {
            console.error('Sync failed', e);
        }
    };

    const handlePunch = async (type: string) => {
        setLoading(true);

        // 1. Get GPS
        let gps: any = { lat: null, long: null, time: null };
        try {
            const pos: any = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            gps = {
                lat: pos.coords.latitude,
                long: pos.coords.longitude,
                time: new Date(pos.timestamp).toISOString()
            };
        } catch (e) {
            console.warn('GPS failed or timed out', e);
            // Silent Fail: Continue without GPS as requested
        }

        const event = {
            employee_id: user?.employee_id || 0,
            work_code_id: type === 'punch_in' ? Number(selectedCode) : null,
            event_type: type,
            device_gps_time: gps.time || new Date().toISOString(),
            gps_lat: gps.lat,
            gps_long: gps.long
        };
        console.log('Submitting Event:', event);

        // 2. Save Offline
        await saveEventOffline(event);

        // 3. Optimistic UI Update (ALWAYS do this so user sees immediate feedback)
        const optimisticEvent = { ...event, server_time: new Date().toISOString(), is_synced_to_lan: false };
        const newEvents = [...recentEvents, optimisticEvent]; // Append to end for ASC sort
        setRecentEvents(newEvents);
        deriveState(newEvents);

        // 4. Try Sync (Background)
        if (navigator.onLine) {
            flushQueue().catch(e => console.error("Background sync failed", e));
        }

        setLoading(false);
    };

    const hasPendingSync = recentEvents.some(e => e.is_synced_to_lan === false);

    const renderButtons = () => {
        if (loading) return <div className="p-8 text-center text-muted">Processing...</div>;

        switch (status) {
            case 'OFF_DUTY':
                return (
                    <div className="flex flex-col h-full justify-center">
                        <div className="flex-1 flex flex-col justify-end pb-4">
                            <label className="block text-xs uppercase tracking-wider text-muted mb-2 text-center">Work Code</label>
                            <select
                                className="input-glass mb-4 text-center"
                                style={{ fontSize: '1.25rem', padding: '1rem' }}
                                value={selectedCode ?? 0}
                                onChange={e => setSelectedCode(Number(e.target.value))}
                            >
                                {workCodes.map(wc => <option key={wc.id} value={wc.id}>{wc.description}</option>)}
                            </select>
                        </div>
                        <button className="btn btn-primary w-full py-6 text-2xl shadow-lg flex-1 mb-4" onClick={() => handlePunch('punch_in')}>CLOCK IN</button>
                    </div>
                );
            case 'ON_DUTY_NO_LUNCH':
                return (
                    <div className="flex flex-col h-full gap-4 justify-center">
                        <div className="text-center text-success font-medium text-xl py-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">ON DUTY</div>
                        <button className="btn btn-primary w-full py-6 text-xl flex-1" style={{ background: '#f59e0b' }} onClick={() => handlePunch('lunch_start')}>START LUNCH</button>
                        <button className="btn btn-danger w-full py-6 text-xl flex-1" onClick={() => handlePunch('punch_out')}>CLOCK OUT</button>
                    </div>
                );
            case 'ON_LUNCH':
                return (
                    <div className="flex flex-col h-full gap-4 justify-center">
                        <div className="text-center text-warning font-medium text-xl py-4 bg-amber-500/10 rounded-xl border border-amber-500/20">ON LUNCH</div>
                        <button className="btn btn-primary w-full py-6 text-xl flex-1" onClick={() => handlePunch('lunch_end')}>END LUNCH</button>
                    </div>
                );
            case 'ON_DUTY_LUNCH_TAKEN':
                return (
                    <div className="flex flex-col h-full gap-4 justify-center">
                        <div className="text-center text-success font-medium text-xl py-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">ON DUTY (Lunch Taken)</div>
                        <button className="btn btn-danger w-full py-6 text-xl flex-1" onClick={() => handlePunch('punch_out')}>CLOCK OUT</button>
                    </div>
                );
        }
    };

    return (
        <div style={{ height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column', background: 'radial-gradient(circle at top left, #1e1b4b, #0f172a)', overflow: 'hidden' }}>
            {/* Header */}
            <div className="glass p-4 m-4 mb-2 bg-opacity-50 shrink-0 gap-2" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 className="m-0 text-lg font-semibold truncate">{user?.employee?.first_name || 'User'}</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                    {isOnline ? <Wifi size={18} color="var(--success)" /> : <WifiOff size={18} color="var(--danger)" />}

                    {/* Sync Indicator - Middle */}
                    <div
                        onClick={async () => {
                            if (hasPendingSync && confirm("Clear stuck sync queue?")) {
                                const events = await getOfflineEvents();
                                await clearOfflineEvents(events.map(e => e.id!));
                                loadData();
                            }
                        }}
                        style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.5)',
                            backgroundColor: hasPendingSync ? '#ef4444' : '#22c55e', // Red-500 : Green-500
                            boxShadow: hasPendingSync ? '0 0 8px rgba(239,68,68,0.8)' : '0 0 8px rgba(34,197,94,0.8)',
                            cursor: 'pointer'
                        }}
                        className={hasPendingSync ? 'animate-pulse' : ''}
                        title={hasPendingSync ? "Pending Sync (Click to Clear)" : "Synced"}
                    ></div>

                    <button className="btn btn-ghost p-2 rounded-full" onClick={logout}><LogOut size={20} /></button>
                </div>
            </div>

            {/* Main Action Area - Grows to fill space */}
            <div className="glass p-6 m-4 mt-2 mb-2 flex-1 flex flex-col shadow-xl">
                {/* renderButtons now fills this flex container */}
                {renderButtons()}
            </div>

            {/* Compact Activity Log */}
            <div className="glass p-4 m-4 mt-2 h-48 shrink-0 flex flex-col bg-opacity-40">
                <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-1">
                    <h3 className="text-muted text-[10px] uppercase tracking-wider m-0">Recent Activity</h3>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2" ref={(el) => el?.scrollTo(0, el.scrollHeight)}>
                    {recentEvents.map((e, i) => (
                        <div key={i} className="flex justify-between items-center py-1 px-1 border-b border-white/5 last:border-0">
                            <div className="font-medium text-sm text-white/90">
                                {e.event_type.replace(/_/g, ' ').toUpperCase()} - {new Date(e.server_time || e.timestamp || e.device_gps_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    ))}
                    {recentEvents.length === 0 && <div className="text-center text-muted text-xs py-4">No recent activity</div>}
                </div>
            </div>
        </div>
    );
};
export default DashboardScreen;
