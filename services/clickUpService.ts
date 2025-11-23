
import { Slide, IntegrationConfig, ClickUpExportMode, ReportedIssue, ClickUpHierarchyList } from '../types';
import { fetchWithProxy } from './proxyService';

/**
 * Extracts a List ID from a ClickUp URL or validates a raw ID.
 */
export const extractListId = (input: string): string | null => {
  if (!input) return null;
  if (/^\d+$/.test(input)) return input;
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

/**
 * Recursively fetches all lists available to the user.
 * Flow: Teams -> Spaces -> Folders/Lists -> Lists
 */
export const getAllClickUpLists = async (token: string): Promise<ClickUpHierarchyList[]> => {
    try {
        // 1. Get Teams
        const teamsRes = await fetchWithProxy('https://api.clickup.com/api/v2/team', {
            headers: { 'Authorization': token }
        });
        const teamsData = await teamsRes.json();
        const teams = teamsData.teams || [];
        
        let allLists: ClickUpHierarchyList[] = [];

        // 2. Iterate Teams to get Spaces
        for (const team of teams) {
            const spacesRes = await fetchWithProxy(`https://api.clickup.com/api/v2/team/${team.id}/space?archived=false`, {
                headers: { 'Authorization': token }
            });
            const spacesData = await spacesRes.json();
            const spaces = spacesData.spaces || [];

            // 3. Iterate Spaces to get Folders and Folderless Lists
            for (const space of spaces) {
                // Get Folders
                const foldersRes = await fetchWithProxy(`https://api.clickup.com/api/v2/space/${space.id}/folder?archived=false`, {
                    headers: { 'Authorization': token }
                });
                const foldersData = await foldersRes.json();
                const folders = foldersData.folders || [];

                // Get Folderless Lists
                const listsRes = await fetchWithProxy(`https://api.clickup.com/api/v2/space/${space.id}/list?archived=false`, {
                    headers: { 'Authorization': token }
                });
                const listsData = await listsRes.json();
                const folderlessLists = listsData.lists || [];

                // Add Folderless Lists
                folderlessLists.forEach((l: any) => {
                    allLists.push({
                        id: l.id,
                        name: l.name,
                        groupName: `${space.name} (Space)`
                    });
                });

                // 4. Iterate Folders to get Lists
                for (const folder of folders) {
                    const folderListsRes = await fetchWithProxy(`https://api.clickup.com/api/v2/folder/${folder.id}/list?archived=false`, {
                         headers: { 'Authorization': token }
                    });
                    const folderListsData = await folderListsRes.json();
                    const folderLists = folderListsData.lists || [];
                    
                    folderLists.forEach((l: any) => {
                         allLists.push({
                             id: l.id,
                             name: l.name,
                             groupName: `${space.name} > ${folder.name}`
                         });
                    });
                }
            }
        }
        return allLists;

    } catch (error) {
        console.error("Failed to fetch ClickUp hierarchy", error);
        throw new Error("Failed to load lists. Check your Token.");
    }
};

export const createClickUpTask = async ({ listId, token, title, description, parentId }: CreateTaskParams) => {
  const url = `https://api.clickup.com/api/v2/list/${listId}/task`;
  
  // Format Title: "[BugSnap] Title"
  const formattedTitle = title.startsWith('[BugSnap]') ? title : `[BugSnap] ${title}`;
  
  // Format Description: Add footer
  const footer = `\n\n---\nCreated using BugSnap`;
  const formattedDescription = description.endsWith('BugSnap') ? description : description + footer;

  const payload: any = {
    name: truncate(formattedTitle, 180), 
    description: truncate(formattedDescription, 5000), 
    tags: ["BugSnap"] // Add Tag
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
    const allTasks = data.tasks || [];

    // --- FILTER LOGIC ---
    // 1. Tags include "BugSnap"
    // 2. Title contains "[BugSnap]"
    // 3. Description contains "Created using BugSnap"
    // Show task if ANY condition matches.
    const filteredTasks = allTasks.filter((t: any) => {
        const hasTag = t.tags && t.tags.some((tag: any) => tag.name.toLowerCase() === 'bugsnap');
        const hasTitlePrefix = t.name && t.name.includes('[BugSnap]');
        const hasDescSuffix = t.description && t.description.includes('Created using BugSnap');
        
        return hasTag || hasTitlePrefix || hasDescSuffix;
    });
    
    // Map ClickUp API response to ReportedIssue
    return filteredTasks.map((t: any) => {
      let priority: ReportedIssue['priority'] = 'None';
      if (t.priority) {
        const p = t.priority.priority; 
        if (p === 'urgent') priority = 'Urgent';
        else if (p === 'high') priority = 'High';
        else if (p === 'normal') priority = 'Normal';
        else if (p === 'low') priority = 'Low';
      }

      // Extract Tags as Modules
      const tags = t.tags ? t.tags.map((tag: any) => tag.name) : [];
      const module = tags.length > 0 ? tags.filter((tag: string) => tag.toLowerCase() !== 'bugsnap')[0] : 'General';

      // Calc Resolution Time
      let resolutionTime = undefined;
      if (t.date_closed && t.date_created) {
          const diffMs = parseInt(t.date_closed) - parseInt(t.date_created);
          resolutionTime = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1)); // Hours
      }

      return {
        id: t.id, 
        title: t.name,
        platform: 'ClickUp',
        status: t.status?.status || 'Unknown',
        statusColor: t.status?.color || '#ccc',
        priority,
        assignee: t.assignees?.[0]?.username,
        date: new Date(parseInt(t.date_created)).toLocaleDateString(),
        dueDate: t.due_date ? new Date(parseInt(t.due_date)).toLocaleDateString() : undefined,
        url: t.url,
        module: module || 'General',
        reporter: t.creator?.username || 'Unknown',
        resolutionTime,
        tags
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
      const safeComment = truncate(ann.comment || "(No comment)", 500);
      md += `**${idx + 1}.** ${safeComment}\n`;
    });
  }
  return md;
};

export const generateMasterDescription = (slides: Slide[]): string => {
  return `## Bug Report Summary
  
  **Total Slides:** ${slides.length}
  **Date:** ${new Date().toLocaleDateString()}
  
  See attached images/subtasks for details.`;
};
