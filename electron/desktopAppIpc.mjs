import fs from 'node:fs';

export function registerDesktopAppIpc({
  app,
  assertTrustedIpcSender,
  errorLogService,
  handleIpc,
  ipcMain,
  openPathInFileManager,
  trayController,
}) {
  handleIpc('desktop:get-version', async () => {
    return app.getVersion();
  });

  handleIpc('desktop:app:set-language', async (_event, language) => {
    return trayController.setTrayLanguage(language);
  });

  handleIpc('desktop:app:get-error-log-info', async () => {
    return errorLogService.getInfo();
  });

  handleIpc('desktop:app:open-error-log-folder', async () => {
    const { logsDir } = errorLogService.getInfo();
    fs.mkdirSync(logsDir, { recursive: true });
    await openPathInFileManager(logsDir);
  });

  handleIpc('desktop:app:report-renderer-error', async (_event, payload) => {
    const logFilePath = errorLogService.logRendererError(payload, 'renderer-reported-error');
    return {
      ...errorLogService.getInfo(),
      logFilePath,
    };
  });

  ipcMain.on('desktop:app:report-renderer-error', (event, payload) => {
    try {
      assertTrustedIpcSender(event);
      errorLogService.logRendererError(payload, 'renderer-global-error');
    } catch (error) {
      errorLogService.logMainError(error, 'renderer-error-report-blocked');
    }
  });
}
