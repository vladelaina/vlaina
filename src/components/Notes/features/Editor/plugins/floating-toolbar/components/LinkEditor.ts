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
  editor.className = 'link-editor-rail';
  
  const currentUrl = state.linkUrl || '';
  const shouldAutofocus = Boolean(state.linkUrl);
  
  editor.innerHTML = `
    <div class="link-editor-rail-inner">
      <input 
        type="text" 
        class="link-editor-rail-input" 
        placeholder="Paste or type a URL..."
        value="${escapeHtml(currentUrl)}"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="link-editor-rail-line"></div>
    </div>
    <div class="link-editor-rail-hint">Press Enter to bridge the link</div>
  `;
  
  const input = editor.querySelector('.link-editor-rail-input') as HTMLInputElement;
  const line = editor.querySelector('.link-editor-rail-line') as HTMLElement;

  if (shouldAutofocus) {
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyLink();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  });

  function applyLink() {
    const value = input.value.trim();
    
    // If empty, remove the link
    if (!value) {
      setLink(view, null);
      onClose();
      return;
    }

    // First principles: if it's not a valid URL, give subtle feedback
    if (!isValidUrl(value) && !value.startsWith('/') && !value.startsWith('#')) {
      input.classList.add('error-shake');
      line.classList.add('error-line');
      
      setTimeout(() => {
        input.classList.remove('error-shake');
        line.classList.remove('error-line');
      }, 500);
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
