/**
 * Keyboard Shortcuts Modal - Shows all available keyboard shortcuts
 */

import { useEffect, useCallback } from 'react';
import { IconX, IconKeyboard } from '@tabler/icons-react';

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: '基础操作',
    shortcuts: [
      { keys: ['Enter'], description: '新建段落' },
      { keys: ['Shift', 'Enter'], description: '软换行' },
      { keys: ['Backspace'], description: '删除 / 合并到上一块' },
      { keys: ['Tab'], description: '列表缩进' },
      { keys: ['Shift', 'Tab'], description: '列表取消缩进' },
    ],
  },
  {
    title: '块操作',
    shortcuts: [
      { keys: ['Ctrl', 'D'], description: '复制当前块' },
      { keys: ['Ctrl', 'Shift', '↑'], description: '上移当前块' },
      { keys: ['Ctrl', 'Shift', '↓'], description: '下移当前块' },
      { keys: ['/'], description: '打开命令菜单' },
    ],
  },
  {
    title: '撤销 / 重做',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: '撤销' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: '重做' },
      { keys: ['Ctrl', 'Y'], description: '重做' },
    ],
  },
  {
    title: '文本格式',
    shortcuts: [
      { keys: ['Ctrl', 'B'], description: '粗体' },
      { keys: ['Ctrl', 'I'], description: '斜体' },
      { keys: ['Ctrl', 'U'], description: '下划线' },
      { keys: ['Ctrl', 'Shift', 'S'], description: '删除线' },
      { keys: ['Ctrl', 'E'], description: '行内代码' },
    ],
  },
  {
    title: 'Markdown 快捷方式',
    shortcuts: [
      { keys: ['#', 'Space'], description: '一级标题' },
      { keys: ['##', 'Space'], description: '二级标题' },
      { keys: ['###', 'Space'], description: '三级标题' },
      { keys: ['-', 'Space'], description: '无序列表' },
      { keys: ['1.', 'Space'], description: '有序列表' },
      { keys: ['[]', 'Space'], description: '待办列表' },
      { keys: ['>', 'Space'], description: '引用块' },
      { keys: ['```'], description: '代码块' },
      { keys: ['---'], description: '分割线' },
    ],
  },
  {
    title: '行内 Markdown',
    shortcuts: [
      { keys: ['**text**'], description: '粗体' },
      { keys: ['*text*'], description: '斜体' },
      { keys: ['~~text~~'], description: '删除线' },
      { keys: ['`code`'], description: '行内代码' },
      { keys: ['[[link]]'], description: 'Wiki 链接' },
    ],
  },
  {
    title: '导航',
    shortcuts: [
      { keys: ['↑'], description: '移动到上一块' },
      { keys: ['↓'], description: '移动到下一块' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="keyboard-shortcuts-overlay" onClick={onClose}>
      <div 
        className="keyboard-shortcuts-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="keyboard-shortcuts-header">
          <div className="keyboard-shortcuts-title">
            <IconKeyboard size={20} />
            <span>键盘快捷键</span>
          </div>
          <button className="keyboard-shortcuts-close" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>
        
        <div className="keyboard-shortcuts-content">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="shortcut-group">
              <div className="shortcut-group-title">{group.title}</div>
              <div className="shortcut-list">
                {group.shortcuts.map((shortcut, index) => (
                  <div key={index} className="shortcut-item">
                    <div className="shortcut-keys">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex}>
                          <kbd className="shortcut-key">{key}</kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="shortcut-plus">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                    <div className="shortcut-description">{shortcut.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
