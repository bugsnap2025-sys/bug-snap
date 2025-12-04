require('dotenv').config();
const express = require('express');
const cors = require('cors');
const proxyRouter = require('./routes/proxy');
const reportsRouter = require('./routes/reports');
const scheduledReportsService = require('./services/scheduledReports');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/proxy', proxyRouter);
app.use('/api/reports', reportsRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize scheduled reports
scheduledReportsService.init();

// Start server
app.listen(PORT, () => {
    console.log(`🚀 BugSnap Backend running on port ${PORT}`);
    console.log(`📡 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});
