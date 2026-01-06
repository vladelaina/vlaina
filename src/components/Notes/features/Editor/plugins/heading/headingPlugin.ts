/**
 * Heading Plugin - 标题插件
 * 
 * 功能：
 * 1. 可编辑的井号标记 - 光标进入标题时显示真实可编辑的 ## 前缀
 * 2. 悬停显示井号 - 鼠标悬停时显示可点击的井号，点击打开级别选择菜单
 * 3. 保护第一个 H1 - 文档标题不显示井号，且不能被删除
 * 4. 级别同步 - 编辑井号数量会自动更新标题级别
 */

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

// ============================================================================
// Types - 类型定义
// ============================================================================

export interface HeadingAttrs {
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface HeadingState {
  isFocused: boolean;
  isFirstH1: boolean;
}

// ============================================================================
// State - 状态管理
// ============================================================================

// 当前正在编辑的标题位置（已插入井号前缀）
let editingHeadingPos: number | null = null;

// 防止递归更新
let isProcessingTransaction = false;

// 级别选择菜单
let activeMenu: HTMLElement | null = null;

// 鼠标悬停的标题位置
let hoveredHeadingPos: number | null = null;

// ============================================================================
// Helpers - 辅助函数
// ============================================================================

/**
 * 关闭级别选择菜单
 */
function closeMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}

/**
 * 检查是否是第一个 H1（文档标题）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFirstH1(doc: any, pos: number): boolean {
  const firstNode = doc.firstChild;
  return (
    firstNode !== null && 
    pos === 0 && 
    firstNode.type.name === 'heading' && 
    firstNode.attrs.level === 1
  );
}

/**
 * 创建级别选择菜单
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createLevelMenu(view: any, pos: number, currentLevel: number, rect: DOMRect) {
  closeMenu();
  
  const menu = document.createElement('div');
  menu.className = 'heading-level-menu';
  menu.style.position = 'fixed';
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.zIndex = '1000';
  
  for (let level = 1; level <= 6; level++) {
    const item = document.createElement('button');
    item.className = `heading-level-item${level === currentLevel ? ' active' : ''}`;
    item.textContent = `${'#'.repeat(level)} Heading ${level}`;
    item.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (level !== currentLevel) {
        const tr = view.state.tr.setNodeMarkup(pos, undefined, { level });
        view.dispatch(tr);
      }
      closeMenu();
      view.focus();
    };
    menu.appendChild(item);
  }
  
  document.body.appendChild(menu);
  activeMenu = menu;
  
  // 点击外部关闭菜单
  const handleClickOutside = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      closeMenu();
      document.removeEventListener('click', handleClickOutside);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
  }, 0);
}

// ============================================================================
// Plugins - 插件定义
// ============================================================================

/**
 * 保护第一个 H1 插件
 * 防止用户删除文档标题
 */
const protectFirstH1Plugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('protectFirstH1'),
    props: {
      handleKeyDown(view, event) {
        const { state } = view;
        const { selection, doc } = state;
        const { from, empty } = selection;
        
        const firstNode = doc.firstChild;
        if (!firstNode || firstNode.type.name !== 'heading') return false;
        
        const firstNodeStart = 1;
        
        // 阻止在第一个 H1 开头按 Backspace
        if (event.key === 'Backspace' && empty && from === firstNodeStart) {
          return true;
        }
        
        return false;
      }
    }
  });
});

/**
 * 标题井号插件
 * 处理井号的显示、编辑和级别同步
 */
