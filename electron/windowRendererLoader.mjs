import path from 'node:path';

export function buildRendererUrl(rendererDevUrl, windowOptions = {}) {
  const url = new URL(rendererDevUrl);
  const params = new URLSearchParams();

  params.set('newWindow', 'true');

  if (windowOptions.notesRootPath) {
    params.set('notesRootPath', windowOptions.notesRootPath);
  }

  if (windowOptions.notePath) {
    params.set('notePath', windowOptions.notePath);
  }

  if (windowOptions.folderPath) {
    params.set('folderPath', windowOptions.folderPath);
  }

  if (windowOptions.chatSessionId) {
    params.set('chatSessionId', windowOptions.chatSessionId);
  }

  if (windowOptions.viewMode) {
    params.set('viewMode', windowOptions.viewMode);
  }

  url.search = params.toString();
  return url.toString();
}

export async function loadRenderer({
  window,
  windowOptions = {},
  rendererDevUrl,
  electronDirname,
  isDevelopment,
  isUsableWindow,
}) {
  if (!isUsableWindow(window)) {
    return;
  }

  if (isDevelopment()) {
    const url = windowOptions.newWindow ? buildRendererUrl(rendererDevUrl, windowOptions) : rendererDevUrl;
    await window.loadURL(url);
    return;
  }

  const rendererFile = path.join(electronDirname, '..', 'dist', 'index.html');

  if (windowOptions.newWindow) {
    await window.loadFile(rendererFile, {
      search: new URLSearchParams({
        newWindow: 'true',
        ...(windowOptions.notesRootPath ? { notesRootPath: windowOptions.notesRootPath } : {}),
        ...(windowOptions.notePath ? { notePath: windowOptions.notePath } : {}),
        ...(windowOptions.folderPath ? { folderPath: windowOptions.folderPath } : {}),
        ...(windowOptions.chatSessionId ? { chatSessionId: windowOptions.chatSessionId } : {}),
        ...(windowOptions.viewMode ? { viewMode: windowOptions.viewMode } : {}),
      }).toString(),
    });
    return;
  }

  await window.loadFile(rendererFile);
}
