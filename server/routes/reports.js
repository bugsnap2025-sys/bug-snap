const express = require('express');
const router = express.Router();

// In-memory storage for reports (temporary, last 7 days)
const reports = [];
const MAX_REPORTS = 1000;
const RETENTION_DAYS = 7;

/**
 * POST /api/reports
 * Store a new bug report
 */
router.post('/', (req, res) => {
    try {
        const report = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            ...req.body
        };

        reports.unshift(report);

        // Cleanup old reports
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        const filtered = reports.filter(r =>
            new Date(r.timestamp) > cutoffDate
        ).slice(0, MAX_REPORTS);

        reports.length = 0;
        reports.push(...filtered);

        console.log(`[Reports] Stored report ${report.id}. Total: ${reports.length}`);
        res.json({ success: true, id: report.id });

    } catch (error) {
        console.error('[Reports Error]', error);
        res.status(500).json({ error: 'Failed to store report' });
    }
});

/**
 * GET /api/reports
 * Get recent reports (for scheduled summaries)
 */
router.get('/', (req, res) => {
    const { since, limit = 100 } = req.query;

    let filtered = reports;

    if (since) {
        const sinceDate = new Date(since);
        filtered = reports.filter(r => new Date(r.timestamp) > sinceDate);
    }

    res.json({
        reports: filtered.slice(0, parseInt(limit)),
        total: filtered.length
    });
});

/**
 * GET /api/reports/schedule
 * Get scheduled reporting configuration
 */
router.get('/schedule', (req, res) => {
    const config = require('../services/scheduledReports').getConfig();
    res.json(config);
});

/**
 * POST /api/reports/schedule
 * Update scheduled reporting configuration
 */
router.post('/schedule', (req, res) => {
    try {
        const scheduledReports = require('../services/scheduledReports');
        scheduledReports.updateConfig(req.body);
        res.json({ success: true });
    } catch (error) {
        console.error('[Schedule Error]', error);
        res.status(500).json({ error: 'Failed to update schedule' });
    }
});

/**
 * POST /api/reports/test
 * Test scheduled report (send immediately)
 */
router.post('/test', async (req, res) => {
    try {
        const scheduledReports = require('../services/scheduledReports');
        await scheduledReports.sendReport();
        res.json({ success: true, message: 'Test report sent' });
    } catch (error) {
        console.error('[Test Report Error]', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
