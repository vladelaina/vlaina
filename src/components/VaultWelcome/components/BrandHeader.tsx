/**
 * BrandHeader - Logo and app name with version (horizontal layout, left aligned)
 */

import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';

// Use the 128x128 icon from tauri icons
const logoSrc = '/src-tauri/icons/128x128.png';

export function BrandHeader() {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(''));
  }, []);

  return (
    <div className="vault-brand">
      <div className="vault-brand__header">
        <img
          src={logoSrc}
          alt="NekoTick"
          className="vault-brand__logo"
        />
        <div className="vault-brand__text">
          <h1 className="vault-brand__name">NekoTick</h1>
          {version && <span className="vault-brand__version">v{version}</span>}
        </div>
      </div>
    </div>
  );
}
