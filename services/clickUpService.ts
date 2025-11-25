
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
 * Validates the ClickUp Personal Access Token.
 * Tries multiple endpoints (/user and /team) to ensure validity across different user roles.
 */
export const validateClickUpToken = async (token: string): Promise<boolean> => {
    try {
        // 1. Try fetching User (Standard check)
        const userRes = await fetchWithProxy('https://api.clickup.com/api/v2/user', {
            headers: { 'Authorization': token }
        });
        if (userRes.ok) return true;

        // 2. Fallback: Try fetching Teams (Some tokens/roles might behave differently)
        const teamRes = await fetchWithProxy('https://api.clickup.com/api/v2/team', {
            headers: { 'Authorization': token }
        });
        if (teamRes.ok) return true;

        return false;
    } catch (error) {
        console.error("Token validation failed:", error);
        // Bubble up specific proxy requirement errors
        if (error instanceof Error && error.message === 'corsdemo_required') {
            throw error;
        }
        return false;
    }
};

/**
 * Recursively fetches all lists available to the user.
 * Flow: Teams -> Spaces -> Folders/Lists -> Lists
 * Robustly handles permission errors (403) by skipping inaccessible resources.
 */
export const getAllClickUpLists = async (token: string): Promise<ClickUpHierarchyList[]> => {
    try {
        // 1. Get Teams
        const teamsRes = await fetchWithProxy('https://api.clickup.com/api/v2/team', {
            headers: { 'Authorization': token }
        });
        
        if (!teamsRes.ok) {
             if (teamsRes.status === 401) throw new Error("Invalid Personal Access Token");
             return []; 
        }
        
        const teamsData = await teamsRes.json();
        const teams = teamsData.teams || [];
        
        let allLists: ClickUpHierarchyList[] = [];

        // 2. Iterate Teams
        for (const team of teams) {
            try {
                const spacesRes = await fetchWithProxy(`https://api.clickup.com/api/v2/team/${team.id}/space?archived=false`, {
                    headers: { 'Authorization': token }
                });
                // If a user lacks access to spaces in a team, skip this team
                if (!spacesRes.ok) continue;

                const spacesData = await spacesRes.json();
                const spaces = spacesData.spaces || [];

                // 3. Iterate Spaces
                for (const space of spaces) {
                    try {
                        // Fetch Folders and Folderless Lists in parallel
                        const [foldersRes, listsRes] = await Promise.all([
                            fetchWithProxy(`https://api.clickup.com/api/v2/space/${space.id}/folder?archived=false`, { headers: { 'Authorization': token } }).catch(() => null),
                            fetchWithProxy(`https://api.clickup.com/api/v2/space/${space.id}/list?archived=false`, { headers: { 'Authorization': token } }).catch(() => null)
                        ]);

                        // Process Folderless Lists
                        if (listsRes && listsRes.ok) {
                            const listsData = await listsRes.json();
                            const folderlessLists = listsData.lists || [];
                            folderlessLists.forEach((l: any) => {
                                allLists.push({
                                    id: l.id,
                                    name: l.name,
                                    groupName: `${space.name} (Space)`
                                });
                            });
                        }

                        // Process Folders
                        if (foldersRes && foldersRes.ok) {
                            const foldersData = await foldersRes.json();
                            const folders = foldersData.folders || [];
                            
                            // 4. Iterate Folders to get Lists
                            for (const folder of folders) {
                                try {
                                    const folderListsRes = await fetchWithProxy(`https://api.clickup.com/api/v2/folder/${folder.id}/list?archived=false`, {
                                         headers: { 'Authorization': token }
                                    });
                                    if (folderListsRes.ok) {
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
                                } catch (e) { /* Ignore folder access error */ }
                            }
                        }
                    } catch (e) { /* Ignore space access error */ }
                }
            } catch (e) { /* Ignore team iteration error */ }
        }
        return allLists;

    } catch (error: any) {
        console.error("Failed to fetch ClickUp hierarchy", error);
        // Important: Re-throw proxy errors so UI can show the unlock link
        if (error.message === 'corsdemo_required') {
            throw error;
        }
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
    console.error("ClickUp Task Creation Failed:", error);
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
        // Content-Type is automatic with FormData
      },
      body: formData
    });

    if (!response.ok) {
        const text = await response.text();
        
        // Specific handling for storage limits
        if (text.includes("Over allocated storage")) {
            const sizeInMB = (fileBlob.size / (1024 * 1024)).toFixed(2);
            throw new Error(`ClickUp Workspace Storage Full. This file is ${sizeInMB}MB. Please delete old files or upgrade plan.`);
        }

        throw new Error(`Attachment Upload Failed: ${response.status} - ${text}`);
    }

    return await response.json();
  } catch (error) {
    console.error("ClickUp Attachment Upload Failed:", error);
    throw error;
  }
};

export const generateTaskDescription = (slide: Slide): string => {
  let desc = `## Observations\n\n`;
  
  if (slide.annotations.length === 0) {
    desc += `_No specific annotations provided._\n`;
  } else {
    slide.annotations.forEach((ann, i) => {
      desc += `**${i + 1}.** ${ann.comment || 'No comment'}\n`;
    });
  }

  desc += `\n\n---\n`;
  desc += `**Metadata**\n`;
  desc += `Captured: ${new Date(slide.createdAt).toLocaleString()}\n`;
  desc += `Source: BugSnap`;
  
  return desc;
};

export const generateMasterDescription = (slides: Slide[]): string => {
  let desc = `# Bug Report Summary\n\n`;
  desc += `Total Slides: ${slides.length}\n\n`;

  slides.forEach((slide, i) => {
      desc += `## Slide ${i + 1}: ${slide.name}\n`;
      if (slide.annotations.length > 0) {
          slide.annotations.forEach((ann, j) => {
              desc += `- **Issue ${j + 1}:** ${ann.comment || 'No details'}\n`;
          });
      } else {
          desc += `_No annotations._\n`;
      }
      desc += `\n`;
  });

  return desc;
};

export const fetchClickUpTasks = async (listId: string, token: string): Promise<ReportedIssue[]> => {
    const url = `https://api.clickup.com/api/v2/list/${listId}/task?include_closed=true&subtasks=true`;
    
    try {
        const response = await fetchWithProxy(url, {
            headers: { 'Authorization': token }
        });
        
        if (!response.ok) {
             // Handle generic failure, but let's check text for proxy errors if any
            const text = await response.text();
            if (text.includes('corsdemo')) throw new Error('corsdemo_required');
            
            throw new Error(`Failed to fetch ClickUp tasks: ${response.status}`);
        }
        
        const data = await response.json();
        const tasks = data.tasks || [];
        
        return tasks.map((t: any) => ({
            id: t.id,
            title: t.name,
            platform: 'ClickUp',
            status: t.status?.status || 'Unknown',
            statusColor: t.status?.color || '#ccc',
            priority: t.priority?.priority ? capitalize(t.priority.priority) : 'None',
            date: new Date(parseInt(t.date_created)).toLocaleDateString(),
            assignee: t.assignees.length > 0 ? t.assignees[0].username : undefined,
            url: t.url
        }));

    } catch (error) {
        console.error("ClickUp Fetch Tasks Failed:", error);
        throw error;
    }
};

const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
