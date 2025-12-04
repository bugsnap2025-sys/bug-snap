const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

/**
 * Generic CORS Proxy
 * POST /api/proxy
 * Body: { url: string, method: string, headers: object, body: any }
 */
router.post('/', async (req, res) => {
    try {
        const { url, method = 'GET', headers = {}, body } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'Missing "url" parameter' });
        }

        console.log(`[Proxy] ${method} ${url}`);

        // Forward the request
        const response = await fetch(url, {
            method,
            headers: {
                ...headers,
                // Remove problematic headers
                host: undefined,
                connection: undefined,
            },
            body: body && method !== 'GET' && method !== 'HEAD'
                ? (typeof body === 'string' ? body : JSON.stringify(body))
                : undefined
        });

        // Get response data
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        // Return response with original status
        res.status(response.status).json({
            status: response.status,
            statusText: response.statusText,
            data,
            headers: Object.fromEntries(response.headers.entries())
        });

    } catch (error) {
        console.error('[Proxy Error]', error);
        res.status(500).json({
            error: 'Proxy request failed',
            message: error.message
        });
    }
});

module.exports = router;
