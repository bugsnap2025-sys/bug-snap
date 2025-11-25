
import { fetchWithProxy } from './proxyService';

export interface WebhookPayload {
    title: string;
    description: string;
    source: string; // 'BugSnap'
    timestamp: string;
    attachments: {
        filename: string;
        content: string; // Base64
        mimeType: string;
    }[];
    metadata?: any;
}

/**
 * Validates if the URL is well-formed
 */
export const validateWebhookUrl = async (url: string): Promise<boolean> => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

/**
 * Sends the bug report payload to the configured webhook URL.
 * Tries direct fetch first (for CORS-enabled hooks), then falls back to proxy.
 */
export const sendToWebhook = async (webhookUrl: string, payload: WebhookPayload) => {
    try {
        // 1. Try Direct Fetch (Best for Zapier, Make, public endpoints that allow CORS)
        try {
            const directResponse = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (directResponse.ok) return await directResponse.json().catch(() => ({ status: 'ok' }));
            // If it's a 4xx/5xx, throw specific error
            if (directResponse.status >= 400) {
                 const text = await directResponse.text();
                 throw new Error(`Webhook Error ${directResponse.status}: ${text}`);
            }
        } catch (directErr) {
            // Network error or CORS blocked -> Fallback to Proxy
            console.warn("Direct webhook failed, trying proxy...", directErr);
        }

        // 2. Fallback to Proxy
        const response = await fetchWithProxy(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            if (text.includes('corsdemo')) throw new Error('corsdemo_required');
            throw new Error(`Webhook Error ${response.status}: ${text}`);
        }

        return await response.json().catch(() => ({ status: 'ok' }));

    } catch (error) {
        console.error("Webhook Export Failed:", error);
        throw error;
    }
};
