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
    const { companies, employees, work_codes, timeclock_users } = req.body;
    const results = { companies: 0, employees: 0, work_codes: 0, timeclock_users: 0 };

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Upsert Companies FIRST (employees have FK to companies)
        if (companies && companies.length > 0) {
            for (const co of companies) {
                await client.query(`
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
                await client.query(`
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
                await client.query(`
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

        // Upsert Timeclock Users (Login Accounts)
        if (timeclock_users && timeclock_users.length > 0) {
            for (const u of timeclock_users) {
                const role = (u.role === 'admin' || u.role === 'user') ? u.role : 'user';
                await client.query(`
                    INSERT INTO timeclock_users (id, phone, pin_hash, role, employee_id, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (id) DO UPDATE SET
                        phone = EXCLUDED.phone,
                        pin_hash = EXCLUDED.pin_hash,
                        role = EXCLUDED.role,
                        employee_id = EXCLUDED.employee_id,
                        is_active = EXCLUDED.is_active
                `, [u.id, u.phone, u.pin_hash, role, u.employee_id, u.is_active]);
                results.timeclock_users++;
            }
        }

        await client.query('COMMIT');
        console.log(`[Sync] Transaction complete. Imported ${results.companies} cos, ${results.employees} emps, ${results.work_codes} codes, ${results.timeclock_users} users`);
        res.json({ success: true, ...results });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[Sync] Import error (rolled back):', e.message);
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});


module.exports = router;
