import { PublicClientApplication, Configuration, AuthenticationResult } from "@azure/msal-browser";

// Configuration for MSAL
// You need to register an app in Azure Portal to get a Client ID
// https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
const getClientId = () => {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MICROSOFT_CLIENT_ID) {
        // @ts-ignore
        return import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    }
    // Fallback or placeholder - User needs to provide this
    return "YOUR_MICROSOFT_CLIENT_ID";
};

const CLIENT_ID = getClientId();

const msalConfig: Configuration = {
    auth: {
        clientId: CLIENT_ID,
        authority: "https://login.microsoftonline.com/common", // "common" for multi-tenant and personal accounts
        redirectUri: window.location.origin, // Must be registered in Azure Portal
    },
    cache: {
        cacheLocation: "sessionStorage", // This configures where your cache will be stored
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
    }
};

let msalInstance: PublicClientApplication | null = null;

const getMsalInstance = async () => {
    if (!msalInstance) {
        msalInstance = new PublicClientApplication(msalConfig);
        await msalInstance.initialize();
    }
    return msalInstance;
};

/**
 * Flow Step 1: User signs in with Microsoft
 * Scope: User.Read (Profile), Files.ReadWrite (OneDrive)
 */
export const requestMicrosoftToken = async (): Promise<string> => {
    try {
        const msal = await getMsalInstance();

        const loginRequest = {
            scopes: ["User.Read", "Files.ReadWrite"]
        };

        try {
            // Try popup login
            const response: AuthenticationResult = await msal.loginPopup(loginRequest);
            return response.accessToken;
        } catch (e) {
            console.error("Microsoft Login Popup Failed", e);
            throw e;
        }
    } catch (error) {
        console.error("MSAL Initialization Failed", error);
        throw error;
    }
};

/**
 * Optional: Get User Profile
 */
export const getMicrosoftProfile = async (token: string) => {
    const headers = new Headers();
    const bearer = `Bearer ${token}`;

    headers.append("Authorization", bearer);

    const options = {
        method: "GET",
        headers: headers
    };

    const graphEndpoint = "https://graph.microsoft.com/v1.0/me";

    try {
        const response = await fetch(graphEndpoint, options);
        return await response.json();
    } catch (error) {
        console.error(error);
        throw error;
    }
};
