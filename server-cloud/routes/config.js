const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cayman_payroll_cloud_secret';

const authenticate = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

router.get('/', authenticate, async (req, res) => {
    try {
        // Get Work Codes based on Company
        const codes = await db.query(`
            SELECT id, code, description FROM work_codes 
            WHERE is_selectable = TRUE
            UNION
            SELECT 0, 'REG', 'Regular Hours'
        `);

        // Use logic similar to original but simpler for now (all codes or filtered by employee->company)
        // Ignoring complicated parent/child logic for MVP Cloud unless schema expects it.

        const recent = await db.query(`
            SELECT * FROM time_events 
            WHERE employee_id = $1 
            AND server_time > NOW() - INTERVAL '24 hours' 
            ORDER BY server_time DESC
        `, [req.user.employee_id]);

        res.json({
            work_codes: codes.rows,
            recent_events: recent.rows
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
