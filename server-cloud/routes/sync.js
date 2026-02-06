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

// 3. Import Config (LAN pushes Companies/Employees/Work Codes)
router.post('/import', requireSecret, async (req, res) => {
    const { companies, employees, work_codes } = req.body;
    const results = { companies: 0, employees: 0, work_codes: 0 };

    try {
        // Upsert Companies FIRST (employees have FK to companies)
        if (companies && companies.length > 0) {
            for (const co of companies) {
                await db.query(`
                    INSERT INTO companies (id, name)
                    VALUES ($1, $2)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name
                `, [co.id, co.name]);
                results.companies++;
            }
        }

        // Upsert Employees (LAN is source of truth)
        if (employees && employees.length > 0) {
            for (const emp of employees) {
                await db.query(`
                    INSERT INTO employees (id, first_name, last_name, company_id)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id) DO UPDATE SET
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        company_id = EXCLUDED.company_id
                `, [emp.id, emp.first_name, emp.last_name, emp.company_id]);
                results.employees++;
            }
        }

        // Upsert Work Codes
        if (work_codes && work_codes.length > 0) {
            for (const wc of work_codes) {
                await db.query(`
                    INSERT INTO work_codes (id, code, description, is_selectable)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id) DO UPDATE SET
                        code = EXCLUDED.code,
                        description = EXCLUDED.description,
                        is_selectable = EXCLUDED.is_selectable
                `, [wc.id, wc.code, wc.description, wc.is_selectable]);
                results.work_codes++;
            }
        }

        console.log(`[Sync] Imported ${results.companies} companies, ${results.employees} employees, ${results.work_codes} work codes`);
        res.json({ success: true, ...results });

    } catch (e) {
        console.error('[Sync] Import error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
