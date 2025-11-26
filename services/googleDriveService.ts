
// Reusing the Client ID from App.tsx or Environment
// NOTE: If you see a 403 'accessNotConfigured' error, it means the Google Drive API 
// is not enabled in the Google Cloud Console for this Client ID.
// You must enable "Google Drive API" in your project: https://console.cloud.google.com/apis/library/drive.googleapis.com
const getClientId = () => {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        // @ts-ignore
        return import.meta.env.VITE_GOOGLE_CLIENT_ID;
    }
    return "1070648127842-br5nqmcsqq2ufbd4hpajfu8llu0an9t8.apps.googleusercontent.com";
};

const CLIENT_ID = getClientId();

/**
 * Flow Step 1: User signs in with Google (OAuth 2.0)
 * Scope: https://www.googleapis.com/auth/drive.file
 * Only allows app to create files it owns (safe)
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
            reject(new Error("Failed to get Drive token: User cancelled or error occurred."));
          }
        },
      });
      
      // Request access token (Incremental Auth)
      client.requestAccessToken();
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * Flow Step 2 & 3: Upload file -> Get File ID -> Make public -> Generate Link
 */
export const uploadToDrive = async (token: string, fileBlob: Blob, filename: string): Promise<{ webViewLink: string, id: string }> => {
    // 1. Prepare Metadata
    const metadata = {
        name: filename,
        mimeType: fileBlob.type
    };

    // 2. Prepare Multipart Body
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileBlob);

    try {
        // 3. Upload File
        const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: form
        });

        if (!response.ok) {
            const text = await response.text();
            // Handle API Disabled Error specifically
            if (text.includes('accessNotConfigured')) {
                throw new Error(`Google Drive API is not enabled for this project. Please enable it in Google Cloud Console.`);
            }
            throw new Error(`Drive Upload Error (${response.status}): ${text}`);
        }

        const data = await response.json();
        const fileId = data.id;

        // 4. Make it public via permissions API
        // This is required so the link works in ClickUp/Jira without requiring login there
        await makeFilePublic(token, fileId);

        return { webViewLink: data.webViewLink, id: fileId };

    } catch (error) {
        console.error("Drive Flow Failed:", error);
        throw error;
    }
};

/**
 * Flow Step 3: Make it public via permissions API
 */
const makeFilePublic = async (token: string, fileId: string) => {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
    
    const response = await fetch(url, {
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

    if (!response.ok) {
        const text = await response.text();
        console.warn("Failed to set public permission on Drive file:", text);
        // We don't throw here to ensure the upload itself isn't considered a total failure, 
        // but the link might be private.
    }
};
