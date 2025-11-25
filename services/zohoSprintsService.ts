
import { fetchWithProxy } from './proxyService';
import { ZohoSprintsTeam, ZohoSprintsProject, ZohoSprintsItemType, ReportedIssue } from '../types';

/**
 * Zoho Sprints Service
 * Interacts with Zoho Sprints REST API.
 */

const getBaseUrl = (dc: string) => `https://sprintsapi.zoho.${dc}/resourceapi/v1`;

/**
 * Validates Zoho Sprints Credentials by fetching Teams.
 */
export const validateZohoSprintsToken = async (dc: string, token: string): Promise<boolean> => {
  try {
    const response = await fetchWithProxy(`${getBaseUrl(dc)}/teams`, {
      headers: { 'Authorization': `Zoho-oauthtoken ${token}` }
    });
    
    if (response.ok) return true;
    
    if (response.status === 403) {
       const text = await response.text();
       if (text.includes('corsdemo')) throw new Error('corsdemo_required');
    }

    const text = await response.text();
    try {
        const json = JSON.parse(text);
        if (json.message) throw new Error(`Zoho Sprints: ${json.message}`);
    } catch (e) {
        if (e instanceof Error && e.message.startsWith('Zoho Sprints:')) throw e;
    }
    
    if (response.status === 401) {
        throw new Error(`Zoho Auth Failed (401). Ensure Token was generated in the ${dc.toUpperCase()} Console.`);
    }
    
    throw new Error(`Validation Failed (${response.status}). Check Token/Data Center.`);
  } catch (error) {
    if (error instanceof Error) throw error;
    console.error("Zoho Sprints Validation Failed:", error);
    throw new Error("Zoho Sprints Connection Failed");
  }
};

/**
 * Exchanges a Self-Client Authorization Code for an Access Token.
 */
export const exchangeZohoSprintsCodeForToken = async (dc: string, clientId: string, clientSecret: string, code: string): Promise<string> => {
    let accountsUrl = 'https://accounts.zoho.com';
    if (dc === 'eu') accountsUrl = 'https://accounts.zoho.eu';
    if (dc === 'in') accountsUrl = 'https://accounts.zoho.in';
    if (dc === 'com.au') accountsUrl = 'https://accounts.zoho.com.au';
    if (dc === 'jp') accountsUrl = 'https://accounts.zoho.jp';

    const url = `${accountsUrl}/oauth/v2/token`;
    
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'authorization_code');
    
    try {
        const response = await fetchWithProxy(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        if (!response.ok) {
             const text = await response.text();
             if (text.includes('corsdemo')) throw new Error('corsdemo_required');
             throw new Error(`Zoho Token Exchange Failed: ${text}`);
        }

        const data = await response.json();
        if (data.error) {
             throw new Error(`Zoho Exchange Error: ${data.error}`);
        }
        
        return data.access_token;
    } catch (error) {
        console.error("Zoho Sprints Token Exchange Failed:", error);
        throw error;
    }
};

/**
 * Get all teams for the user
 */
export const getZohoSprintsTeams = async (dc: string, token: string): Promise<ZohoSprintsTeam[]> => {
  const response = await fetchWithProxy(`${getBaseUrl(dc)}/teams`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` }
  });

  if (!response.ok) throw new Error(`Failed to fetch teams: ${response.status}`);

  const data = await response.json();
  // Response structure: { loginId: ..., Teams: [...] } or just array? Docs say a map of teams.
  // Based on standard response, usually a list wrapper.
  // Let's assume standard Zoho Sprints list.
  return (data || []).map((t: any) => ({
      id: t.id, // or teamId
      name: t.name
  }));
};

/**
 * Get projects for a team
 */
export const getZohoSprintsProjects = async (dc: string, token: string, teamId: string): Promise<ZohoSprintsProject[]> => {
  const response = await fetchWithProxy(`${getBaseUrl(dc)}/teams/${teamId}/projects`, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` }
  });

  if (!response.ok) throw new Error("Failed to fetch projects");

  const data = await response.json();
  return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name
  }));
};

/**
 * Get Item Types (Bug, Story, etc)
 */
export const getZohoSprintsItemTypes = async (dc: string, token: string, teamId: string, projectId: string): Promise<ZohoSprintsItemType[]> => {
    // Typically item types are project specific or team specific. 
    // Endpoint: /teams/{team_id}/projects/{project_id}/itemtypes
    const response = await fetchWithProxy(`${getBaseUrl(dc)}/teams/${teamId}/projects/${projectId}/itemtypes`, {
        headers: { 'Authorization': `Zoho-oauthtoken ${token}` }
    });

    if (!response.ok) throw new Error("Failed to fetch item types");

    const data = await response.json();
    return (data || []).map((t: any) => ({
        id: t.id,
        name: t.name
    }));
};

/**
 * Create an Item in Zoho Sprints
 */
export const createZohoSprintsItem = async (
  dc: string,
  token: string, 
  teamId: string, 
  projectId: string,
  itemTypeId: string,
  title: string, 
  description: string
) => {
  const url = `${getBaseUrl(dc)}/teams/${teamId}/projects/${projectId}/items`;
  
  const formData = new FormData();
  formData.append('name', title);
  formData.append('description', description); 
  formData.append('itemtypeId', itemTypeId);

  const response = await fetchWithProxy(url, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`
    },
    body: formData
  });

  if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sprints Create Failed: ${text}`);
  }

  const data = await response.json();
  // data usually contains details of created item
  return data[0] || data; // API often returns array for bulk create
};

/**
 * Upload Attachment to Zoho Sprints Item
 */
export const uploadZohoSprintsAttachment = async (dc: string, token: string, teamId: string, projectId: string, itemId: string, fileBlob: Blob, filename: string) => {
  const url = `${getBaseUrl(dc)}/teams/${teamId}/projects/${projectId}/items/${itemId}/attachments`;

  const formData = new FormData();
  formData.append('file', fileBlob, filename);

  const response = await fetchWithProxy(url, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`
    },
    body: formData
  });

  if (!response.ok) throw new Error("Sprints Upload Failed");
  return await response.json();
};

/**
 * Fetch Items for Dashboard
 */
export const fetchZohoSprintsItems = async (dc: string, token: string, teamId: string, projectId: string): Promise<ReportedIssue[]> => {
  // /teams/{team_id}/projects/{project_id}/items
  const url = `${getBaseUrl(dc)}/teams/${teamId}/projects/${projectId}/items?range=1-50`;

  const response = await fetchWithProxy(url, {
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` }
  });

  if (!response.ok) {
     const text = await response.text();
     if (text.includes('corsdemo')) throw new Error('corsdemo_required');
     throw new Error("Failed to fetch Sprints items");
  }

  const data = await response.json();
  
  return (data || []).map((i: any) => ({
      id: i.itemNo || i.id,
      title: i.name,
      platform: 'ZohoSprints' as any,
      status: i.status ? i.status.name : 'Open',
      statusColor: i.status && i.status.type === 'Open' ? '#F06A6A' : '#10b981',
      priority: i.priority ? i.priority.name : 'Normal',
      date: i.createdTime ? new Date(i.createdTime).toLocaleDateString() : 'N/A',
      assignee: i.itemOwner,
      url: i.link || undefined
  }));
};
