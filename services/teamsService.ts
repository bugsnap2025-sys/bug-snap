
import { fetchWithProxy } from './proxyService';
import { Slide } from '../types';
import { generateTaskDescription } from './clickUpService';

/**
 * Validates a Teams Webhook URL.
 * Checks if it follows the standard pattern for Office 365/Teams webhooks.
 */
export const validateTeamsWebhookUrl = async (url: string): Promise<boolean> => {
    if (!url) return false;
    
    // Basic format check
    // Teams webhooks usually start with 'https://' and contain 'webhook.office.com' or 'outlook.office.com'
    if (!url.startsWith('https://')) return false;
    if (!url.includes('webhook.office.com') && !url.includes('outlook.office.com')) return false;

    // Optional: We could try sending a dummy payload, but simply parsing format is safer for a synchronous-like validation
    // to avoid sending garbage to a real channel during setup.
    return true;
};

/**
 * Sends a message to Microsoft Teams via Incoming Webhook.
 * Uses Adaptive Cards for rich formatting.
 */
export const postTeamsMessage = async (
    webhookUrl: string,
    slide?: Slide, 
    summaryText?: string
) => {
    // Construct Adaptive Card Payload
    const cardBody: any[] = [];

    if (slide) {
        // 1. Header
        cardBody.push({
            type: "TextBlock",
            size: "Medium",
            weight: "Bolder",
            text: `🐛 Bug Report: ${slide.name}`
        });

        cardBody.push({
            type: "TextBlock",
            text: `Created on ${new Date(slide.createdAt).toLocaleString()}`,
            isSubtle: true,
            spacing: "None"
        });

        // 2. Annotations / Description
        const descMarkdown = generateTaskDescription(slide);
        cardBody.push({
            type: "TextBlock",
            text: descMarkdown,
            wrap: true,
            spacing: "Medium"
        });

    } else if (summaryText) {
        // Dashboard Summary
        cardBody.push({
            type: "TextBlock",
            size: "Medium",
            weight: "Bolder",
            text: "📊 Dashboard Summary"
        });

        cardBody.push({
            type: "TextBlock",
            text: summaryText,
            wrap: true,
            spacing: "Medium"
        });
    }

    // Footer
    cardBody.push({
        type: "TextBlock",
        text: "Generated via BugSnap",
        size: "Small",
        isSubtle: true,
        spacing: "Large",
        separator: true
    });

    const payload = {
        type: "message",
        attachments: [
            {
                contentType: "application/vnd.microsoft.card.adaptive",
                contentUrl: null,
                content: {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.2",
                    "body": cardBody
                }
            }
        ]
    };

    try {
        // Use proxy because Teams webhooks might have strict CORS policies when called from browser
        const response = await fetchWithProxy(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            if (text.includes('corsdemo')) throw new Error('corsdemo_required');
            throw new Error(`Teams Webhook Error: ${response.status} - ${text}`);
        }

        // Webhook usually returns "1" or "true" on success
        return true;
    } catch (error) {
        console.error("Teams Webhook Failed:", error);
        throw error;
    }
};
