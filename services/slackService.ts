
import { fetchWithProxy } from './proxyService';
import { ReportedIssue, Slide, IssueMetric } from '../types';
import { generateTaskDescription } from './clickUpService'; // Reuse markdown generator logic

const SLACK_API_BASE = 'https://slack.com/api';

/**
 * Extract Channel ID from a URL or return the input if it looks like an ID.
 * URL Example: https://app.slack.com/client/T12345/C12345
 */
export const extractChannelId = (input: string): string | null => {
  if (!input) return null;
  // If it starts with C, D, or G and is around 9-12 chars, assume ID
  if (/^[CDG][A-Z0-9]{8,15}$/.test(input)) return input;
  
  const match = input.match(/\/(C[A-Z0-9]+)$/);
  if (match && match[1]) return match[1];
  
  return null;
};

export const postSlackMessage = async (token: string, channel: string, text: string, threadTs?: string): Promise<string> => {
  const url = `${SLACK_API_BASE}/chat.postMessage`;
  
  const payload: any = {
    channel,
    text,
    link_names: true
  };
  
  if (threadTs) {
    payload.thread_ts = threadTs;
  }

  try {
    const response = await fetchWithProxy(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (!data.ok) {
        if (data.error === 'not_in_channel') {
            throw new Error(`Bot is not in the channel. Please type /invite @BugSnap in channel ${channel}`);
        }
        throw new Error(`Slack API Error: ${data.error}`);
    }
    
    return data.ts; // Return timestamp for threading
  } catch (error) {
    console.error('Slack Post Message Failed:', error);
    throw error;
  }
};

export const uploadSlackFile = async (token: string, channel: string, fileBlob: Blob, filename: string, title: string, threadTs?: string) => {
  // Note: We are using files.upload which is legacy but easier for single-request proxying than the new v2 flow.
  const url = `${SLACK_API_BASE}/files.upload`;
  
  const formData = new FormData();
  formData.append('channels', channel);
  formData.append('file', fileBlob, filename);
  formData.append('title', title);
  if (threadTs) {
    formData.append('thread_ts', threadTs);
  }

  try {
    const response = await fetchWithProxy(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Content-Type handled automatically
      },
      body: formData
    });

    const data = await response.json();
    if (!data.ok) {
        throw new Error(`Slack Upload Error: ${data.error}`);
    }
    return data.file;
  } catch (error) {
    console.error('Slack File Upload Failed:', error);
    throw error;
  }
};

export const fetchSlackHistory = async (token: string, channel: string): Promise<ReportedIssue[]> => {
  const url = `${SLACK_API_BASE}/conversations.history?channel=${channel}&limit=20`;
  
  try {
    const response = await fetchWithProxy(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    const data = await response.json();
    if (!data.ok) {
         if (data.error === 'not_in_channel') {
            throw new Error(`Bot is not in the channel. Please invite it.`);
        }
        throw new Error(`Slack History Error: ${data.error}`);
    }
    
    return (data.messages || []).map((m: any) => ({
        id: m.ts,
        title: m.text ? (m.text.length > 60 ? m.text.substring(0, 60) + '...' : m.text) : 'File Upload/System Message',
        platform: 'Slack',
        status: 'Message',
        statusColor: '#4A154B',
        priority: 'Normal',
        date: new Date(parseFloat(m.ts) * 1000).toLocaleDateString(),
        assignee: m.user || 'Bot',
        url: `https://slack.com/archives/${channel}/p${m.ts.replace('.', '')}`
    } as ReportedIssue));

  } catch (error) {
    console.error('Fetch Slack History Failed:', error);
    throw error;
  }
};

// --- Helper to Format Dashboard Summary ---
export const generateDashboardSummary = (metrics: any): string => {
    const rate = metrics.total > 0 ? metrics.resolutionRate : 0;
    
    // Format Priority breakdown
    const priorityText = (metrics.priorityData || [])
        .map((p: any) => `• ${p.name}: ${p.count}`)
        .join('\n');

    return `*BugSnap Dashboard Report* :bar_chart:\n\n` +
           `:white_check_mark: *Resolved Issues:* ${metrics.resolvedCount}\n` +
           `:hourglass_flowing_sand: *Pending Issues:* ${metrics.openCount}\n\n` +
           `*Priority Breakdown:*\n${priorityText || 'No active issues'}\n\n` +
           `_Generated via BugSnap Dashboard_`;
};

export const generateSlideMessage = (slide: Slide): string => {
    return `*Bug Report: ${slide.name}*\n\n` +
           generateTaskDescription(slide)
             .replace(/##/g, '*') // Basic markdown conversion for Slack
             .replace(/\*\*/g, '*')
             .replace(/_/g, '_');
};
