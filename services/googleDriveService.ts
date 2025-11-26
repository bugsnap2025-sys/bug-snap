
import { fetchWithProxy } from './proxyService';

// Reusing the Client ID from App.tsx
const CLIENT_ID = "1070648127842-br5nqmcsqq2ufbd4hpajfu8llu0an9t8.apps.googleusercontent.com";

/**
 * Requests a Google Drive Access Token using the GIS Client.
 * Requires the script https://accounts.google.com/gsi/client to be loaded.
 */
export const requestDriveToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
        reject(new Error("Google Sign-In script not loaded"));
        return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            resolve(tokenResponse.access_token);
          } else {
            reject(new Error("Failed to get Drive token"));
          }
        },
      });
      client.requestAccessToken();
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * Uploads a file to Google Drive.
 * Returns the shareable link (webViewLink).
 */
export const uploadToDrive = async (token: string, fileBlob: Blob, filename: string): Promise<{ webViewLink: string, id: string }> => {
    const metadata = {
        name: filename,
        mimeType: fileBlob.type
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileBlob);

    // Note: Google Drive API usually supports CORS. We try direct fetch first.
    try {
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: form
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Drive Upload Error: ${response.status} - ${text}`);
        }

        const data = await response.json();
        
        // IMPORTANT: By default, files uploaded by service accounts or via API might be private.
        // We usually need to set permissions to 'anyone with link' or similar if we want to share it easily,
        // or rely on the user being logged into the same account.
        // Since `drive.file` scope allows full access to created files, we can try to set permission.
        
        try {
            await makeFileReadable(token, data.id);
        } catch (permErr) {
            console.warn("Could not set public permission on Drive file", permErr);
        }

        return { webViewLink: data.webViewLink, id: data.id };

    } catch (error) {
        console.error("Drive Upload Failed:", error);
        throw error;
    }
};

const makeFileReadable = async (token: string, fileId: string) => {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
    await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            role: 'reader',
            type: 'anyone'
        })
    });
};
