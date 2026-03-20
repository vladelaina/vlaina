import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from '../types';
import { setLink } from '../commands';
import { isValidUrl } from '../utils';

export function renderLinkEditor(
  container: HTMLElement,
  view: EditorView,
  state: FloatingToolbarState,
  onClose: () => void
): void {
  const editor = document.createElement('div');
  editor.className = 'toolbar-submenu link-editor';
  
  const currentUrl = state.linkUrl || '';
  const hasExistingLink = !!state.linkUrl;
  
  editor.innerHTML = `
    <div class="link-editor-content">
      <input 
        type="text" 
        class="link-editor-input" 
        placeholder="Enter link URL"
        value="${escapeHtml(currentUrl)}"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="link-editor-error" style="display: none;"></div>
      <div class="link-editor-actions">
        ${hasExistingLink ? `
          <button class="link-editor-btn link-editor-btn-secondary" data-action="remove">
            Remove
          </button>
        ` : ''}
        <button class="link-editor-btn link-editor-btn-primary" data-action="apply">
          ${hasExistingLink ? 'Update' : 'Add'}
        </button>
      </div>
    </div>
  `;
  
  const input = editor.querySelector('.link-editor-input') as HTMLInputElement;
  const errorEl = editor.querySelector('.link-editor-error') as HTMLElement;

  setTimeout(() => input.focus(), 0);

  input.addEventListener('input', () => {
    errorEl.style.display = 'none';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyLink();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  });

  editor.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = (btn as HTMLElement).dataset.action;
      
      if (action === 'apply') {
        applyLink();
      } else if (action === 'remove') {
        setLink(view, null);
        onClose();
      }
    });
  });
  
  function applyLink() {
    const value = input.value.trim();
    
    if (!value) {
      setLink(view, null);
      onClose();
      return;
    }

    if (!isValidUrl(value)) {
      errorEl.textContent = 'Please enter a valid URL';
      errorEl.style.display = 'block';
      return;
    }
    
    setLink(view, value);
    onClose();
  }
  
  container.appendChild(editor);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
