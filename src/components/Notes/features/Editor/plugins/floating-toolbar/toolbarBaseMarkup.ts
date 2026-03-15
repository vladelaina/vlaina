import type { BlockType, FloatingToolbarState, TextAlignment } from './types';
import type { ToolbarButtonConfig, ToolbarGroupKey, ToolbarLayout } from './toolbarConfig';
import { EXTRA_BUTTONS, FORMAT_BUTTONS, TOOLBAR_LAYOUTS } from './toolbarConfig';
import { EDITOR_ICONS } from '@/components/ui/icons/editor-svgs';

const IS_MAC =
  typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function toPlatformShortcutLabel(shortcut: string): string {
  if (!IS_MAC) {
    return shortcut;
  }

  return shortcut
    .replace(/\bCtrl\b/g, '⌘')
    .replace(/\bControl\b/g, '⌘')
    .replace(/\bAlt\b/g, '⌥')
    .replace(/\bOption\b/g, '⌥');
}

function renderButton(
  config: ToolbarButtonConfig,
  activeMarks: Set<string>,
  extraContent?: string,
  activeOverride?: boolean,
  shortcutOverride?: string
): string {
  const isActive = activeOverride ?? Boolean(config.mark && activeMarks.has(config.mark));
  const shortcutSource = shortcutOverride ?? config.shortcut ?? '';
  const shortcutLabel = shortcutSource ? toPlatformShortcutLabel(shortcutSource) : '';
  const shortcutAttr = shortcutLabel ? `data-shortcut="${shortcutLabel}"` : '';
  const tooltipAttr = shortcutLabel ? `data-tooltip="${shortcutLabel}"` : '';

  return `
    <button class="toolbar-btn has-tooltip ${isActive ? 'active' : ''}" 
            data-action="${config.action}" 
            ${tooltipAttr}
            ${shortcutAttr}>
      ${config.icon}
      ${extraContent || ''}
    </button>
  `;
}

function renderButtonGroup(
  buttons: ToolbarButtonConfig[],
  activeMarks: Set<string>,
  extraClass?: string
): string {
  const buttonsHtml = buttons.map((button) => renderButton(button, activeMarks)).join('');
  return `<div class="toolbar-group ${extraClass || ''}">${buttonsHtml}</div>`;
}

function getExtraButton(action: string): ToolbarButtonConfig {
  const button = EXTRA_BUTTONS.find((item) => item.action === action);
  if (!button) {
    throw new Error(`Missing toolbar button config for action: ${action}`);
  }
  return button;
}

function getBlockTypeLabel(blockType: BlockType | null): string {
  if (blockType === null) {
    return '';
  }

  const labels: Record<BlockType, string> = {
    paragraph: '',
    heading1: 'H1',
    heading2: 'H2',
    heading3: 'H3',
    heading4: 'H4',
    heading5: 'H5',
    heading6: 'H6',
    blockquote: 'Quote',
    bulletList: 'Bullet',
    orderedList: 'Number',
    taskList: 'Task',
    codeBlock: 'Code',
  };

  return labels[blockType] || '';
}

function renderBlockTypeContent(blockType: BlockType | null): string {
  if (blockType === null || blockType === 'paragraph') {
    return EDITOR_ICONS.text;
  }

  return `<span class="block-type-label">${getBlockTypeLabel(blockType)}</span>`;
}

function getAlignmentIcon(alignment: TextAlignment | null): string {
  if (alignment === null) {
    return EDITOR_ICONS.align;
  }

  if (alignment === 'center') {
    return EDITOR_ICONS.alignCenter;
  }

  if (alignment === 'right') {
    return EDITOR_ICONS.alignRight;
  }

  return EDITOR_ICONS.alignLeft;
}

function renderAiButton(): string {
  return `
    <button class="toolbar-btn toolbar-ai-btn has-tooltip"
            data-action="ai"
            aria-label="Ask AI"
            data-tooltip="Ask AI">
      <span class="toolbar-ai-btn-icon" aria-hidden="true">${EDITOR_ICONS.star}</span>
    </button>
  `;
}

function renderBlockButton(state: FloatingToolbarState): string {
  const blockButtonActive = state.subMenu === 'block' ? 'active' : '';
  return `
    <button class="toolbar-btn toolbar-dropdown-btn has-tooltip ${blockButtonActive}" 
            data-action="block" 
            data-tooltip="Text Type">
      ${renderBlockTypeContent(state.currentBlockType)}
      ${EDITOR_ICONS.chevronDown}
    </button>
  `;
}

function renderAlignmentButton(state: FloatingToolbarState): string {
  const alignmentButtonActive = state.subMenu === 'alignment' ? 'active' : '';
  return `
    <button class="toolbar-btn toolbar-dropdown-btn has-tooltip ${alignmentButtonActive}"
            data-action="alignment"
            data-tooltip="Align">
      ${getAlignmentIcon(state.currentAlignment)}
      ${EDITOR_ICONS.chevronDown}
    </button>
  `;
}

function renderLinkColorGroup(state: FloatingToolbarState): string {
  const linkButton = getExtraButton('link');
  const colorButtonConfig = getExtraButton('color');
  const colorButton = renderButton(
    colorButtonConfig,
    state.activeMarks,
    state.textColor || state.bgColor
      ? `<span class="color-indicator" style="background-color: ${state.textColor || state.bgColor}"></span>`
      : '',
    Boolean(state.textColor || state.bgColor)
  );

  return `
    <div class="toolbar-group toolbar-link-color-group">
      ${renderButton(linkButton, state.activeMarks, '', Boolean(state.linkUrl))}
      ${colorButton}
    </div>
  `;
}

function renderCopyDeleteGroup(state: FloatingToolbarState): string {
  const copyButton = getExtraButton('copy');
  const deleteButton = getExtraButton('delete');
  return `
    <div class="toolbar-group">
      ${renderButton(copyButton, state.activeMarks, '', state.copied, state.copied ? 'Copied' : undefined)}
      ${renderButton(deleteButton, state.activeMarks)}
    </div>
  `;
}

function renderToolbarGroup(group: ToolbarGroupKey, state: FloatingToolbarState): string {
  switch (group) {
    case 'ai':
      return `<div class="toolbar-group toolbar-ai-group">${renderAiButton()}</div>`;
    case 'block':
      return `<div class="toolbar-group toolbar-block-group">${renderBlockButton(state)}</div>`;
    case 'alignment':
      return `<div class="toolbar-group toolbar-alignment-group">${renderAlignmentButton(state)}</div>`;
    case 'format':
      return renderButtonGroup(FORMAT_BUTTONS, state.activeMarks, 'toolbar-format-group');
    case 'linkColor':
      return renderLinkColorGroup(state);
    case 'copyDelete':
      return renderCopyDeleteGroup(state);
  }
}

function getToolbarLayout(state: FloatingToolbarState): ToolbarLayout {
  if (state.currentBlockType === 'codeBlock') {
    return 'codeBlock';
  }

  return 'default';
}

export function renderToolbarBodyMarkup(state: FloatingToolbarState): string {
  const groups = TOOLBAR_LAYOUTS[getToolbarLayout(state)];
  const parts: string[] = [];

  groups.forEach((group, index) => {
    parts.push(renderToolbarGroup(group, state));
    if (index < groups.length - 1) {
      parts.push('<div class="toolbar-divider"></div>');
    }
  });

  return `
    <div class="floating-toolbar-inner">
      ${parts.join('')}
    </div>
  `;
}
