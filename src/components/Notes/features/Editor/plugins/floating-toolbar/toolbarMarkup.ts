import type { BlockType, FloatingToolbarState, TextAlignment } from './types';
import type { ToolbarButtonConfig } from './toolbarConfig';
import { EXTRA_BUTTONS, FORMAT_BUTTONS } from './toolbarConfig';
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
  const buttonsHtml = buttons.map((btn) => renderButton(btn, activeMarks)).join('');
  return `<div class="toolbar-group ${extraClass || ''}">${buttonsHtml}</div>`;
}

function getExtraButton(action: string): ToolbarButtonConfig {
  const button = EXTRA_BUTTONS.find((item) => item.action === action);
  if (!button) {
    throw new Error(`Missing toolbar button config for action: ${action}`);
  }
  return button;
}

function getBlockTypeLabel(blockType: BlockType): string {
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

function renderBlockTypeContent(blockType: BlockType): string {
  if (blockType === 'paragraph') {
    return EDITOR_ICONS.text;
  }

  return `<span class="block-type-label">${getBlockTypeLabel(blockType)}</span>`;
}

function getAlignmentIcon(alignment: TextAlignment): string {
  if (alignment === 'center') {
    return EDITOR_ICONS.alignCenter;
  }

  if (alignment === 'right') {
    return EDITOR_ICONS.alignRight;
  }

  return EDITOR_ICONS.alignLeft;
}

function renderAiComposerMarkup(): string {
  return `
    <div class="floating-toolbar-inner floating-toolbar-ai-mode">
      <div class="toolbar-ai-composer">
        <input
          class="toolbar-ai-composer-input"
          type="text"
          placeholder="What are your thoughts?"
          aria-label="Ask AI"
        />
        <div class="toolbar-ai-model-selector-slot"></div>
        <button class="toolbar-ai-send is-disabled" type="button" aria-label="Send AI prompt" disabled>
          <svg aria-hidden="true" viewBox="0 0 14 17" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0.918802 7.73542C1.19144 7.73542 1.43401 7.63188 1.60065 7.45804L3.59348 5.48929L6.7957 1.89614L10.0107 5.48929L12.0067 7.45804C12.179 7.63188 12.416 7.73542 12.6886 7.73542C13.2182 7.73542 13.6074 7.33974 13.6074 6.80466C13.6074 6.54785 13.5149 6.3174 13.3131 6.10998L7.51833 0.306385C7.32603 0.106874 7.06851 0 6.8029 0C6.5373 0 6.2782 0.106874 6.08748 0.306385L0.299881 6.10998C0.0996671 6.3174 0 6.54785 0 6.80466C0 7.33974 0.389177 7.73542 0.918802 7.73542ZM6.8029 16.6848C7.36909 16.6848 7.76073 16.2909 7.76073 15.7136V4.79494L7.65544 1.93059C7.65544 1.40993 7.31091 1.06066 6.8029 1.06066C6.29332 1.06066 5.94879 1.40993 5.94879 1.93059L5.8435 4.79494V15.7136C5.8435 16.2909 6.23672 16.6848 6.8029 16.6848Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  `;
}

export function renderToolbarMarkup(state: FloatingToolbarState): string {
  if (state.subMenu === 'ai') {
    return renderAiComposerMarkup();
  }

  const linkButton = getExtraButton('link');
  const colorButtonConfig = getExtraButton('color');
  const copyButton = getExtraButton('copy');
  const deleteButton = getExtraButton('delete');

  const colorButton = renderButton(
    colorButtonConfig,
    state.activeMarks,
    state.textColor
      ? `<span class="color-indicator" style="background-color: ${state.textColor}"></span>`
      : ''
  );

  const blockButtonActive = state.subMenu === 'block' ? 'active' : '';
  const blockButton = `
    <button class="toolbar-btn toolbar-dropdown-btn has-tooltip ${blockButtonActive}" 
            data-action="block" 
            data-tooltip="Text Type">
      ${renderBlockTypeContent(state.currentBlockType)}
      ${EDITOR_ICONS.chevronDown}
    </button>
  `;

  const alignmentButtonActive = state.subMenu === 'alignment' ? 'active' : '';
  const alignmentButton = `
    <button class="toolbar-btn toolbar-dropdown-btn has-tooltip ${alignmentButtonActive}"
            data-action="alignment"
            data-tooltip="Align">
      ${getAlignmentIcon(state.currentAlignment)}
      ${EDITOR_ICONS.chevronDown}
    </button>
  `;

  const aiButton = `
    <button class="toolbar-btn toolbar-ai-btn has-tooltip"
            data-action="ai">
      <span class="toolbar-ai-btn-icon" aria-hidden="true">💫</span>
      <span class="toolbar-ai-btn-label">Ask AI</span>
      ${EDITOR_ICONS.chevronDown}
    </button>
  `;

  return `
    <div class="floating-toolbar-inner">
      <div class="toolbar-group toolbar-ai-group">
        ${aiButton}
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group toolbar-block-group">
        ${blockButton}
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group toolbar-alignment-group">
        ${alignmentButton}
      </div>
      <div class="toolbar-divider"></div>
      ${renderButtonGroup(FORMAT_BUTTONS, state.activeMarks, 'toolbar-format-group')}
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        ${renderButton(linkButton, state.activeMarks)}
        ${colorButton}
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        ${renderButton(copyButton, state.activeMarks, '', state.copied, state.copied ? 'Copied' : undefined)}
        ${renderButton(deleteButton, state.activeMarks)}
      </div>
    </div>
  `;
}
