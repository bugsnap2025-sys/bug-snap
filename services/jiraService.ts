
import { fetchWithProxy } from './proxyService';
import { ReportedIssue, JiraProject, JiraIssueType, Slide } from '../types';

/**
 * Jira Service
 * Handles interaction with Jira Cloud REST API v3.
 * Uses Basic Auth (Email:APIToken) via the proxy service.
 */

const getAuthHeader = (email: string, token: string) => {
    return `Basic ${btoa(`${email}:${token}`)}`;
};

/**
 * Validates Jira Credentials by fetching the current user.
 */
export const validateJiraCredentials = async (domain: string, email: string, token: string): Promise<boolean> => {
    // Ensure domain has protocol
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    const url = `${baseUrl}/rest/api/3/myself`;

    try {
        const response = await fetchWithProxy(url, {
            headers: {
                'Authorization': getAuthHeader(email, token),
                'Accept': 'application/json',
                'X-Atlassian-Token': 'no-check',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (response.ok) return true;
        
        // Handle CORS demo required specifically
        if (response.status === 403) {
            const text = await response.text();
            if (text.includes('corsdemo')) throw new Error('corsdemo_required');
        }
        
        return false;
    } catch (error) {
        console.error("Jira Validation Failed:", error);
        throw error;
    }
};

/**
 * Fetches all visible projects for the user.
 */
export const getJiraProjects = async (domain: string, email: string, token: string): Promise<JiraProject[]> => {
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    const url = `${baseUrl}/rest/api/3/project/search?maxResults=100`; // Limit to 100 for simplicity

    try {
        const response = await fetchWithProxy(url, {
            headers: {
                'Authorization': getAuthHeader(email, token),
                'Accept': 'application/json',
                'X-Atlassian-Token': 'no-check',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) {
            const text = await response.text();
            if (text.includes('corsdemo')) throw new Error('corsdemo_required');
            throw new Error(`Failed to fetch projects (${response.status}): ${text.substring(0, 100)}`);
        }

        const data = await response.json();
        return data.values.map((p: any) => ({
            id: p.id,
            key: p.key,
            name: p.name,
            avatarUrls: p.avatarUrls
        }));

    } catch (error) {
        console.error("Fetch Jira Projects Failed:", error);
        throw error;
    }
};

/**
 * Fetches issue types for a specific project.
 * Jira configuration varies per project.
 */
export const getJiraIssueTypes = async (domain: string, email: string, token: string, projectId: string): Promise<JiraIssueType[]> => {
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    // We use the project endpoint to get context-specific issue types
    const url = `${baseUrl}/rest/api/3/project/${projectId}`;

    try {
        const response = await fetchWithProxy(url, {
            headers: {
                'Authorization': getAuthHeader(email, token),
                'Accept': 'application/json',
                'X-Atlassian-Token': 'no-check',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (!response.ok) throw new Error("Failed to fetch issue types");

        const data = await response.json();
        return data.issueTypes
            .filter((it: any) => !it.subtask) // Filter out subtasks for root creation
            .map((it: any) => ({
                id: it.id,
                name: it.name,
                description: it.description,
                iconUrl: it.iconUrl,
                subtask: it.subtask
            }));
    } catch (error) {
        console.error("Fetch Jira Issue Types Failed:", error);
        throw error;
    }
};

/**
 * Converts Markdown text to Atlassian Document Format (ADF)
 * Jira API v3 requires ADF for the description field.
 */
const markdownToADF = (text: string) => {
    const content = [];
    const lines = text.split('\n');

    for (const line of lines) {
        if (!line.trim()) continue;

        if (line.startsWith('## ')) {
            // Heading 2
            content.push({
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: line.replace('## ', '') }]
            });
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            // Bullet List Item (Simplified: We just treat as text paragraph with bullet char for robustness)
            // Real list parsing in ADF is strict, so we fallback to paragraph for "hackathon" robustness
            content.push({
                type: 'paragraph',
                content: [{ type: 'text', text: `• ${line.replace(/^[-*] /, '')}` }]
            });
        } else {
            // Standard Paragraph
            content.push({
                type: 'paragraph',
                content: [{ type: 'text', text: line }]
            });
        }
    }

    // Add Footer
    content.push({
        type: 'paragraph',
        content: [
            { type: 'text', text: '\nReported via ', marks: [{ type: 'em' }] },
            { type: 'text', text: 'BugSnap', marks: [{ type: 'strong' }, { type: 'em' }] }
        ]
    });

    return {
        type: 'doc',
        version: 1,
        content: content
    };
};

/**
 * Create a Jira Issue
 */
export const createJiraIssue = async (
    config: { domain: string, email: string, token: string },
    payload: { projectId: string, issueTypeId: string, title: string, description: string }
) => {
    const baseUrl = config.domain.startsWith('http') ? config.domain : `https://${config.domain}`;
    const url = `${baseUrl}/rest/api/3/issue`;

    const body = {
        fields: {
            project: { id: payload.projectId },
            summary: payload.title,
            issuetype: { id: payload.issueTypeId },
            description: markdownToADF(payload.description),
            // Default priority/assignee omitted for simplicity
        }
    };

    try {
        const response = await fetchWithProxy(url, {
            method: 'POST',
            headers: {
                'Authorization': getAuthHeader(config.email, config.token),
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Atlassian-Token': 'no-check', // Important for bypassing XSRF
                'X-Requested-With': 'XMLHttpRequest' // Explicitly set for robust bypass
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            // Read body ONCE as text to prevent stream locking issues
            const text = await response.text();
            let msg = text;
            
            // Try parsing as JSON to extract structured error messages
            try {
                const errorData = JSON.parse(text);
                if (errorData.errors) {
                    msg = JSON.stringify(errorData.errors);
                } else if (errorData.errorMessages) {
                    msg = errorData.errorMessages.join(', ');
                }
            } catch (e) {
                // Not JSON, fall back to raw text (e.g. "XSRF check failed")
            }
            throw new Error(`Jira Create Failed: ${msg}`);
        }

        return await response.json(); // Returns { id, key, self }

    } catch (error) {
        console.error("Create Jira Issue Failed:", error);
        throw error;
    }
};

/**
 * Upload Attachment to Jira Issue
 * Requires 'X-Atlassian-Token: no-check' header
 */
export const uploadJiraAttachment = async (
    config: { domain: string, email: string, token: string },
    issueIdOrKey: string,
    fileBlob: Blob,
    filename: string
) => {
    const baseUrl = config.domain.startsWith('http') ? config.domain : `https://${config.domain}`;
    const url = `${baseUrl}/rest/api/3/issue/${issueIdOrKey}/attachments`;

    const formData = new FormData();
    formData.append('file', fileBlob, filename);

    try {
        const response = await fetchWithProxy(url, {
            method: 'POST',
            headers: {
                'Authorization': getAuthHeader(config.email, config.token),
                'X-Atlassian-Token': 'no-check',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
                // Content-Type automatic
            },
            body: formData
        });

        if (!response.ok) throw new Error(`Attachment Upload Failed: ${response.status}`);
        return await response.json();

    } catch (error) {
        console.error("Jira Attachment Upload Failed:", error);
        throw error;
    }
};

/**
 * Fetch Jira Issues for Dashboard using JQL (Jira Query Language)
 */
export const fetchJiraIssues = async (config: { domain: string, email: string, token: string }): Promise<ReportedIssue[]> => {
    let baseUrl = config.domain.startsWith('http') ? config.domain : `https://${config.domain}`;
    baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash if present
    
    // Helper to map Jira response to ReportedIssue
    const mapIssues = (data: any) => {
        if (!data.issues) return [];
        return data.issues.map((i: any) => ({
            id: i.key,
            title: i.fields.summary,
            platform: 'Jira',
            status: i.fields.status?.name || 'Unknown',
            statusColor: i.fields.status?.statusCategory?.colorName === 'green' ? '#10b981' : '#3b82f6', // Simple color map
            priority: i.fields.priority?.name || 'Normal', // Jira priorities map loosely
            date: new Date(i.fields.created).toLocaleDateString(),
            assignee: i.fields.assignee?.displayName,
            url: `${baseUrl}/browse/${i.key}`
        }));
    };

    // Shared Search Body
    const searchBody = {
        jql: 'order by created DESC',
        maxResults: 50,
        fields: ['summary', 'status', 'priority', 'created', 'assignee', 'creator']
    };

    // Strategy 1: POST v3 (Preferred)
    try {
        const url = `${baseUrl}/rest/api/3/search`;
        const response = await fetchWithProxy(url, {
            method: 'POST',
            headers: {
                'Authorization': getAuthHeader(config.email, config.token),
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Atlassian-Token': 'no-check',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(searchBody)
        });

        if (response.ok) {
            return mapIssues(await response.json());
        }
        
        // If 404/410/403, proceed to fallback. Throw others.
        if (response.status !== 403 && response.status !== 404 && response.status !== 410) {
             const text = await response.text();
             if (text.includes('corsdemo')) throw new Error('corsdemo_required');
             throw new Error(`Jira API Error (${response.status}): ${text.substring(0, 100)}...`);
        }
        console.warn(`Jira POST v3 failed (${response.status}), trying fallback...`);

    } catch (e: any) {
        if (e.message === 'corsdemo_required') throw e;
        console.warn("Jira POST v3 strategy failed:", e);
    }

    // Strategy 2: POST v2 (Fallback)
    // IMPORTANT: We use POST here as well because GET /search is removed/deprecated (410 Gone).
    // v2 POST endpoint is generally stable for older integrations or if v3 has strict content-type issues.
    try {
        const url = `${baseUrl}/rest/api/2/search`;
        
        const response = await fetchWithProxy(url, {
            method: 'POST',
            headers: {
                'Authorization': getAuthHeader(config.email, config.token),
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Atlassian-Token': 'no-check',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(searchBody)
        });

        if (!response.ok) {
             const text = await response.text();
             if (text.includes('corsdemo')) throw new Error('corsdemo_required');
             
             try {
                 const json = JSON.parse(text);
                 if (json.errorMessages && json.errorMessages.length > 0) {
                     throw new Error(`Jira: ${json.errorMessages.join(', ')}`);
                 }
             } catch(e) {}

             throw new Error(`Jira API Error (${response.status}): ${text.substring(0, 100)}...`);
        }

        return mapIssues(await response.json());

    } catch (error) {
        console.error("Fetch Jira Issues Failed (All Strategies):", error);
        throw error;
    }
};
