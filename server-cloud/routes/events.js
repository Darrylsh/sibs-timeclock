const express = require('express');
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cayman_payroll_cloud_secret';

// Middleware
const authenticate = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

const eventSchema = z.array(z.object({
    employee_id: z.number(),
    work_code_id: z.number().nullable(),
    event_type: z.string(),
    device_gps_time: z.string(),
    gps_lat: z.number().nullable().optional(),
    gps_long: z.number().nullable().optional(),
    notes: z.string().nullable().optional()
}));

router.post('/', authenticate, async (req, res) => {
    try {
        const events = eventSchema.parse(req.body.events);
        const results = [];

        for (const event of events) {
            // Security Check
            if (req.user.employee_id && event.employee_id !== req.user.employee_id && req.user.role !== 'admin') {
                continue;
            }

            const dbWorkCodeId = event.work_code_id ?? null; // Keep 0 as valid (Regular Hours)

            await db.query(`
                INSERT INTO time_events 
                (employee_id, work_code_id, event_type, server_time, device_gps_time, gps_lat, gps_long, is_synced_to_lan, notes)
                VALUES ($1, $2, $3, NOW(), $4, $5, $6, FALSE, $7)
            `, [event.employee_id, dbWorkCodeId, event.event_type, event.device_gps_time, event.gps_lat, event.gps_long, event.notes ?? null]);

            results.push({ success: true });
        }


        res.json({ success: true, count: results.length });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
