/**
 * Google Picker integration.
 *
 * Loads gapi + google.accounts (Identity Services) + google.picker on demand.
 * Returns a function `pickFile()` that:
 *   1. Triggers OAuth token request (drive.readonly, single use, no refresh token)
 *   2. Opens the native Drive picker with that token
 *   3. Resolves with the selected file's id/name/mimeType + the access token
 *
 * Per-session OAuth — no token storage server-side.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";
const GAPI_SRC = "https://apis.google.com/js/api.js";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

export type PickedFile = {
  fileId: string;
  name: string;
  mimeType: string;
  accessToken: string;
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function loadPickerModule(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.gapi?.client && window.google?.picker) {
      resolve();
      return;
    }
    window.gapi.load("picker", { callback: () => resolve(), onerror: () => reject(new Error("Picker load failed")) });
  });
}

async function ensureLoaded() {
  await Promise.all([loadScript(GIS_SRC), loadScript(GAPI_SRC)]);
  await loadPickerModule();
}

function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp: { access_token?: string; error?: string }) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "OAuth failed"));
        } else {
          resolve(resp.access_token);
        }
      },
    });
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

function openPicker(accessToken: string, apiKey: string): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView()
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)
      .setMode(window.google.picker.DocsViewMode.LIST);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((data: any) => {
        const action = data[window.google.picker.Response.ACTION];
        if (action === window.google.picker.Action.PICKED) {
          const doc = data[window.google.picker.Response.DOCUMENTS]?.[0];
          if (doc) {
            resolve({
              fileId: doc[window.google.picker.Document.ID],
              name: doc[window.google.picker.Document.NAME],
              mimeType: doc[window.google.picker.Document.MIME_TYPE],
              accessToken,
            });
          } else {
            resolve(null);
          }
        } else if (action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

export async function pickDriveFile(): Promise<PickedFile | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  if (!clientId || !apiKey) {
    throw new Error("Google Drive not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID + NEXT_PUBLIC_GOOGLE_API_KEY.");
  }
  await ensureLoaded();
  const accessToken = await requestAccessToken(clientId);
  return openPicker(accessToken, apiKey);
}
