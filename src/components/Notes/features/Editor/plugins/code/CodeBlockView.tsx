import React, { useState, useMemo } from 'react';
import { Node } from '@milkdown/kit/prose/model';
import { EditorView } from '@milkdown/kit/prose/view';
import { MdCheck, MdContentCopy, MdOutlineFileDownload, MdExpandMore, MdExpandLess, MdAutoAwesome, MdSearch, MdCode } from 'react-icons/md';
import { SUPPORTED_LANGUAGES, normalizeLanguage } from '../../utils/shiki';
import { guessLanguage } from '../../utils/languageGuesser';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CodeBlockViewProps {
    node: Node;
    view: EditorView;
    getPos: () => number | undefined;
}

export const CodeBlockView: React.FC<CodeBlockViewProps> = ({ node, view, getPos }) => {
  const language = node.attrs.language || 'text';
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const langInfo = SUPPORTED_LANGUAGES.find(l => l.id === language);
  const displayName = langInfo ? langInfo.name : language;

  const filteredLanguages = useMemo(() => {
    if (!searchTerm) return SUPPORTED_LANGUAGES;
    const term = searchTerm.toLowerCase();
    return SUPPORTED_LANGUAGES.filter(l => 
        l.name.toLowerCase().includes(term) || 
        l.id.toLowerCase().includes(term) ||
        l.aliases?.some(a => a.toLowerCase().includes(term))
    );
  }, [searchTerm]);

  const updateLanguage = (newLang: string) => {
      const pos = getPos();
      if (pos === undefined) return;
      
      const normalized = normalizeLanguage(newLang) || newLang;

      view.dispatch(
          view.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              language: normalized
          })
      );
      setSearchTerm(''); // Clear search on select
  };

  const handleAutoDetect = () => {
    const code = node.textContent;
    const guessed = guessLanguage(code);
    if (guessed) {
        updateLanguage(guessed);
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const code = node.textContent;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const code = node.textContent;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snippet.${language}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleCollapse = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  const headerRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    // Traverse up: CodeBlockView div -> headerDOM -> code-block-container
    const container = headerRef.current?.parentElement?.parentElement;
    if (container) {
       const pre = container.querySelector('.code-block-editable');
       if (pre) {
           if (isCollapsed) {
               container.classList.add('collapsed');
               (pre as HTMLElement).style.display = 'none';
           } else {
               container.classList.remove('collapsed');
               (pre as HTMLElement).style.display = 'block';
           }
       }
    }
  }, [isCollapsed]);

  return (
    <div 
      ref={headerRef} 
      className="flex items-center justify-between px-4 py-2 bg-white dark:bg-[#1e1e1e] select-none rounded-t-xl transition-all"
    >
        <div className="flex items-center gap-2.5 text-gray-600 dark:text-zinc-400">
          <DropdownMenu onOpenChange={(open) => !open && setSearchTerm('')}>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 group/lang cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800/50 px-2 py-1 rounded-md transition-colors">
                <MdCode size={18} className="text-gray-400 group-hover/lang:text-gray-700 dark:group-hover/lang:text-zinc-300 transition-colors" />
                <span className="text-sm font-medium text-gray-500 group-hover/lang:text-gray-900 dark:group-hover/lang:text-zinc-200 transition-colors">
                  {displayName}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px] p-0 overflow-hidden flex flex-col border border-gray-200 dark:border-zinc-800 shadow-xl rounded-xl">
              {/* Search Bar & Auto-Detect Group */}
              <div className="p-2 bg-gray-50/50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800 flex flex-col gap-2">
                <div className="relative">
                  <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-[18px] text-gray-400" />
                  <input
                    autoFocus
                    className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Search language..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                
                <button
                  onClick={handleAutoDetect}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  <MdAutoAwesome size={18} className="shrink-0" />
                  <span>Auto Detect Language</span>
                </button>
              </div>

              {/* Languages List */}
              <div className="max-h-[240px] overflow-y-auto p-1 neko-scrollbar">
                {filteredLanguages.length > 0 ? (
                  filteredLanguages.map(lang => (
                    <DropdownMenuItem 
                      key={lang.id} 
                      onSelect={() => updateLanguage(lang.id)}
                      className={cn(
                        "text-xs px-3 py-2 rounded-lg cursor-pointer",
                        language === lang.id ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-bold" : "text-gray-600 dark:text-zinc-400"
                      )}
                    >
                      {lang.name}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
                    No languages found
                  </div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover/code:opacity-100 transition-opacity duration-200">
            <button 
                onClick={handleDownload}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 transition-colors"
                title="Download"
            >
                <MdOutlineFileDownload size={18} />
            </button>
            <button 
                onClick={handleCopy}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 transition-colors"
                title="Copy code"
            >
                {copied ? <MdCheck size={18} className="text-green-500" /> : <MdContentCopy size={18} />}
            </button>
            <button 
                onClick={toggleCollapse}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 transition-colors"
                title={isCollapsed ? "Expand" : "Collapse"}
            >
                {isCollapsed ? <MdExpandMore size={18} /> : <MdExpandLess size={18} />}
            </button>
        </div>
    </div>
  );
};