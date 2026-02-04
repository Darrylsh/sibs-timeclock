const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cayman_payroll_cloud_secret';

const authSchema = z.object({
    phone: z.string().min(10),
    pin: z.string().min(4)
});

router.post('/login', async (req, res) => {
    try {
        const { phone, pin } = authSchema.parse(req.body);
        const result = await db.query('SELECT * FROM timeclock_users WHERE phone = ? AND is_active = TRUE'.replace(/\?/g, '$1'), [phone]); // Adapting for PG syntax later if needed, but db driver usually handles $1
        // Actually, Node PG uses $1, $2. My existing code used ? because of SQLite legacy or specific driver wrapper?
        // Wait, the project migrated to Postgres. The `server/db.js` helper converts ? to $n.
        // For this Cloud Server using `pg` directly, I should use $n syntax natively.

        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const validPin = await bcrypt.compare(pin, user.pin_hash);
        if (!validPin) return res.status(401).json({ error: 'Invalid credentials' });

        // Fetch Employee Context
        let employee = null;
        if (user.employee_id) {
            const empRes = await db.query('SELECT first_name, last_name, company_id FROM employees WHERE id = $1', [user.employee_id]);
            employee = empRes.rows[0];
        }

        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role, employee_id: user.employee_id, app: 'timeclock' },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({ token, user: { ...user, employee } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
