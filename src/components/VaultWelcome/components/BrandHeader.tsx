/**
 * BrandHeader - Logo and app name
 */

// Use the 128x128 icon from tauri icons
const logoSrc = '/src-tauri/icons/128x128.png';

export function BrandHeader() {
  return (
    <div className="vault-brand">
      <img 
        src={logoSrc} 
        alt="NekoTick" 
        className="vault-brand__logo"
      />
      <h1 className="vault-brand__name">NekoTick</h1>
      <p className="vault-brand__tagline">Your thoughts, organized</p>
    </div>
  );
}
