// Link Editor Component
import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from '../types';
import { setLink } from '../commands';
import { isValidUrl } from '../utils';

/**
 * Render link editor submenu
 */
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
        placeholder="输入链接地址或 [[笔记名称]]"
        value="${escapeHtml(currentUrl)}"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="link-editor-error" style="display: none;"></div>
      <div class="link-editor-actions">
        ${hasExistingLink ? `
          <button class="link-editor-btn link-editor-btn-secondary" data-action="remove">
            移除链接
          </button>
        ` : ''}
        <button class="link-editor-btn link-editor-btn-primary" data-action="apply">
          ${hasExistingLink ? '更新' : '添加'}
        </button>
      </div>
      <div class="link-suggestions" style="display: none;"></div>
    </div>
  `;
  
  const input = editor.querySelector('.link-editor-input') as HTMLInputElement;
  const errorEl = editor.querySelector('.link-editor-error') as HTMLElement;
  const suggestionsEl = editor.querySelector('.link-suggestions') as HTMLElement;
  
  // Focus input
  setTimeout(() => input.focus(), 0);
  
  // Handle input changes
  input.addEventListener('input', () => {
    const value = input.value.trim();
    
    // Clear error
    errorEl.style.display = 'none';
    
    // Check for wiki link pattern
    if (value.startsWith('[[')) {
      showWikiLinkSuggestions(suggestionsEl, value, view, (noteName) => {
        input.value = `[[${noteName}]]`;
        suggestionsEl.style.display = 'none';
      });
    } else {
      suggestionsEl.style.display = 'none';
    }
  });
  
  // Handle keyboard
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyLink();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  });
  
  // Handle button clicks
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
      // Empty value removes link
      setLink(view, null);
      onClose();
      return;
    }
    
    // Validate URL
    if (!isValidUrl(value)) {
      errorEl.textContent = '请输入有效的链接地址';
      errorEl.style.display = 'block';
      return;
    }
    
    setLink(view, value);
    onClose();
  }
  
  container.appendChild(editor);
}

/**
 * Show wiki link suggestions
 */
function showWikiLinkSuggestions(
  container: HTMLElement,
  query: string,
  _view: EditorView,
  onSelect: (noteName: string) => void
): void {
  // Extract search term from [[query
  const searchTerm = query.replace(/^\[\[/, '').replace(/\]\]$/, '').toLowerCase();
  
  if (!searchTerm) {
    container.style.display = 'none';
    return;
  }
  
  // TODO: Integrate with notes store to get actual note suggestions
  // For now, show a placeholder
  container.innerHTML = `
    <div class="link-suggestion-item" data-note="${escapeHtml(searchTerm)}">
      <span class="link-suggestion-icon">📝</span>
      <span>创建 "${escapeHtml(searchTerm)}"</span>
    </div>
  `;
  
  container.style.display = 'block';
  
  // Handle suggestion click
  container.querySelectorAll('[data-note]').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const noteName = (item as HTMLElement).dataset.note || '';
      onSelect(noteName);
    });
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
