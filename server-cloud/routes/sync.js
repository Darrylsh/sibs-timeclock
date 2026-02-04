const express = require('express');
const db = require('../db');

const router = express.Router();

// Middleware: Require Sync Secret
const requireSecret = (req, res, next) => {
    const secret = req.headers['x-sync-secret'];
    if (secret !== process.env.SYNC_SECRET) {
        return res.status(403).json({ error: 'Invalid Sync Secret' });
    }
    next();
};

// 1. Export New Events (LAN calls this)
router.get('/export', requireSecret, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM time_events 
            WHERE is_synced_to_lan = FALSE 
            ORDER BY server_time ASC 
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Acknowledge Sync (LAN calls this after successful insert)
router.post('/ack', requireSecret, async (req, res) => {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.json({ success: true });

    try {
        // Postgres ANY($1) syntax for array
        await db.query(`UPDATE time_events SET is_synced_to_lan = TRUE WHERE id = ANY($1)`, [ids]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Import Config (LAN pushes Users/Employees/Codes)
router.post('/import', requireSecret, async (req, res) => {
    // This is complex. We need to upsert data from LAN.
    // For now, let's just stub it or handle simple table replacements?
    // Replacement is dangerous if IDs change.
    // Upsert is safer.
    // Let's assume LAN sends "Updates".
    // For Phase 1, we might manually sync the DB, but having the endpoint is good.
    res.json({ message: "Config sync not yet fully implemented" });
});

module.exports = router;
