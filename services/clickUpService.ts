
import { Slide, IntegrationConfig, ClickUpExportMode, ReportedIssue } from '../types';
import { fetchWithProxy } from './proxyService';

/**
 * Extracts a List ID from a ClickUp URL or validates a raw ID.
 * Supports formats:
 * - https://app.clickup.com/1234/v/l/li/90150123456
 * - https://app.clickup.com/1234/v/li/90150123456
 * - 90150123456 (Raw ID)
 */
export const extractListId = (input: string): string | null => {
  if (!input) return null;
  
  // 1. Check for direct numeric ID (approx 10-12 digits usually, but can vary)
  if (/^\d+$/.test(input)) return input;

  // 2. Regex for URL extraction
  // Looks for /li/{numbers} or /l/li/{numbers}
  const match = input.match(/\/li\/(\d+)/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
};

interface CreateTaskParams {
  listId: string;
  token: string;
  title: string;
  description: string;
  parentId?: string; // For subtasks
}

// Helper to safely truncate strings
const truncate = (str: string, maxLength: number): string => {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
};

export const createClickUpTask = async ({ listId, token, title, description, parentId }: CreateTaskParams) => {
  const url = `https://api.clickup.com/api/v2/list/${listId}/task`;
  
  // ClickUp has strict limits. 
  // Task names ~100-200 chars ideally.
  // Descriptions can be long but 413 errors imply we are sending massive payloads.
  // We hard cap description at 5000 chars to be safe.
  const payload: any = {
    name: truncate(title, 180), 
    description: truncate(description, 5000), 
    // Removed default status: 'Open' to allow List defaults
  };

  if (parentId) {
    payload.parent = parentId;
  }

  try {
    const response = await fetchWithProxy(url, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      // Try to parse helpful error message from JSON
      try {
          const json = JSON.parse(text);
          const errMessage = json.err || json.ECODE || text;
          throw new Error(`ClickUp API Error: ${response.status} - ${errMessage}`);
      } catch (e) {
          throw new Error(`ClickUp API Error: ${response.status} - ${text}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error("Task creation failed:", error);
    throw error;
  }
};

export const uploadClickUpAttachment = async (taskId: string, token: string, fileBlob: Blob, filename: string) => {
  const url = `https://api.clickup.com/api/v2/task/${taskId}/attachment`;
  
  const formData = new FormData();
  formData.append('attachment', fileBlob, filename);

  try {
    const response = await fetchWithProxy(url, {
      method: 'POST',
      headers: {
        'Authorization': token,
        // Content-Type is set automatically by fetch with FormData
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Attachment Upload Failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Attachment upload failed:", error);
    throw error;
  }
};

export const fetchClickUpTasks = async (listId: string, token: string): Promise<ReportedIssue[]> => {
  // Fetch tasks including closed ones to calculate resolution rate
  const url = `https://api.clickup.com/api/v2/list/${listId}/task?include_closed=true&order_by=updated&reverse=true&page=0`;

  try {
    const response = await fetchWithProxy(url, {
      method: 'GET',
      headers: {
        'Authorization': token
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.status}`);
    }

    const data = await response.json();
    
    // Map ClickUp API response to ReportedIssue
    return (data.tasks || []).map((t: any) => {
      // Map Priority
      let priority: ReportedIssue['priority'] = 'None';
      if (t.priority) {
        const p = t.priority.priority; // "urgent", "high", "normal", "low"
        if (p === 'urgent') priority = 'Urgent';
        else if (p === 'high') priority = 'High';
        else if (p === 'normal') priority = 'Normal';
        else if (p === 'low') priority = 'Low';
      }

      return {
        id: t.id, // ClickUp IDs are strings like "8685g6x0p"
        title: t.name,
        platform: 'ClickUp',
        status: t.status?.status || 'Unknown',
        statusColor: t.status?.color || '#ccc',
        priority,
        assignee: t.assignees?.[0]?.username,
        date: new Date(parseInt(t.date_created)).toLocaleDateString(),
        dueDate: t.due_date ? new Date(parseInt(t.due_date)).toLocaleDateString() : undefined,
        url: t.url
      } as ReportedIssue;
    });

  } catch (error) {
    console.error("Fetch ClickUp tasks failed:", error);
    throw error;
  }
}

// --- Markdown Helpers ---

export const generateTaskDescription = (slide: Slide): string => {
  let md = `## Observations for: ${truncate(slide.name, 100)}\n\n`;
  
  if (slide.annotations.length === 0) {
    md += "_No specific annotations marked._\n";
  } else {
    slide.annotations.forEach((ann, idx) => {
      // Truncate individual comments to prevent one huge comment from blocking the whole request
      const safeComment = truncate(ann.comment || "(No comment)", 500);
      md += `**${idx + 1}.** ${safeComment}\n`;
    });
  }
  
  md += `\n\n_Reported via BugSnap_`;
  return md;
};

export const generateMasterDescription = (slides: Slide[]): string => {
  return `## Bug Report Summary
  
  **Total Slides:** ${slides.length}
  **Date:** ${new Date().toLocaleDateString()}
  
  See attached images/subtasks for details.
  
  _Reported via BugSnap_`;
};
