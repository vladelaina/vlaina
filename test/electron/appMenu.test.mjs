import { describe, expect, it, vi } from 'vitest';
import { buildApplicationMenuTemplate, installApplicationMenu } from '../../electron/appMenu.mjs';

describe('app menu', () => {
  it('builds a macOS application menu with standard system roles first', () => {
    const template = buildApplicationMenuTemplate({ isMac: true, appName: 'vlaina' });

    expect(template[0].label).toBe('vlaina');
    expect(template[0].submenu.map((item) => item.role ?? item.type)).toEqual([
      'about',
      'separator',
      'services',
      'separator',
      'hide',
      'hideOthers',
      'unhide',
      'separator',
      'quit',
    ]);
    expect(template[1].label).toBe('File');
    expect(template[1].submenu[0]).toMatchObject({
      label: 'Open Markdown File...',
      accelerator: 'CmdOrCtrl+O',
    });
    expect(template[2].submenu.map((item) => item.role ?? item.type)).toContain('pasteAndMatchStyle');
    expect(template[4].submenu.map((item) => item.role ?? item.type)).toContain('front');
  });

  it('keeps non-macOS menus in a conventional file/edit/view/window order', () => {
    const template = buildApplicationMenuTemplate({ isMac: false, appName: 'vlaina' });

    expect(template.map((item) => item.label ?? item.role)).toEqual([
      'File',
      'Edit',
      'View',
      'Window',
      'help',
    ]);
    expect(template[0].submenu.map((item) => item.role ?? item.type ?? item.label)).toEqual([
      'Open Markdown File...',
      'separator',
      'quit',
    ]);
    expect(template[3].submenu.map((item) => item.role ?? item.type)).toContain('close');
  });

  it('installs the built template through Electron Menu with the open-file callback', () => {
    const builtMenu = {};
    const onOpenMarkdownFile = vi.fn();
    const Menu = {
      buildFromTemplate: vi.fn(() => builtMenu),
      setApplicationMenu: vi.fn(),
    };

    expect(installApplicationMenu({
      Menu,
      app: { getName: () => 'vlaina' },
      platform: 'darwin',
      onOpenMarkdownFile,
    })).toBe(true);

    expect(Menu.buildFromTemplate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ label: 'vlaina' }),
      expect.objectContaining({
        label: 'File',
        submenu: expect.arrayContaining([
          expect.objectContaining({ click: onOpenMarkdownFile }),
        ]),
      }),
    ]));
    expect(Menu.setApplicationMenu).toHaveBeenCalledWith(builtMenu);
  });
});
