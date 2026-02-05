const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const configRoutes = require('./routes/config');
const syncRoutes = require('./routes/sync'); // LAN Polling

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Routes
app.use('/api/timeclock/auth', authRoutes);
app.use('/api/timeclock/events', eventRoutes);
app.use('/api/timeclock/config', configRoutes);
app.use('/api/timeclock/sync', syncRoutes);

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => {
    console.log(`Cloud Server running on port ${PORT}`);
});