const headingHashPlugin = $prose(() => {
  return new Plugin({
    key: new PluginKey('headingHash'),
    
    // View 更新处理
    view() {
      return {
        update(view, prevState) {
          // 防止递归更新
          if (isProcessingTransaction) return;
          
          const { state } = view;
          const { selection, doc } = state;
          const $from = selection.$from;
          
          // 判断光标当前是否在标题中
          let currentHeadingPos: number | null = null;
          
          if ($from.parent.type.name === 'heading') {
            const pos = $from.before($from.depth);
            // 跳过第一个 H1
            if (!isFirstH1(doc, pos)) {
              currentHeadingPos = pos;
            }
          }
          
          // 情况1: 光标进入新标题
          if (currentHeadingPos !== null && editingHeadingPos === null) {
            const node = doc.nodeAt(currentHeadingPos);
            if (node && node.type.name === 'heading') {
              const level = node.attrs.level as number;
              const hashPrefix = '#'.repeat(level) + ' ';
              const text = node.textContent;
              
              // 只在没有井号前缀时插入
              if (!text.startsWith(hashPrefix)) {
                isProcessingTransaction = true;
                
                const insertPos = currentHeadingPos + 1;
                let tr = state.tr.insertText(hashPrefix, insertPos);
                
                // 调整光标位置
                const oldCursorPos = $from.pos;
                const newCursorPos = oldCursorPos + hashPrefix.length;
                tr = tr.setSelection(TextSelection.create(tr.doc, newCursorPos));
                
                view.dispatch(tr);
                editingHeadingPos = currentHeadingPos;
                
                isProcessingTransaction = false;
              } else {
                editingHeadingPos = currentHeadingPos;
              }
            }
          }
          // 情况2: 光标离开标题
          else if (editingHeadingPos !== null && currentHeadingPos !== editingHeadingPos) {
            const oldPos = editingHeadingPos;
            const oldNode = prevState.doc.nodeAt(oldPos);
            
            if (oldNode && oldNode.type.name === 'heading') {
              const text = oldNode.textContent;
              const hashMatch = text.match(/^(#{1,6})\s*/);
              
              if (hashMatch) {
                isProcessingTransaction = true;
                
                const hashText = hashMatch[0];
                const hashCount = hashMatch[1].length;
                const currentLevel = oldNode.attrs.level as number;
                
                let actualOldPos = oldPos;
                
                // 检查节点是否还在原位置
                const nodeAtOldPos = doc.nodeAt(oldPos);
                if (nodeAtOldPos && nodeAtOldPos.type.name === 'heading') {
                  const currentText = nodeAtOldPos.textContent;
                  if (currentText.startsWith(hashMatch[0])) {
                    actualOldPos = oldPos;
                  }
                }
                
                const deleteFrom = actualOldPos + 1;
                const deleteTo = deleteFrom + hashText.length;
                
                const nodeToClean = doc.nodeAt(actualOldPos);
                if (nodeToClean && nodeToClean.type.name === 'heading' && 
                    nodeToClean.textContent.startsWith(hashMatch[0])) {
                  
                  let tr = state.tr.delete(deleteFrom, deleteTo);
                  
                  // 如果井号数量变化，更新标题级别
                  if (hashCount !== currentLevel && hashCount >= 1 && hashCount <= 6) {
                    tr = tr.setNodeMarkup(actualOldPos, undefined, { level: hashCount });
                  }
                  
                  // 保持光标位置
                  const cursorPos = selection.$from.pos;
                  if (cursorPos > deleteTo) {
                    const newCursorPos = cursorPos - hashText.length;
                    tr = tr.setSelection(TextSelection.create(tr.doc, newCursorPos));
                  }
                  
                  view.dispatch(tr);
                }
                
                isProcessingTransaction = false;
              }
            }
            
            editingHeadingPos = null;
            
            // 如果移动到新标题，设置它
            if (currentHeadingPos !== null) {
              setTimeout(() => {
                const newNode = view.state.doc.nodeAt(currentHeadingPos);
                if (newNode && newNode.type.name === 'heading') {
                  const level = newNode.attrs.level as number;
                  const hashPrefix = '#'.repeat(level) + ' ';
                  const text = newNode.textContent;
                  
                  if (!text.startsWith(hashPrefix)) {
                    isProcessingTransaction = true;
                    
                    const insertPos = currentHeadingPos + 1;
                    let tr = view.state.tr.insertText(hashPrefix, insertPos);
                    
                    const sel = view.state.selection;
                    if (sel.$from.pos >= insertPos) {
                      const newCursorPos = sel.$from.pos + hashPrefix.length;
                      tr = tr.setSelection(TextSelection.create(tr.doc, newCursorPos));
                    }
                    
                    view.dispatch(tr);
                    editingHeadingPos = currentHeadingPos;
                    
                    isProcessingTransaction = false;
                  } else {
                    editingHeadingPos = currentHeadingPos;
                  }
                }
              }, 0);
            }
          }
        },
        destroy() {
          closeMenu();
          editingHeadingPos = null;
        }
      };
    },
    
    // Props 配置
    props: {
      // 装饰器 - 样式化井号
      decorations(state) {
        const { doc } = state;
        const decorations: Decoration[] = [];
        
        // 为正在编辑的标题添加井号样式
        if (editingHeadingPos !== null) {
          const node = doc.nodeAt(editingHeadingPos);
          if (node && node.type.name === 'heading') {
            const text = node.textContent;
            const hashMatch = text.match(/^(#{1,6})\s*/);
            
            if (hashMatch) {
              const hashLen = hashMatch[0].length;
              const hashStart = editingHeadingPos + 1;
              const hashEnd = hashStart + hashLen;
              
              const deco = Decoration.inline(hashStart, hashEnd, {
                class: 'heading-hash-text',
                nodeName: 'span'
              });
              decorations.push(deco);
            }
          }
        }
        
        // 悬停时显示可点击的井号
        if (hoveredHeadingPos !== null && hoveredHeadingPos !== editingHeadingPos) {
          const node = doc.nodeAt(hoveredHeadingPos);
          if (node && node.type.name === 'heading' && !isFirstH1(doc, hoveredHeadingPos)) {
            const level = node.attrs.level as number;
            const hashes = '#'.repeat(level) + ' ';
            
            const widget = Decoration.widget(hoveredHeadingPos + 1, (view) => {
              const span = document.createElement('span');
              span.textContent = hashes;
              span.className = 'heading-hash-hover';
              span.title = '点击更改标题级别';
              
              span.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = span.getBoundingClientRect();
                createLevelMenu(view, hoveredHeadingPos!, level, rect);
              };
              
              return span;
            }, { side: -1, key: `heading-hash-hover-${hoveredHeadingPos}` });
            
            decorations.push(widget);
          }
        }
        
        return DecorationSet.create(doc, decorations);
      },
      
      // DOM 事件处理
      handleDOMEvents: {
        mouseover(view, event) {
          const target = event.target as HTMLElement;
          const headingEl = target.closest('h1, h2, h3, h4, h5, h6');
          
          if (headingEl) {
            const { state } = view;
            const { doc } = state;
            let foundPos: number | null = null;
            
            doc.descendants((node, pos) => {
              if (node.type.name === 'heading' && foundPos === null) {
                const domNode = view.nodeDOM(pos);
                if (domNode === headingEl || headingEl.contains(domNode as Node)) {
                  foundPos = pos;
                }
              }
            });
            
            if (foundPos !== null && foundPos !== hoveredHeadingPos) {
              hoveredHeadingPos = foundPos;
              view.dispatch(view.state.tr.setMeta('headingHover', foundPos));
            }
          }
          
          return false;
        },
        mouseout(view, event) {
          const target = event.target as HTMLElement;
          const relatedTarget = event.relatedTarget as HTMLElement | null;
          
          const headingEl = target.closest('h1, h2, h3, h4, h5, h6');
          if (headingEl) {
            const newHeadingEl = relatedTarget?.closest('h1, h2, h3, h4, h5, h6');
            const isMovingToHash = relatedTarget?.classList.contains('heading-hash-hover');
            const isMovingToMenu = relatedTarget?.closest('.heading-level-menu');
            
            if (!newHeadingEl && !isMovingToHash && !isMovingToMenu) {
              if (hoveredHeadingPos !== null) {
                hoveredHeadingPos = null;
                view.dispatch(view.state.tr.setMeta('headingHover', null));
              }
            }
          }
          
          return false;
        }
      }
    }
  });
});

// ============================================================================
// Export - 导出
// ============================================================================

/**
 * 标题插件数组
 * 包含所有标题相关的插件
 */
export const headingPlugin = [
  protectFirstH1Plugin,
  headingHashPlugin
];
