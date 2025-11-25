
import { fetchWithProxy } from './proxyService';
import { ZohoPortal, ZohoProject, ReportedIssue } from '../types';

/**
 * Zoho Projects Service
 * Interacts with Zoho Projects REST API.
 * Note: Zoho requires OAuth tokens which expire. For this client-side app,
 * we rely on the user providing a valid Access Token (e.g. from Self-Client).
 */

const getBaseUrl = (dc: string) => `https://projectsapi.zoho.${dc}/restapi`;

/**
 * Validates Zoho Credentials by fetching Portals.
 */
export const validateZohoToken = async (dc: string, token: string): Promise<boolean> => {
  try {
    const response = await fetchWithProxy(`${getBaseUrl(dc)}/portals/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) return true;
    
    if (response.status === 403) {
       const text = await response.text();
       if (text.includes('corsdemo')) throw new Error('corsdemo_required');
    }

    // Parse specific Zoho errors
    const text = await response.text();
    try {
        const json = JSON.parse(text);
        if (json.error && typeof json.error === 'string') throw new Error(`Zoho: ${json.error}`);
        if (json.message) throw new Error(`Zoho: ${json.message}`);
    } catch (e) {
        // If parsing fails, check for specific known strings
        if (e instanceof Error && e.message.startsWith('Zoho:')) throw e;
    }
    
    if (response.status === 401) {
        throw new Error(`Zoho Auth Failed (401). Ensure Token was generated in the ${dc.toUpperCase()} Console.`);
    }
    
    throw new Error(`Zoho Validation Failed (${response.status}). Check Token/Data Center.`);
  } catch (error) {
    if (error instanceof Error) throw error; // Propagate specific errors
    console.error("Zoho Validation Failed:", error);
    throw new Error("Zoho Connection Failed");
  }
};

/**
 * Exchanges a Self-Client Authorization Code for an Access Token.
 */
export const exchangeZohoCodeForToken = async (dc: string, clientId: string, clientSecret: string, code: string): Promise<string> => {
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
    // Note: redirect_uri is typically optional for Self-Client codes, or assumed to be the console.
    
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
             
             try {
                const json = JSON.parse(text);
                if (json.error) throw new Error(`Zoho Exchange Error: ${json.error}`);
             } catch(e) { /* ignore */ }
             
             throw new Error(`Zoho Token Exchange Failed: ${text}`);
        }

        const data = await response.json();
        if (data.error) {
             throw new Error(`Zoho Exchange Error: ${data.error}`);
        }
        
        return data.access_token;
    } catch (error) {
        console.error("Zoho Token Exchange Failed:", error);
        throw error;
    }
};

/**
 * Get all portals for the user
 */
export const getZohoPortals = async (dc: string, token: string): Promise<ZohoPortal[]> => {
  const response = await fetchWithProxy(`${getBaseUrl(dc)}/portals/`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
     const text = await response.text();
     if (text.includes('corsdemo')) throw new Error('corsdemo_required');
     throw new Error(`Failed to fetch Zoho portals: ${response.status}`);
  }

  const data = await response.json();
  return (data.portals || []).map((p: any) => ({
      id: p.id_string || p.id,
      name: p.name
  }));
};

/**
 * Get projects for a portal
 */
export const getZohoProjects = async (dc: string, token: string, portalId: string): Promise<ZohoProject[]> => {
  const response = await fetchWithProxy(`${getBaseUrl(dc)}/portal/${portalId}/projects/`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) throw new Error("Failed to fetch Zoho projects");

  const data = await response.json();
  return (data.projects || []).map((p: any) => ({
      id: p.id_string || p.id,
      name: p.name
  }));
};

/**
 * Create a Bug in Zoho Projects
 */
export const createZohoBug = async (
  dc: string,
  token: string, 
  portalId: string, 
  projectId: string, 
  title: string, 
  description: string
) => {
  const url = `${getBaseUrl(dc)}/portal/${portalId}/projects/${projectId}/bugs/`;
  
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description); 
  // Optional: formData.append('classification_id', '...'); // e.g. Bug type

  const response = await fetchWithProxy(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Content-Type automatic
    },
    body: formData
  });

  if (!response.ok) {
      const text = await response.text();
      throw new Error(`Zoho Create Failed: ${text}`);
  }

  const data = await response.json();
  return data.bugs ? data.bugs[0] : data; // { id, title, link }
};

/**
 * Upload Attachment to Zoho Bug
 */
export const uploadZohoAttachment = async (dc: string, token: string, portalId: string, projectId: string, bugId: string, fileBlob: Blob, filename: string) => {
  const url = `${getBaseUrl(dc)}/portal/${portalId}/projects/${projectId}/bugs/${bugId}/attachments/`;

  const formData = new FormData();
  formData.append('uploaddoc', fileBlob, filename);

  const response = await fetchWithProxy(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) throw new Error("Zoho Upload Failed");
  return await response.json();
};

/**
 * Fetch Bugs for Dashboard
 */
export const fetchZohoBugs = async (dc: string, token: string, portalId: string, projectId: string): Promise<ReportedIssue[]> => {
  // Need to fetch projects first if projectId is not saved, but dashboard usually handles context.
  // Assuming we fetch 'My Bugs' or bugs from default project.
  // API: /portal/{portal_id}/projects/{project_id}/bugs/
  
  const url = `${getBaseUrl(dc)}/portal/${portalId}/projects/${projectId}/bugs/`;

  const response = await fetchWithProxy(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
     const text = await response.text();
     if (text.includes('corsdemo')) throw new Error('corsdemo_required');
     throw new Error("Failed to fetch Zoho bugs");
  }

  const data = await response.json();
  
  return (data.bugs || []).map((b: any) => ({
      id: b.id_string || b.id,
      title: b.title,
      platform: 'Zoho',
      status: b.status ? b.status.name : 'Open',
      statusColor: b.status && b.status.type === 'Open' ? '#F06A6A' : '#10b981',
      priority: b.severity ? b.severity.name : 'Normal',
      date: b.created_time_long ? new Date(b.created_time_long).toLocaleDateString() : 'N/A',
      assignee: b.assignee_name,
      url: b.link ? b.link.self : undefined // Link might need construction based on portal settings
  }));
};
