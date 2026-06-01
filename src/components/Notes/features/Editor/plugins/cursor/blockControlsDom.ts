import { themeIconTokens, themeStyleResetTokens } from '@/styles/themeTokens';

interface BlockControlsDom {
  controls: HTMLDivElement;
  handleButton: HTMLButtonElement;
  dropIndicator: HTMLDivElement;
}

export function createBlockControlsDom(doc: Document): BlockControlsDom {
  const controls = doc.createElement('div');
  controls.className = 'editor-block-controls';
  controls.setAttribute('data-no-block-controls', 'true');
  controls.setAttribute('data-no-editor-drag-box', 'true');

  const handleButton = doc.createElement('button');
  handleButton.type = 'button';
  handleButton.className = 'editor-block-control-btn editor-block-control-handle';
  handleButton.setAttribute('aria-label', 'Drag block');
  handleButton.setAttribute('data-no-block-controls', 'true');
  handleButton.setAttribute('data-no-editor-drag-box', 'true');
  handleButton.draggable = false;
  // Drag-handle glyph adapted from Phosphor Icons (MIT).
  handleButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${themeIconTokens.viewBoxPhosphor}" width="${themeIconTokens.sizeMd}" height="${themeIconTokens.sizeMd}" aria-hidden="true" focusable="false">
      <path d="M108,60A16,16,0,1,1,92,44,16,16,0,0,1,108,60Zm56,16a16,16,0,1,0-16-16A16,16,0,0,0,164,76ZM92,112a16,16,0,1,0,16,16A16,16,0,0,0,92,112Zm72,0a16,16,0,1,0,16,16A16,16,0,0,0,164,112ZM92,180a16,16,0,1,0,16,16A16,16,0,0,0,92,180Zm72,0a16,16,0,1,0,16,16A16,16,0,0,0,164,180Z" fill="${themeStyleResetTokens.currentColor}"></path>
    </svg>
  `;
  controls.appendChild(handleButton);
  doc.body.appendChild(controls);

  const dropIndicator = doc.createElement('div');
  dropIndicator.className = 'editor-block-drop-indicator';
  dropIndicator.setAttribute('aria-hidden', 'true');
  doc.body.appendChild(dropIndicator);

  return { controls, handleButton, dropIndicator };
}
