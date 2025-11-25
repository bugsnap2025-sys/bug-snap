
import { fetchWithProxy } from './proxyService';
import { AsanaWorkspace, AsanaProject, ReportedIssue } from '../types';

const ASANA_API_BASE = 'https://app.asana.com/api/1.0';

/**
 * Validates Asana Personal Access Token
 */
export const validateAsanaToken = async (token: string): Promise<boolean> => {
  try {
    const response = await fetchWithProxy(`${ASANA_API_BASE}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) return true;
    
    if (response.status === 403) {
       const text = await response.text();
       if (text.includes('corsdemo')) throw new Error('corsdemo_required');
    }
    
    return false;
  } catch (error) {
    if (error instanceof Error && error.message === 'corsdemo_required') {
        throw error;
    }
    console.error("Asana Validation Failed:", error);
    return false;
  }
};

/**
 * Get all workspaces for the authenticated user
 */
export const getAsanaWorkspaces = async (token: string): Promise<AsanaWorkspace[]> => {
  const response = await fetchWithProxy(`${ASANA_API_BASE}/workspaces`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
     const text = await response.text();
     if (text.includes('corsdemo')) throw new Error('corsdemo_required');
     throw new Error(`Failed to fetch Asana workspaces: ${response.status}`);
  }

  const data = await response.json();
  return data.data;
};

/**
 * Get all projects in a workspace
 */
export const getAsanaProjects = async (token: string, workspaceId: string): Promise<AsanaProject[]> => {
  const response = await fetchWithProxy(`${ASANA_API_BASE}/workspaces/${workspaceId}/projects?archived=false`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) throw new Error("Failed to fetch Asana projects");

  const data = await response.json();
  return data.data;
};

/**
 * Create a Task in Asana
 */
export const createAsanaTask = async (
  token: string, 
  workspaceId: string, 
  projectId: string, 
  title: string, 
  description: string
) => {
  const payload = {
    data: {
      workspace: workspaceId,
      projects: [projectId],
      name: title,
      notes: description, // Plain text description
      html_notes: `<body>${description.replace(/\n/g, '<br/>')}</body>` // Basic HTML support
    }
  };

  const response = await fetchWithProxy(`${ASANA_API_BASE}/tasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
      const text = await response.text();
      throw new Error(`Asana Create Failed: ${text}`);
  }

  const data = await response.json();
  return data.data; // { gid, permalink_url, ... }
};

/**
 * Upload Attachment to Asana Task
 */
export const uploadAsanaAttachment = async (token: string, taskGid: string, fileBlob: Blob, filename: string) => {
  const formData = new FormData();
  formData.append('file', fileBlob, filename);

  const response = await fetchWithProxy(`${ASANA_API_BASE}/tasks/${taskGid}/attachments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      // Content-Type handled automatically
    },
    body: formData
  });

  if (!response.ok) throw new Error("Asana Upload Failed");
  return await response.json();
};

/**
 * Fetch Tasks for Dashboard
 * Gets tasks for a specific project
 */
export const fetchAsanaTasks = async (token: string, projectId: string): Promise<ReportedIssue[]> => {
  // Fetch tasks with specific fields
  const fields = 'name,completed,assignee.name,created_at,permalink_url';
  const url = `${ASANA_API_BASE}/projects/${projectId}/tasks?opt_fields=${fields}`;

  const response = await fetchWithProxy(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
     const text = await response.text();
     if (text.includes('corsdemo')) throw new Error('corsdemo_required');
     throw new Error("Failed to fetch Asana tasks");
  }

  const data = await response.json();
  
  return data.data.map((t: any) => ({
      id: t.gid,
      title: t.name,
      platform: 'Asana',
      status: t.completed ? 'Completed' : 'Incomplete',
      statusColor: t.completed ? '#10b981' : '#F06A6A',
      priority: 'Normal', // Asana priority is a custom field, defaulting to Normal
      date: t.created_at ? new Date(t.created_at).toLocaleDateString() : 'N/A',
      assignee: t.assignee ? t.assignee.name : undefined,
      url: t.permalink_url
  }));
};
