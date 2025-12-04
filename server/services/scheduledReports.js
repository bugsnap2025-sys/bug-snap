const cron = require('node-cron');
const fetch = require('node-fetch');

let config = {
    enabled: false,
    time: '09:00',
    platform: 'Slack',
    daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
    slackWebhook: null,
    teamsWebhook: null
};

let cronJob = null;

/**
 * Initialize scheduled reports
 */
function init() {
    console.log('[Scheduled Reports] Service initialized');
    if (config.enabled) {
        startCron();
    }
}

/**
 * Start cron job
 */
function startCron() {
    if (cronJob) {
        cronJob.stop();
    }

    const [hour, minute] = config.time.split(':');
    const cronExpression = `${minute} ${hour} * * ${config.daysOfWeek.join(',')}`;

    console.log(`[Scheduled Reports] Starting cron: ${cronExpression}`);

    cronJob = cron.schedule(cronExpression, async () => {
        console.log('[Scheduled Reports] Running scheduled report...');
        try {
            await sendReport();
        } catch (error) {
            console.error('[Scheduled Reports] Error:', error);
        }
    });
}

/**
 * Stop cron job
 */
function stopCron() {
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
        console.log('[Scheduled Reports] Cron stopped');
    }
}

/**
 * Send report to configured platform
 */
async function sendReport() {
    // Get reports from last 24 hours
    const reports = require('../routes/reports');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // This is a simplified version - in real implementation, 
    // you'd fetch from the reports array
    const recentReports = []; // Placeholder

    if (recentReports.length === 0) {
        console.log('[Scheduled Reports] No reports to send');
        return;
    }

    const summary = generateSummary(recentReports);

    if (config.platform === 'Slack' && config.slackWebhook) {
        await sendToSlack(summary, recentReports);
    } else if (config.platform === 'Teams' && config.teamsWebhook) {
        await sendToTeams(summary, recentReports);
    } else {
        throw new Error('No platform configured');
    }

    console.log(`[Scheduled Reports] Sent ${recentReports.length} reports to ${config.platform}`);
}

/**
 * Generate summary text
 */
function generateSummary(reports) {
    return {
        total: reports.length,
        platforms: [...new Set(reports.map(r => r.platform))],
        date: new Date().toLocaleDateString()
    };
}

/**
 * Send to Slack
 */
async function sendToSlack(summary, reports) {
    const message = {
        text: `📊 Daily Bug Report Summary - ${summary.date}`,
        blocks: [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `📊 Daily Bug Report Summary`
                }
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Total Reports:* ${summary.total}\n*Date:* ${summary.date}`
                }
            },
            {
                type: 'divider'
            },
            ...reports.slice(0, 10).map(report => ({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*${report.title || 'Untitled'}*\n${report.description || 'No description'}\n_Platform: ${report.platform || 'Unknown'}_`
                }
            }))
        ]
    };

    const response = await fetch(config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
    });

    if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`);
    }
}

/**
 * Send to Teams
 */
async function sendToTeams(summary, reports) {
    const message = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: `Daily Bug Report Summary - ${summary.date}`,
        themeColor: '0078D4',
        title: '📊 Daily Bug Report Summary',
        sections: [
            {
                activityTitle: `${summary.total} reports from ${summary.date}`,
                facts: reports.slice(0, 10).map(report => ({
                    name: report.title || 'Untitled',
                    value: report.description || 'No description'
                }))
            }
        ]
    };

    const response = await fetch(config.teamsWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
    });

    if (!response.ok) {
        throw new Error(`Teams webhook failed: ${response.statusText}`);
    }
}

/**
 * Update configuration
 */
function updateConfig(newConfig) {
    config = { ...config, ...newConfig };

    if (config.enabled) {
        startCron();
    } else {
        stopCron();
    }
}

/**
 * Get current configuration
 */
function getConfig() {
    return config;
}

module.exports = {
    init,
    sendReport,
    updateConfig,
    getConfig
};
