import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { themeContextMenuTokens } from '@/styles/themeTokens';

export interface ContextMenuPosition {
  left: number;
  top: number;
}

export function clampContextMenuPosition(
  position: ContextMenuPosition,
  width: number,
  height: number,
): ContextMenuPosition {
  const margin = themeContextMenuTokens.viewportMargin;
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  return {
    left: Math.min(Math.max(margin, position.left), maxLeft),
    top: Math.min(Math.max(margin, position.top), maxTop),
  };
}

export function getContextMenuShortcutLabel(
  keys: string,
  platform = typeof navigator === 'undefined' ? '' : navigator.platform,
): string {
  if (/Mac|iPhone|iPad/.test(platform)) {
    return keys
      .replace('Ctrl', '⌘')
      .replaceAll('+Shift', '⇧')
      .replaceAll('+Alt', '⌥')
      .replaceAll('+', '');
  }
  return keys;
}

function MenuShortcut({ keys }: { keys?: string }) {
  return keys ? <span className="editor-context-menu-shortcut">{getContextMenuShortcutLabel(keys)}</span> : null;
}

export function MenuDivider() {
  return <div className="editor-context-menu-divider" role="separator" />;
}

export function MenuItem({
  icon,
  label,
  shortcut,
  disabled = false,
  checked,
  onSelect,
}: {
  icon?: ReactNode;
  label: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      aria-label={typeof label === 'string' ? label : undefined}
      disabled={disabled}
      className={cn('editor-context-menu-item', disabled && 'editor-context-menu-item-disabled')}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onSelect();
      }}
    >
      <span className="editor-context-menu-item-leading">
        {checked ? <span className="editor-context-menu-check">✓</span> : icon}
      </span>
      <span className="editor-context-menu-item-label">{label}</span>
      <MenuShortcut keys={shortcut} />
    </button>
  );
}

export function Submenu({
  label,
  children,
  open,
  onOpen,
  onClose,
}: {
  label: ReactNode;
  children: ReactNode;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const triggerElementRef = useRef<HTMLButtonElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [position, setPosition] = useState<ContextMenuPosition>({ left: 0, top: 0 });

  const scheduleClose = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(onClose, themeContextMenuTokens.closeDelayMs);
  };

  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useLayoutEffect(() => {
    if (!open || !submenuRef.current) return;
    const update = () => {
      const trigger = triggerElementRef.current?.getBoundingClientRect();
      const submenu = submenuRef.current;
      if (!trigger || !submenu) return;
      const { submenuGap, viewportMargin } = themeContextMenuTokens;
      const openLeft = window.innerWidth - trigger.right - submenuGap - viewportMargin < submenu.offsetWidth;
      const rawLeft = openLeft
        ? trigger.left - submenuGap - submenu.offsetWidth
        : trigger.right + submenuGap;
      setPosition(clampContextMenuPosition({ left: rawLeft, top: trigger.top }, submenu.offsetWidth, submenu.offsetHeight));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  return (
    <div
      className="editor-context-menu-submenu-trigger"
      onMouseEnter={() => {
        cancelClose();
        onOpen();
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={triggerElementRef}
        type="button"
        role="menuitem"
        aria-label={typeof label === 'string' ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn('editor-context-menu-item', open && 'editor-context-menu-item-active')}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (open) onClose(); else onOpen();
        }}
      >
        <span className="editor-context-menu-item-leading" />
        <span className="editor-context-menu-item-label">{label}</span>
        <span className="editor-context-menu-arrow" aria-hidden="true">›</span>
      </button>
      {open
        ? createPortal(
            <div
              ref={submenuRef}
              role="menu"
              data-note-context-menu-layer="true"
              className="editor-context-menu editor-context-menu-submenu"
              style={{ left: position.left, top: position.top }}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function IconButton({
  icon,
  label,
  shortcut,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const shortcutLabel = shortcut ? getContextMenuShortcutLabel(shortcut) : null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          'editor-context-menu-icon-trigger',
          disabled && 'editor-context-menu-icon-trigger-disabled',
        )}>
          <button
            type="button"
            role="menuitem"
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            className={cn(
              'editor-context-menu-icon-button',
              active && 'editor-context-menu-icon-button-active',
              disabled && 'editor-context-menu-item-disabled',
            )}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!disabled) onClick();
            }}
          >
            <Icon name={icon} size="sm" />
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={themeContextMenuTokens.tooltipOffset}
        showArrow={false}
        className="editor-context-menu-icon-tooltip"
      >
        <span>{label}</span>
        {shortcutLabel ? <kbd>{shortcutLabel}</kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}
