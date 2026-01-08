/**
 * BrandHeader - Logo and app name with version
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
      <img 
        src={logoSrc} 
        alt="NekoTick" 
        className="vault-brand__logo"
      />
      <h1 className="vault-brand__name">NekoTick</h1>
      <p className="vault-brand__tagline">
        {version ? `v${version}` : ''}
      </p>
    </div>
  );
}
