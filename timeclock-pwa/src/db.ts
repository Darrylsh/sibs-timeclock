import { openDB, type DBSchema } from 'idb';

interface TimeclockDB extends DBSchema {
    events: {
        key: number;
        value: {
            id?: number;
            employee_id: number;
            work_code_id: number | null;
            event_type: string;
            device_gps_time: string;
            gps_lat: number | null;
            gps_long: number | null;
            timestamp: number; // For local sorting
        };
    };
    config: {
        key: string;
        value: any;
    };
}

const DB_NAME = 'timeclock-db';

export const dbPromise = openDB<TimeclockDB>(DB_NAME, 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('events')) {
            db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('config')) {
            db.createObjectStore('config');
        }
    },
});

export const saveEventOffline = async (event: Omit<TimeclockDB['events']['value'], 'timestamp'>) => {
    const db = await dbPromise;
    await db.add('events', { ...event, timestamp: Date.now() });
};

export const getOfflineEvents = async () => {
    const db = await dbPromise;
    return db.getAll('events');
};

export const clearOfflineEvents = async (keys: number[]) => {
    const db = await dbPromise;
    const tx = db.transaction('events', 'readwrite');
    await Promise.all(keys.map(key => tx.store.delete(key)));
    await tx.done;
};

export const saveConfig = async (key: string, value: any) => {
    const db = await dbPromise;
    await db.put('config', value, key);
};

export const getConfig = async (key: string) => {
    const db = await dbPromise;
    return db.get('config', key);
};
