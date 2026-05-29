export function buildApplicationMenuTemplate({
  isMac = process.platform === 'darwin',
  appName = 'vlaina',
  onOpenMarkdownFile,
} = {}) {
  const fileMenu = {
    label: 'File',
    submenu: [
      {
        label: 'Open Markdown File...',
        accelerator: 'CmdOrCtrl+O',
        click: onOpenMarkdownFile,
      },
      { type: 'separator' },
      ...(isMac
        ? [{ role: 'close' }]
        : [{ role: 'quit' }]),
    ],
  };

  const editMenu = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteAndMatchStyle' },
      { role: 'delete' },
      { role: 'selectAll' },
    ],
  };

  const viewMenu = {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  };

  const windowMenu = {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac
        ? [
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' },
          ]
        : [
            { role: 'close' },
          ]),
    ],
  };

  const helpMenu = {
    role: 'help',
    submenu: [],
  };

  if (!isMac) {
    return [
      fileMenu,
      editMenu,
      viewMenu,
      windowMenu,
      helpMenu,
    ];
  }

  return [
    {
      label: appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    fileMenu,
    editMenu,
    viewMenu,
    windowMenu,
    helpMenu,
  ];
}

export function installApplicationMenu({
  Menu,
  app,
  platform = process.platform,
  onOpenMarkdownFile,
} = {}) {
  if (!Menu) {
    return false;
  }

  const isMac = platform === 'darwin';
  const appName = typeof app?.getName === 'function' ? app.getName() : 'vlaina';
  const template = buildApplicationMenuTemplate({ isMac, appName, onOpenMarkdownFile });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  return true;
}
