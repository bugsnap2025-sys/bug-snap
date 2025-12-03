
import { fetchWithProxy } from './proxyService';
import { TrelloBoard, TrelloList, ReportedIssue } from '../types';

const TRELLO_API_BASE = 'https://api.trello.com/1';

const getAuthParams = (key: string, token: string) => `key=${key}&token=${token}`;

/**
 * Validate Trello Credentials by fetching the current member.
 */
export const validateTrelloCredentials = async (key: string, token: string): Promise<boolean> => {
  try {
    const response = await fetchWithProxy(`${TRELLO_API_BASE}/members/me?${getAuthParams(key, token)}`);
    
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
    console.error("Trello Validation Failed:", error);
    return false;
  }
};

/**
 * Fetch open boards for the authenticated user.
 */
export const getTrelloBoards = async (key: string, token: string): Promise<TrelloBoard[]> => {
  const response = await fetchWithProxy(`${TRELLO_API_BASE}/members/me/boards?filter=open&fields=name,url&${getAuthParams(key, token)}`);

  if (!response.ok) {
     const text = await response.text();
     if (text.includes('corsdemo')) throw new Error('corsdemo_required');
     throw new Error(`Failed to fetch Trello boards: ${response.status}`);
  }

  const data = await response.json();
  return data.map((b: any) => ({
      id: b.id,
      name: b.name,
      url: b.url
  }));
};

/**
 * Fetch open lists on a specific board.
 */
export const getTrelloLists = async (key: string, token: string, boardId: string): Promise<TrelloList[]> => {
  const response = await fetchWithProxy(`${TRELLO_API_BASE}/boards/${boardId}/lists?filter=open&fields=name&${getAuthParams(key, token)}`);

  if (!response.ok) throw new Error("Failed to fetch Trello lists");

  const data = await response.json();
  return data.map((l: any) => ({
      id: l.id,
      name: l.name
  }));
};

/**
 * Create a Card in Trello.
 */
export const createTrelloCard = async (
  key: string,
  token: string,
  listId: string, 
  name: string, 
  desc: string
) => {
  const url = `${TRELLO_API_BASE}/cards?idList=${listId}&${getAuthParams(key, token)}`;
  
  // Note: Trello API accepts query params for simple fields, but also JSON body.
  // Using JSON body for description to handle newlines/length better.
  const payload = {
      name,
      desc
  };

  const response = await fetchWithProxy(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
      const text = await response.text();
      throw new Error(`Trello Create Failed: ${text}`);
  }

  return await response.json(); // Returns created card object
};

/**
 * Upload Attachment to Trello Card.
 */
export const uploadTrelloAttachment = async (key: string, token: string, cardId: string, fileBlob: Blob, filename: string) => {
  // Use FormData for file upload
  const formData = new FormData();
  formData.append('file', fileBlob, filename);
  // Key/Token usually passed as query params for Trello even with POST, but can also go in body. 
  // Query params is safer for Trello's specific multipart handling via proxy.
  const url = `${TRELLO_API_BASE}/cards/${cardId}/attachments?${getAuthParams(key, token)}`;

  const response = await fetchWithProxy(url, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) throw new Error("Trello Upload Failed");
  return await response.json();
};

/**
 * Fetch Cards for Dashboard.
 * Fetches "My Cards" (assigned to me) across all boards.
 */
export const fetchTrelloCards = async (key: string, token: string): Promise<ReportedIssue[]> => {
  const response = await fetchWithProxy(`${TRELLO_API_BASE}/members/me/cards?filter=visible&fields=name,shortUrl,dateLastActivity,due&${getAuthParams(key, token)}`);

  if (!response.ok) {
     const text = await response.text();
     if (text.includes('corsdemo')) throw new Error('corsdemo_required');
     throw new Error("Failed to fetch Trello cards");
  }

  const data = await response.json();
  
  return data.map((c: any) => ({
      id: c.id, // Trello uses alphanumeric IDs
      title: c.name,
      platform: 'Trello',
      status: 'Open', // Trello doesn't have statuses, just lists. Assuming open if fetched.
      statusColor: '#0079BF',
      priority: c.due ? 'High' : 'Normal', // Simple logic: if due date, it's high priority
      date: c.dateLastActivity ? new Date(c.dateLastActivity).toLocaleDateString() : 'N/A',
      assignee: 'Me',
      url: c.shortUrl
  }));
};
