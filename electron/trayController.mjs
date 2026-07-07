const supportedTrayLanguages = new Set([
  'en',
  'zh-CN',
  'zh-Hant',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'pt-BR',
  'it',
  'ru',
  'tr',
  'vi',
  'id',
  'th',
]);

const trayMessages = {
  en: { open: 'Open vlaina', quit: 'Quit' },
  'zh-CN': { open: '打开 vlaina', quit: '退出' },
  'zh-Hant': { open: '開啟 vlaina', quit: '結束' },
  ja: { open: 'vlaina を開く', quit: '終了' },
  ko: { open: 'vlaina 열기', quit: '종료' },
  fr: { open: 'Ouvrir vlaina', quit: 'Quitter' },
  de: { open: 'vlaina öffnen', quit: 'Beenden' },
  es: { open: 'Abrir vlaina', quit: 'Salir' },
  'pt-BR': { open: 'Abrir vlaina', quit: 'Sair' },
  it: { open: 'Apri vlaina', quit: 'Esci' },
  ru: { open: 'Открыть vlaina', quit: 'Выйти' },
  tr: { open: 'vlaina aç', quit: 'Çık' },
  vi: { open: 'Mở vlaina', quit: 'Thoát' },
  id: { open: 'Buka vlaina', quit: 'Keluar' },
  th: { open: 'เปิด vlaina', quit: 'ออก' },
};

export function createTrayController({
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  appIconPath,
  trayIconSize,
  showMainWindow,
}) {
  let tray = null;
  let trayQuitRequested = false;
  let trayLanguage = 'en';

  const requestTrayQuit = () => {
    trayQuitRequested = true;

    const windows = BrowserWindow.getAllWindows().filter((window) => !window.isDestroyed());
    if (windows.length === 0) {
      app.quit();
      return;
    }

    for (const window of windows) {
      window.close();
    }
  };

  const getTrayMessages = () => trayMessages[trayLanguage] ?? trayMessages.en;

  const setTrayContextMenu = () => {
    if (!tray) return;
    const messages = getTrayMessages();
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: messages.open,
        click: showMainWindow,
      },
      { type: 'separator' },
      {
        label: messages.quit,
        click: requestTrayQuit,
      },
    ]));
  };

  const setTrayLanguage = (language) => {
    if (!supportedTrayLanguages.has(language)) return false;
    trayLanguage = language;
    setTrayContextMenu();
    return true;
  };

  const createTrayIcon = () => {
    const icon = nativeImage.createFromPath(appIconPath);
    if (icon.isEmpty()) {
      return appIconPath;
    }

    const trayIcon = icon.resize({
      width: trayIconSize,
      height: trayIconSize,
      quality: 'best',
    });
    return trayIcon;
  };

  const createTray = () => {
    if (tray) return;

    try {
      tray = new Tray(createTrayIcon());
      tray.setToolTip('vlaina');
      setTrayContextMenu();
      tray.on('click', showMainWindow);
    } catch (error) {
      tray = null;
    }
  };

  return {
    createTray,
    isTrayQuitRequested: () => trayQuitRequested,
    setTrayLanguage,
  };
}
