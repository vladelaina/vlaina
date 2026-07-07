import type { ReactNode } from 'react';
import { getElectronBridge } from '@/lib/electron/bridge';
import { safeTranslate } from './errorBoundaryMessages';

function isNativeMacOS() {
  return (
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  );
}

function shouldPreviewMacOSChrome() {
  return (
    import.meta.env.DEV &&
    !isNativeMacOS() &&
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-vlaina-dev-platform-preview') === 'macos'
  );
}

function ErrorWindowButton({
  children,
  className = '',
  label,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`app-no-drag flex h-10 w-12 items-center justify-center text-sm text-foreground/75 transition-colors hover:bg-muted hover:text-foreground ${className}`}
    >
      {children}
    </button>
  );
}

function ErrorMacOSTrafficLightControls() {
  const buttonClass =
    'app-no-drag h-3 w-3 rounded-full border border-black/15 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.35)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vlaina-color-accent-focus-ring)]';

  return (
    <div className="absolute left-3 top-0 z-[var(--vlaina-z-60)] flex h-10 items-center gap-2">
      <button
        type="button"
        aria-label={safeTranslate('common.closeWindow')}
        onClick={() => void getElectronBridge()?.window?.close?.()}
        className={`${buttonClass} bg-[#ff5f57]`}
      />
      <button
        type="button"
        aria-label={safeTranslate('common.minimizeWindow')}
        onClick={() => void getElectronBridge()?.window?.minimize?.()}
        className={`${buttonClass} bg-[#febc2e]`}
      />
      <button
        type="button"
        aria-label={safeTranslate('common.maximizeWindow')}
        onClick={() => void getElectronBridge()?.window?.toggleMaximize?.()}
        className={`${buttonClass} bg-[#28c840]`}
      />
    </div>
  );
}

export function ErrorWindowChrome() {
  const nativeMacOS = isNativeMacOS();
  const showMacOSPreview = shouldPreviewMacOSChrome();
  const useMacOSLayout = nativeMacOS || showMacOSPreview;

  return (
    <div className="app-drag-region app-title-bar relative flex h-10 shrink-0 select-none items-center bg-background/95">
      {showMacOSPreview ? <ErrorMacOSTrafficLightControls /> : null}
      <div className={useMacOSLayout ? 'w-[var(--vlaina-space-76px)]' : 'w-3'} />
      <div className="min-w-0 flex-1" />
      {!useMacOSLayout ? (
        <div className="app-no-drag flex shrink-0">
          <ErrorWindowButton
            label={safeTranslate('common.minimizeWindow')}
            onClick={() => void getElectronBridge()?.window?.minimize?.()}
          >
            -
          </ErrorWindowButton>
          <ErrorWindowButton
            label={safeTranslate('common.maximizeWindow')}
            onClick={() => void getElectronBridge()?.window?.toggleMaximize?.()}
          >
            □
          </ErrorWindowButton>
          <ErrorWindowButton
            label={safeTranslate('common.closeWindow')}
            onClick={() => void getElectronBridge()?.window?.close?.()}
            className="hover:bg-[var(--vlaina-color-danger)] hover:text-[var(--vlaina-color-white)]"
          >
            ×
          </ErrorWindowButton>
        </div>
      ) : null}
    </div>
  );
}
