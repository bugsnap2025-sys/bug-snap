
import { fetchWithProxy } from './proxyService';
import { Slide } from '../types';
import { generateTaskDescription } from './clickUpService';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

/**
 * Extracts Team ID and Channel ID from a Microsoft Teams sharing URL.
 * Supports formats:
 * - https://teams.microsoft.com/l/channel/19%3A...%40thread.tacv2/General?groupId=...&tenantId=...
 */
export const extractTeamsInfoFromUrl = (url: string): { teamId: string | null, channelId: string | null } => {
    try {
        // 1. Decode URL to handle %3A, %40, etc.
        const decodedUrl = decodeURIComponent(url);
        
        // 2. Extract Team ID (groupId)
        // Look for groupId=GUID (36 chars)
        const groupMatch = decodedUrl.match(/[?&]groupId=([0-9a-fA-F-]{36})/);
        const teamId = groupMatch ? groupMatch[1] : null;

        // 3. Extract Channel ID
        // Look for pattern 19:...@thread.tacv2
        // It usually starts with 19: and ends with @thread.tacv2
        const channelMatch = decodedUrl.match(/19:[a-zA-Z0-9\-_]+@thread\.tacv2/);
        const channelId = channelMatch ? channelMatch[0] : null;

        return { teamId, channelId };
    } catch (e) {
        console.error("Error parsing Teams URL", e);
        return { teamId: null, channelId: null };
    }
};

/**
 * Validates Microsoft Teams Credentials by trying to fetch the channel info.
 */
export const validateTeamsConnection = async (token: string, teamId: string, channelId: string): Promise<boolean> => {
    const url = `${GRAPH_API_BASE}/teams/${teamId}/channels/${channelId}`;
    
    try {
        const response = await fetchWithProxy(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) return true;
        
        if (response.status === 403) {
             const text = await response.text();
             if (text.includes('corsdemo')) throw new Error('corsdemo_required');
        }
        
        return false;
    } catch (error) {
        console.error("Teams Validation Failed:", error);
        if (error instanceof Error && error.message === 'corsdemo_required') {
            throw error;
        }
        throw error;
    }
};

/**
 * Converts internal markdown description to HTML for Teams
 */
const formatDescriptionToHtml = (description: string): string => {
    // Basic Markdown to HTML conversion
    return description
        .replace(/\n/g, '<br/>')
        .replace(/## (.*?)<br\/>/g, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/_(.*?)_/g, '<i>$1</i>')
        .replace(/- (.*?)<br\/>/g, '• $1<br/>');
};

export const postTeamsMessage = async (
    config: { token: string, teamId: string, channelId: string },
    slide?: Slide, // Optional: if provided, sends detail for one slide
    summaryText?: string // Optional: if provided, sends a summary
) => {
    const url = `${GRAPH_API_BASE}/teams/${config.teamId}/channels/${config.channelId}/messages`;
    
    let content = "";
    
    if (slide) {
        const descHtml = formatDescriptionToHtml(generateTaskDescription(slide));
        content = `
            <h2>🐛 Bug Report: ${slide.name}</h2>
            <p><strong>Created:</strong> ${new Date(slide.createdAt).toLocaleString()}</p>
            <hr/>
            ${descHtml}
            <br/>
            <p><small>Generated via BugSnap</small></p>
        `;
    } else if (summaryText) {
        content = `
            <h2>📊 Dashboard Summary</h2>
            <p>${formatDescriptionToHtml(summaryText)}</p>
            <br/>
            <p><small>Generated via BugSnap</small></p>
        `;
    }

    const payload = {
        body: {
            contentType: 'html',
            content: content
        }
    };

    try {
        const response = await fetchWithProxy(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            if (text.includes('corsdemo')) throw new Error('corsdemo_required');
            
            // Try parse error
            try {
                const json = JSON.parse(text);
                throw new Error(`Teams API Error: ${json.error?.message || response.statusText}`);
            } catch (e) {
                throw new Error(`Teams API Error: ${response.status} - ${text}`);
            }
        }

        return await response.json();
    } catch (error) {
        console.error("Teams Post Failed:", error);
        throw error;
    }
};
