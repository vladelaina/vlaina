/**
 * BrandHeader - Logo and app name with version (horizontal layout, left aligned)
 */

import { useState, useEffect } from 'react';
import { isTauri } from '@/lib/storage/adapter';

// Logo path - works in both Tauri and Web environments
const logoSrc = '/logo.png';

export function BrandHeader() {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    if (isTauri()) {
      import('@tauri-apps/api/app').then(({ getVersion }) => {
        getVersion().then(setVersion).catch(() => setVersion(''));
      });
    } else {
      // Web version - use package.json version or leave empty
      setVersion('web');
    }
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