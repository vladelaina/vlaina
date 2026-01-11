/**
 * Code Block Toolbar - Language selector and copy button
 */

import { useState, useRef, useEffect } from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Common programming languages
const LANGUAGES = [
  { id: 'plain', label: 'Plain Text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'php', label: 'PHP' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'scss', label: 'SCSS' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'xml', label: 'XML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'sql', label: 'SQL' },
  { id: 'bash', label: 'Bash' },
  { id: 'powershell', label: 'PowerShell' },
];

interface CodeToolbarProps {
  language: string;
  code: string;
  onLanguageChange: (language: string) => void;
}

export function CodeToolbar({ language, code, onLanguageChange }: CodeToolbarProps) {
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchText, setSearchText] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowLanguageMenu(false);
        setSearchText('');
      }
    };

    if (showLanguageMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      inputRef.current?.focus();
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLanguageMenu]);

  // Copy code to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Filter languages by search
  const filteredLanguages = LANGUAGES.filter(
    (lang) =>
      lang.label.toLowerCase().includes(searchText.toLowerCase()) ||
      lang.id.toLowerCase().includes(searchText.toLowerCase())
  );

  // Get current language label
  const currentLanguage = LANGUAGES.find((l) => l.id === language)?.label || language || 'Plain Text';

  return (
    <div className="code-toolbar">
      {/* Language Selector */}
      <div className="code-toolbar-language" ref={menuRef}>
        <button
          className="language-button"
          onClick={() => setShowLanguageMenu(!showLanguageMenu)}
        >
          <span>{currentLanguage}</span>
          <ChevronDown size={14} />
        </button>

        {showLanguageMenu && (
          <div className="language-menu">
            <div className="language-search">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search language..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowLanguageMenu(false);
                    setSearchText('');
                  }
                }}
              />
            </div>
            <div className="language-list">
              {filteredLanguages.map((lang) => (
                <button
                  key={lang.id}
                  className={cn('language-item', lang.id === language && 'active')}
                  onClick={() => {
                    onLanguageChange(lang.id);
                    setShowLanguageMenu(false);
                    setSearchText('');
                  }}
                >
                  {lang.label}
                </button>
              ))}
              {filteredLanguages.length === 0 && (
                <div className="language-empty">No languages found</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Copy Button */}
      <button
        className={cn('code-toolbar-copy', copied && 'copied')}
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy code'}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}
